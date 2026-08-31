import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canEditShift, canAssignShift, canCancelShift } from '../../../../../../lib/permissions'
import { reassignShiftPendingHours, releaseShiftPendingHours, regenerateScheduledPendingHours, cancelShiftPendingHours } from '../../../../../../lib/pendingHours'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; shiftId: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId, shiftId } = await params

  const existing = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!existing || existing.patientId !== patientId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Reassigning to a different nurse is an assignment action; everything else
  // (status/notes/times on an already-assigned shift) is a plain edit.
  const isReassignment = 'nurseId' in body
  const authorized = isReassignment
    ? await canAssignShift(session, patientId)
    : await canEditShift(session, { patientId, nurseId: existing.nurseId })
  if (!authorized) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: Record<string, any> = {}
  if ('nurseId' in body) data.nurseId = body.nurseId || null
  if ('startTime' in body) data.startTime = new Date(body.startTime)
  if ('endTime' in body) data.endTime = new Date(body.endTime)
  if ('status' in body) data.status = body.status
  if ('notes' in body) data.notes = body.notes || null

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if (data.nurseId) {
    const link = await prisma.nursePatient.findUnique({
      where: { nurseId_patientId: { nurseId: data.nurseId, patientId } },
    })
    if (!link || !link.isActive) {
      return NextResponse.json({ error: 'That nurse is not authorized for this patient' }, { status: 400 })
    }
  }

  const shift = await prisma.shift.update({ where: { id: shiftId }, data }).catch(() => null)
  if (!shift) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Keep Pending Hours in sync with whatever just changed (spec §10-13) —
  // unconfirmed rows only; anything already confirmed is never touched here.
  if (isReassignment) {
    if (shift.nurseId) {
      await reassignShiftPendingHours(shift, shift.nurseId, session.id)
    } else if (existing.nurseId) {
      await releaseShiftPendingHours(shiftId, existing.nurseId)
    }
  } else if ('startTime' in body || 'endTime' in body) {
    await regenerateScheduledPendingHours(shift)
  }

  return NextResponse.json({ shift })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; shiftId: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId, shiftId } = await params

  const existing = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!existing || existing.patientId !== patientId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!(await canCancelShift(session, { patientId, nurseId: existing.nurseId }))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const shift = await prisma.shift.update({ where: { id: shiftId }, data: { status: 'cancelled' } }).catch(() => null)
  if (!shift) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await cancelShiftPendingHours(shiftId)
  return NextResponse.json({ ok: true })
}
