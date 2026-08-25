import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { canViewAppointment, canCreateAppointment } from '../../../../../lib/permissions'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Role-agnostic appointment CRUD for one patient — backs
// app/patient/[id]/appointment. See shifts/route.ts for why this exists
// alongside the older per-role appointment endpoints.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId } = await params

  if (!(await canViewAppointment(session, patientId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const appointments = await prisma.appointment.findMany({
    where: { patientId, status: { not: 'cancelled' } },
    orderBy: { startTime: 'asc' },
  })
  return NextResponse.json({ appointments })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId } = await params

  if (!(await canCreateAppointment(session, patientId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { title, location, provider, startTime, endTime, notes } = await req.json()
  if (!title || !startTime) {
    return NextResponse.json({ error: 'title and startTime are required' }, { status: 400 })
  }

  const appointment = await prisma.appointment.create({
    data: {
      id: crypto.randomUUID(),
      patientId,
      title,
      location: location || null,
      provider: provider || null,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : null,
      notes: notes || null,
      createdByUserId: session.id,
      createdByRole: session.role,
    },
  })

  return NextResponse.json({ appointment })
}
