import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { canViewAppointment, canCreateAppointment } from '../../../../lib/permissions'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'guardian') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const patientId = new URL(req.url).searchParams.get('patientId')
  if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 })

  if (!(await canViewAppointment(session, patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const appointments = await prisma.appointment.findMany({
    where: { patientId, status: { not: 'cancelled' } },
    orderBy: { startTime: 'asc' },
  })
  return NextResponse.json({ appointments })
}

// Families typically coordinate directly with physicians and arrange
// appointments — guardians get the same create authority as nurses/admin here.
export async function POST(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'guardian') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { patientId, title, location, provider, startTime, endTime, notes } = await req.json()
  if (!patientId || !title || !startTime) {
    return NextResponse.json({ error: 'patientId, title, and startTime are required' }, { status: 400 })
  }

  if (!(await canCreateAppointment(session, patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
      createdByRole: 'guardian',
    },
  })

  return NextResponse.json({ appointment })
}
