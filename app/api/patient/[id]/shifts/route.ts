import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { canViewSchedule, canCreateShift } from '../../../../../lib/permissions'
import { generatePendingHoursForShift } from '../../../../../lib/pendingHours'
import { reconcileNewShift } from '../../../../../lib/shiftReconciliation'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Role-agnostic shift CRUD for one patient — backs app/patient/[id]/schedule.
// The older per-role /api/{admin,family,nurse}/shifts endpoints this
// superseded were confirmed to have zero remaining callers and removed
// 2026-08-30. This one is scoped to a single patientId from the URL and
// defers entirely to lib/permissions.ts for who can do what.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId } = await params

  if (!(await canViewSchedule(session, patientId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const shifts = await prisma.shift.findMany({
    where: { patientId, status: { not: 'cancelled' } },
    orderBy: { startTime: 'asc' },
  })
  return NextResponse.json({ shifts })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId } = await params

  if (!(await canCreateShift(session, patientId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { nurseId, startTime, endTime, notes } = await req.json()
  if (!startTime || !endTime) {
    return NextResponse.json({ error: 'startTime and endTime are required' }, { status: 400 })
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

  const shift = await prisma.shift.create({
    data: {
      id: crypto.randomUUID(),
      patientId,
      nurseId: nurseId || null,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status: nurseId ? 'assigned' : 'open',
      notes: notes || null,
      createdByUserId: session.id,
      createdByRole: session.role,
    },
  })

  // A shift created pre-assigned already has an expected nurse — generate
  // her Pending Hours immediately rather than waiting for a later PATCH.
  // An open/unassigned shift gets its Pending Hours once someone claims or
  // is assigned to it (see the PATCH route).
  if (shift.nurseId) await generatePendingHoursForShift(shift, shift.nurseId)

  // Carve into (if assigned) or trim against (if open) any other shifts on
  // this patient it overlaps — see lib/shiftReconciliation.ts.
  await reconcileNewShift(shift)

  return NextResponse.json({ shift })
}
