import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { canViewTreatmentAdministration, canDocumentTreatmentAdministration } from '../../../../../lib/permissions'
import { sessionDisplayName } from '../../../../../lib/medicationAdministrationActor'
import { dateKeyToUtcMidnight, nyDateKeyOf, nextNyDateKey } from '../../../../../lib/easternTime'

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
  for (let i = 0; i < 400 && key <= endKey; i++) {
    days.push(key)
    key = nextNyDateKey(key)
  }
  return days
}

function serializeEntry(row: any) {
  return {
    id: row.id,
    scheduledDate: row.scheduledDate.toISOString().slice(0, 10),
    status: row.status,
    omissionReason: row.omissionReason,
    initialedByUserId: row.initialedByUserId,
    initialedByRole: row.initialedByRole,
    initialedByDisplayNameSnapshot: row.initialedByDisplayNameSnapshot,
    notes: row.notes,
  }
}

// Role-agnostic TAR grid + day-marking for one patient — backs the "TAR" tab
// (app/components/patient/PatientTreatmentTAR.tsx). Grid cells are computed
// on read from PatientTreatment left-joined against actual
// TreatmentAdministration rows, never pre-materialized, same as MAR.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId } = await params

  if (!(await canViewTreatmentAdministration(session, patientId))) {
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

  const [treatments, administrations] = await Promise.all([
    (prisma.patientTreatment.findMany as any)({
      where: { patientId, active: true },
      orderBy: { treatmentName: 'asc' },
    }),
    (prisma.treatmentAdministration.findMany as any)({
      where: {
        patientId,
        scheduledDate: { gte: dateKeyToUtcMidnight(startKey), lte: dateKeyToUtcMidnight(endKey) },
      },
    }),
  ])

  const lookup = new Map<string, any>()
  for (const row of administrations) {
    const dateKey = row.scheduledDate.toISOString().slice(0, 10)
    lookup.set(`${row.treatmentId}|${dateKey}`, row)
  }

  const result = treatments.map((t: any) => {
    const slots: Record<string, any> = {}
    for (const dateKey of days) {
      const row = lookup.get(`${t.id}|${dateKey}`)
      slots[dateKey] = row ? serializeEntry(row) : { status: 'pending', scheduledDate: dateKey }
    }
    return {
      id: t.id,
      treatmentName: t.treatmentName,
      instructions: t.instructions,
      frequency: t.frequency,
      slots,
    }
  })

  return NextResponse.json({ days, treatments: result })
}

// POST — initial a treatment for a day (body: { treatmentId, scheduledDate, status, omissionReason?, notes? }).
// Upserts on [treatmentId, scheduledDate] — clicking an empty or already-marked cell both hit this.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId } = await params

  if (!(await canDocumentTreatmentAdministration(session, patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const { treatmentId, scheduledDate, status, omissionReason, notes } = body

  if (!treatmentId || !scheduledDate || !DATE_KEY_RE.test(scheduledDate)) {
    return NextResponse.json({ error: 'treatmentId and scheduledDate (YYYY-MM-DD) are required' }, { status: 400 })
  }
  if (!['done', 'refused', 'omitted'].includes(status)) {
    return NextResponse.json({ error: 'status must be done, refused, or omitted' }, { status: 400 })
  }
  if (status !== 'done' && !omissionReason?.trim()) {
    return NextResponse.json({ error: 'A reason is required when refused or omitted' }, { status: 400 })
  }

  const treatment = await (prisma.patientTreatment.findUnique as any)({ where: { id: treatmentId }, select: { patientId: true } })
  if (!treatment || treatment.patientId !== patientId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const data = {
    status,
    omissionReason: status === 'done' ? null : omissionReason.trim(),
    initialedByUserId: session.id,
    initialedByRole: session.role,
    initialedByDisplayNameSnapshot: sessionDisplayName(session),
    notes: notes?.trim() || null,
  }

  const scheduledDateValue = dateKeyToUtcMidnight(scheduledDate)

  const entry = await (prisma.treatmentAdministration.upsert as any)({
    where: { treatmentId_scheduledDate: { treatmentId, scheduledDate: scheduledDateValue } },
    create: { treatmentId, patientId, scheduledDate: scheduledDateValue, ...data },
    update: data,
  })

  return NextResponse.json({ ok: true, entry: serializeEntry(entry) })
}
