import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { canEditAppointment, canCancelAppointment } from '../../../../../lib/permissions'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const appointment = await prisma.appointment.findUnique({ where: { id } })
  if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canEditAppointment(session, appointment.patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const data: Record<string, any> = {}
  if ('title' in body) data.title = body.title
  if ('location' in body) data.location = body.location || null
  if ('provider' in body) data.provider = body.provider || null
  if ('startTime' in body) data.startTime = new Date(body.startTime)
  if ('endTime' in body) data.endTime = body.endTime ? new Date(body.endTime) : null
  if ('status' in body) data.status = body.status
  if ('notes' in body) data.notes = body.notes || null

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const updated = await prisma.appointment.update({ where: { id }, data })
  return NextResponse.json({ appointment: updated })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const appointment = await prisma.appointment.findUnique({ where: { id } })
  if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canCancelAppointment(session, appointment.patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.appointment.update({ where: { id }, data: { status: 'cancelled' } })
  return NextResponse.json({ ok: true })
}
