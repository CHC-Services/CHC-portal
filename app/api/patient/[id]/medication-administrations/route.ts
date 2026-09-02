import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { canViewMedicationAdministration, canDocumentMedicationAdministration } from '../../../../../lib/permissions'
import { sessionDisplayName, resolveAdministeredByActor, FAMILY_GENERIC_ID, FAMILY_GENERIC_DISPLAY_NAME } from '../../../../../lib/medicationAdministrationActor'
import { dateKeyToUtcMidnight, nyDateKeyOf, nextNyDateKey, easternTimeOfDayUtc } from '../../../../../lib/easternTime'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

function startOfWeekKey(dateKey: string): string {
  const d = dateKeyToUtcMidnight(dateKey)
  const back = d.getUTCDay()
  const start = new Date(d.getTime() - back * 86_400_000)
  return start.toISOString().slice(0, 10)
}

function daysInRange(startKey: string, endKey: string): string[] {
  const days: string[] = []
  let key = startKey
  // Grid views only ever request a week or a month — this guards against a
  // malformed/huge range param turning into an unbounded loop.
  for (let i = 0; i < 400 && key <= endKey; i++) {
    days.push(key)
    key = nextNyDateKey(key)
  }
  return days
}

const TIME_OF_DAY_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

// administeredTimeOfDay is Eastern wall-clock ("what time did this actually
// happen"), same convention as MedicationScheduleTime.timeOfDay — resolved
// through easternTime.ts rather than trusting a client-constructed instant,
// which would silently assume the browser's own timezone. Omitted entirely
// (the common case — marking a dose right as it happens) just means "now."
function resolveAdministeredAt(scheduledDate: string, administeredTimeOfDay: string | undefined | null): Date {
  if (!administeredTimeOfDay) return new Date()
  const match = TIME_OF_DAY_RE.exec(administeredTimeOfDay)
  if (!match) return new Date()
  return easternTimeOfDayUtc(scheduledDate, Number(match[1]), Number(match[2]))
}

function serializeEntry(row: any) {
  return {
    id: row.id,
    scheduledDate: row.scheduledDate.toISOString().slice(0, 10),
    scheduledTimeOfDay: row.scheduledTimeOfDay,
    status: row.status,
    omissionReason: row.omissionReason,
    administeredByUserId: row.administeredByUserId,
    administeredByRole: row.administeredByRole,
    administeredByDisplayNameSnapshot: row.administeredByDisplayNameSnapshot,
    administeredAt: row.administeredAt,
    documentedByUserId: row.documentedByUserId,
    documentedByRole: row.documentedByRole,
    documentedByDisplayNameSnapshot: row.documentedByDisplayNameSnapshot,
    notes: row.notes,
  }
}

