import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canCreateShift } from '../../../../../../lib/permissions'
import { materializeShiftTemplate, materializationHorizon, cancelFutureGeneratedShifts } from '../../../../../../lib/shiftTemplates'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; templateId: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId, templateId } = await params

  const existing = await ((prisma as any).shiftTemplate.findUnique)({ where: { id: templateId } })
  if (!existing || existing.patientId !== patientId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Same admin/guardian-only authority as originating the template in the
  // first place — no separate canEditShiftTemplate needed.
  if (!(await canCreateShift(session, patientId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const data: Record<string, any> = {}
  if ('nurseId' in body) data.nurseId = body.nurseId || null
  if ('label' in body) data.label = body.label || null
  if ('startTimeOfDay' in body) data.startTimeOfDay = body.startTimeOfDay
  if ('durationHours' in body) data.durationHours = body.durationHours
  if ('recurrence' in body) data.recurrence = body.recurrence
  if ('daysOfWeek' in body) data.daysOfWeek = body.daysOfWeek
  if ('activeFrom' in body) data.activeFrom = new Date(body.activeFrom)
  if ('activeUntil' in body) data.activeUntil = body.activeUntil ? new Date(body.activeUntil) : null
  if ('notes' in body) data.notes = body.notes || null
  if ('isActive' in body) data.isActive = body.isActive

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

  const template = await ((prisma as any).shiftTemplate.update)({ where: { id: templateId }, data }).catch(() => null)
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Re-materialize forward — covers a newly-extended activeUntil, a widened
  // daysOfWeek, or a reactivated template. Does nothing retroactive if the
  // range shrank; see materializeShiftTemplate's own comment.
  if (template.isActive) {
    await materializeShiftTemplate(template, materializationHorizon())
  }

  return NextResponse.json({ template })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; templateId: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId, templateId } = await params

  const existing = await ((prisma as any).shiftTemplate.findUnique)({ where: { id: templateId } })
  if (!existing || existing.patientId !== patientId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!(await canCreateShift(session, patientId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Cancel this template's own future, not-yet-worked generated shifts —
  // leave past/completed ones as real history. Routed through
  // cancelFutureGeneratedShifts (not a bare updateMany) so each shift goes
  // through cancelSingleShift — releases its Pending Hours the same way any
  // other cancel path does, and (if it had a nurse assigned) triggers the
  // coverage-need re-materialization that reopens the gap immediately.
  await cancelFutureGeneratedShifts(templateId, new Date())

  // A genuine delete, not the Pause button's isActive:false toggle — those
  // were previously identical (the only distinction was this cancellation
  // side effect), which read as "Delete doesn't actually erase anything."
  // Shift.templateId is nullable with onDelete: SetNull, so already-
  // generated shifts (including the just-cancelled future ones and any past/
  // completed history) simply lose their template link, not get deleted.
  await ((prisma as any).shiftTemplate.delete)({ where: { id: templateId } })

  return NextResponse.json({ ok: true })
}
