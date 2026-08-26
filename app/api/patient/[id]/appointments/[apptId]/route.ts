import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canEditAppointment, canCancelAppointment } from '../../../../../../lib/permissions'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; apptId: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId, apptId } = await params

  const existing = await prisma.appointment.findUnique({ where: { id: apptId } })
  if (!existing || existing.patientId !== patientId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!(await canEditAppointment(session, patientId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const data: Record<string, any> = {}
  if ('title' in body) data.title = body.title
  if ('location' in body) data.location = body.location || null
  if ('provider' in body) data.provider = body.provider || null
  if ('startTime' in body) data.startTime = new Date(body.startTime)
  if ('endTime' in body) data.endTime = body.endTime ? new Date(body.endTime) : null
  if ('status' in body) data.status = body.status
  if ('notes' in body) data.notes = body.notes || null
  if ('allDay' in body) data.allDay = !!body.allDay
  if ('reminderChannel' in body && ['text', 'email', 'both', 'none'].includes(body.reminderChannel)) data.reminderChannel = body.reminderChannel

  // Reminders are replaced wholesale (delete-all-then-recreate) rather than
  // diffed — simplest correct approach for this small a child-row set.
  if ('reminders' in body && Array.isArray(body.reminders)) {
    const validReminders: number[] = body.reminders.filter((n: unknown) => typeof n === 'number' && n >= 0)
    data.reminders = {
      deleteMany: {},
      create: validReminders.map(offsetDays => ({ id: crypto.randomUUID(), offsetDays })),
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const appointment = await prisma.appointment.update({ where: { id: apptId }, data, include: { reminders: true } }).catch(() => null)
  if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ appointment })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; apptId: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId, apptId } = await params

  const existing = await prisma.appointment.findUnique({ where: { id: apptId } })
  if (!existing || existing.patientId !== patientId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!(await canCancelAppointment(session, patientId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Drop still-pending reminders too — nothing should fire for a cancelled
  // appointment. Already-sent ones (sentAt set) are left as history.
  const appointment = await prisma.appointment.update({
    where: { id: apptId },
    data: { status: 'cancelled', reminders: { deleteMany: { sentAt: null } } },
  }).catch(() => null)
  if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