// Role-agnostic MAR grid + dose-marking for one patient — backs the new
// "Medication Log" tab (app/components/patient/PatientMedicationMAR.tsx).
// Grid slots are computed on read from PatientMedication + MedicationScheduleTime
// left-joined against actual MedicationAdministration rows, never pre-materialized
// (unlike ShiftTemplate->Shift) since a pending slot doesn't need to "exist"
// until something actually happens.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId } = await params

  if (!(await canViewMedicationAdministration(session, patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const url = new URL(req.url)
  const startParam = url.searchParams.get('start')
  const endParam = url.searchParams.get('end')

  let startKey: string
  let endKey: string
  if (startParam && DATE_KEY_RE.test(startParam) && endParam && DATE_KEY_RE.test(endParam)) {
    startKey = startParam
    endKey = endParam
  } else {
    startKey = startOfWeekKey(nyDateKeyOf(new Date()))
    endKey = startKey
    for (let i = 0; i < 6; i++) endKey = nextNyDateKey(endKey)
  }
  const days = daysInRange(startKey, endKey)

  const [medications, administrations] = await Promise.all([
    (prisma.patientMedication.findMany as any)({
      where: { patientId, active: true },
      orderBy: { medicationName: 'asc' },
      include: { scheduleTimes: { orderBy: { sortOrder: 'asc' } } },
    }),
    (prisma.medicationAdministration.findMany as any)({
      where: {
        patientId,
        scheduledDate: { gte: dateKeyToUtcMidnight(startKey), lte: dateKeyToUtcMidnight(endKey) },
      },
    }),
  ])

  const scheduledLookup = new Map<string, any>()
  const prnLookup = new Map<string, any[]>()
  for (const row of administrations) {
    const dateKey = row.scheduledDate.toISOString().slice(0, 10)
    if (row.scheduledTimeOfDay) {
      scheduledLookup.set(`${row.medicationId}|${dateKey}|${row.scheduledTimeOfDay}`, row)
    } else {
      const key = `${row.medicationId}|${dateKey}`
      const list = prnLookup.get(key) || []
      list.push(row)
      prnLookup.set(key, list)
    }
  }

  const result = medications.map((med: any) => {
    const isPrn = med.scheduleTimes.length === 0
    const slots: Record<string, Record<string, any>> = {}
    const prnEntries: Record<string, any[]> = {}

    if (!isPrn) {
      for (const dateKey of days) {
        slots[dateKey] = {}
        for (const st of med.scheduleTimes) {
          const row = scheduledLookup.get(`${med.id}|${dateKey}|${st.timeOfDay}`)
          slots[dateKey][st.timeOfDay] = row ? serializeEntry(row) : { status: 'pending', scheduledDate: dateKey, scheduledTimeOfDay: st.timeOfDay }
        }
      }
    } else {
      for (const dateKey of days) {
        const rows = prnLookup.get(`${med.id}|${dateKey}`) || []
        prnEntries[dateKey] = rows.map(serializeEntry)
      }
    }

    return {
      id: med.id,
      medicationName: med.medicationName,
      dose: med.dose,
      doseUnit: med.doseUnit,
      frequency: med.frequency,
      route: med.route,
      isPrn,
      scheduleTimes: med.scheduleTimes.map((st: any) => ({ id: st.id, timeOfDay: st.timeOfDay })),
      slots,
      prnEntries,
    }
  })

  return NextResponse.json({ days, medications: result })
}

// POST — mark a dose (scheduled slot or PRN). Upserts on
// [medicationId, scheduledDate, scheduledTimeOfDay] for a scheduled slot
// (clicking an empty or already-marked cell both hit this); PRN always
// creates a new row since several can happen in one day.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId } = await params

  const body = await req.json()
  const { medicationId, scheduledDate, scheduledTimeOfDay, status, administeredByUserId: rawAdministeredBy, administeredTimeOfDay, omissionReason, notes } = body

  if (!medicationId || !scheduledDate || !DATE_KEY_RE.test(scheduledDate)) {
    return NextResponse.json({ error: 'medicationId and scheduledDate (YYYY-MM-DD) are required' }, { status: 400 })
  }
  if (!['given', 'refused', 'omitted'].includes(status)) {
    return NextResponse.json({ error: 'status must be given, refused, or omitted' }, { status: 400 })
  }
  if (status !== 'given' && !omissionReason?.trim()) {
    return NextResponse.json({ error: 'A reason is required when refused or omitted' }, { status: 400 })
  }

  const medication = await (prisma.patientMedication.findUnique as any)({ where: { id: medicationId }, select: { patientId: true } })
  if (!medication || medication.patientId !== patientId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const administeredByUserId: string = rawAdministeredBy || session.id
  if (!(await canDocumentMedicationAdministration(session, patientId, administeredByUserId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let administeredByRole: string
  let administeredByDisplayNameSnapshot: string
  // A dose given by "some family member" without picking a specific linked
  // guardian account — e.g. a relative who isn't a registered portal user.
  // Never stored as a real user id (FAMILY_GENERIC_ID isn't one); the grid
  // renders any guardian-role entry with no administeredByUserId the same
  // generic way regardless.
  let storedAdministeredByUserId: string | null = administeredByUserId
  if (administeredByUserId === FAMILY_GENERIC_ID) {
    administeredByRole = 'guardian'
    administeredByDisplayNameSnapshot = FAMILY_GENERIC_DISPLAY_NAME
    storedAdministeredByUserId = null
  } else if (administeredByUserId === session.id) {
    administeredByRole = session.role
    administeredByDisplayNameSnapshot = sessionDisplayName(session)
  } else {
    const actor = await resolveAdministeredByActor(administeredByUserId, patientId)
    if (!actor) return NextResponse.json({ error: 'That person is not linked to this patient' }, { status: 400 })
    administeredByRole = actor.role
    administeredByDisplayNameSnapshot = actor.displayName
  }

  const data = {
    status,
    omissionReason: status === 'given' ? null : omissionReason.trim(),
    administeredByUserId: storedAdministeredByUserId,
    administeredByRole,
    administeredByDisplayNameSnapshot,
    administeredAt: resolveAdministeredAt(scheduledDate, administeredTimeOfDay),
    documentedByUserId: session.id,
    documentedByRole: session.role,
    documentedByDisplayNameSnapshot: sessionDisplayName(session),
    notes: notes?.trim() || null,
  }

  const scheduledDateValue = dateKeyToUtcMidnight(scheduledDate)

  let entry
  if (scheduledTimeOfDay) {
    entry = await (prisma.medicationAdministration.upsert as any)({
      where: {
        medicationId_scheduledDate_scheduledTimeOfDay: {
          medicationId,
          scheduledDate: scheduledDateValue,
          scheduledTimeOfDay,
        },
      },
      create: { medicationId, patientId, scheduledDate: scheduledDateValue, scheduledTimeOfDay, ...data },
      update: data,
    })
  } else {
    entry = await (prisma.medicationAdministration.create as any)({
      data: { medicationId, patientId, scheduledDate: scheduledDateValue, scheduledTimeOfDay: null, ...data },
    })
  }

  return NextResponse.json({ ok: true, entry: serializeEntry(entry) })
}
