import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { canViewSchedule, canCreateShift } from '../../../../../lib/permissions'
import { materializeShiftTemplate, materializationHorizon, defaultActiveUntil } from '../../../../../lib/shiftTemplates'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Recurring shift-generation rules for one patient — same admin/guardian-only
// authorization as one-off shifts (canCreateShift). Backs the Recurring
// Templates panel on app/patient/[id]/schedule.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId } = await params

  if (!(await canViewSchedule(session, patientId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const templates = await ((prisma as any).shiftTemplate.findMany)({
    where: { patientId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ templates })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId } = await params

  if (!(await canCreateShift(session, patientId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { nurseId, label, startTimeOfDay, durationHours, recurrence, daysOfWeek, activeFrom, activeUntil, notes } = await req.json()
  if (!startTimeOfDay || !durationHours || !recurrence || !activeFrom) {
    return NextResponse.json({ error: 'startTimeOfDay, durationHours, recurrence, and activeFrom are required' }, { status: 400 })
  }
  if (!['daily', 'weekly'].includes(recurrence)) {
    return NextResponse.json({ error: 'recurrence must be daily or weekly' }, { status: 400 })
  }
  if (recurrence === 'weekly' && (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0)) {
    return NextResponse.json({ error: 'daysOfWeek is required for weekly recurrence' }, { status: 400 })
  }

  // Integrity check, not an authorization check: whoever is being assigned
  // must actually be an authorized (active) nurse for this patient.
  if (nurseId) {
    const link = await prisma.nursePatient.findUnique({
      where: { nurseId_patientId: { nurseId, patientId } },
    })
    if (!link || !link.isActive) {
      return NextResponse.json({ error: 'That nurse is not authorized for this patient' }, { status: 400 })
    }
  }

  // No end date given → auto-cap at 4 months out rather than recurring
  // indefinitely (the daily materialization cron would otherwise keep
  // pushing an activeUntil-less template's horizon forward forever).
  const from = new Date(activeFrom)
  const resolvedActiveUntil = activeUntil ? new Date(activeUntil) : defaultActiveUntil(from)

  const template = await ((prisma as any).shiftTemplate.create)({
    data: {
      id: crypto.randomUUID(),
      patientId,
      nurseId: nurseId || null,
      label: label || null,
      startTimeOfDay,
      durationHours,
      recurrence,
      daysOfWeek: recurrence === 'weekly' ? daysOfWeek : [],
      activeFrom: from,
      activeUntil: resolvedActiveUntil,
      notes: notes || null,
      createdByUserId: session.id,
      createdByRole: session.role,
    },
  })

  // Materialize immediately so the admin/guardian sees generated shifts
  // right away instead of waiting for the next cron tick.
  await materializeShiftTemplate(template, materializationHorizon())

  return NextResponse.json({ template })
}
