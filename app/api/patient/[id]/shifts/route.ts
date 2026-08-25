import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { canViewSchedule, canCreateShift } from '../../../../../lib/permissions'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Role-agnostic shift CRUD for one patient — backs app/patient/[id]/schedule.
// Unlike the older per-role /api/{admin,family,nurse}/shifts endpoints (kept
// as-is, still used elsewhere), this one is scoped to a single patientId from
// the URL and defers entirely to lib/permissions.ts for who can do what.
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

  return NextResponse.json({ shift })
}
