import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../../../lib/auth'
import { canEditShift, canAssignShift, canCancelShift } from '../../../../../../../../lib/permissions'
import {
  updateShiftAndSyncPendingHours,
  cancelSingleShift,
  capTemplateBeforeOccurrence,
  cancelFutureGeneratedShifts,
  materializeShiftTemplate,
  materializationHorizon,
  defaultActiveUntil,
} from '../../../../../../../../lib/shiftTemplates'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Occurrence-scoped edit/delete for a template-generated shift — the
// "this occurrence" / "this and future occurrences" half of the standard
// calendar-app edit pattern (Google Calendar/Outlook). "Entire series" needs
// no new code: it's just the existing PATCH/DELETE on the template itself
// (app/api/patient/[id]/shift-templates/[templateId]/route.ts) — the UI
// calls that directly rather than this route.
async function loadContext(patientId: string, templateId: string, shiftId: string) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!shift || shift.patientId !== patientId || shift.templateId !== templateId) return null
  const template = await ((prisma as any).shiftTemplate.findUnique)({ where: { id: templateId } })
  if (!template || template.patientId !== patientId) return null
  return { shift, template }
}

async function hasConfirmedPendingHour(shiftId: string): Promise<boolean> {
  const row = await (prisma.pendingHour.findFirst as any)({ where: { shiftId, status: 'confirmed' } })
  return !!row
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; templateId: string; shiftId: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId, templateId, shiftId } = await params

  const ctx = await loadContext(patientId, templateId, shiftId)
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { shift: existing, template } = ctx

  const scope = new URL(req.url).searchParams.get('scope')
  if (scope !== 'this' && scope !== 'future') {
    return NextResponse.json({ error: 'scope must be "this" or "future"' }, { status: 400 })
  }

  const body = await req.json()

  if (scope === 'this') {
    const isReassignment = 'nurseId' in body
    const authorized = isReassignment
      ? await canAssignShift(session, patientId)
      : await canEditShift(session, { patientId, nurseId: existing.nurseId })
    if (!authorized) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, any> = {}
    if ('nurseId' in body) data.nurseId = body.nurseId || null
    if ('startTime' in body) data.startTime = new Date(body.startTime)
    if ('endTime' in body) data.endTime = new Date(body.endTime)
    if ('notes' in body) data.notes = body.notes || null
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const shift = await updateShiftAndSyncPendingHours(shiftId, existing, data, session)
    if (!shift) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ shift })
  }

  // scope === 'future': a series split. Editing "this and future" doesn't
  // touch the old template's past occurrences at all — it ends the old
  // template the day before this one and spawns a new template (with the
  // edited fields) starting from this occurrence's date.
  if (!(await canEditShift(session, { patientId, nurseId: existing.nurseId }))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (existing.status === 'completed' || (await hasConfirmedPendingHour(shiftId))) {
    return NextResponse.json({ error: 'This occurrence is already confirmed and can’t be part of a bulk edit — edit it individually instead.' }, { status: 400 })
  }

  const { nurseId, label, startTimeOfDay, durationHours, notes } = body
  if (nurseId) {
    const link = await prisma.nursePatient.findUnique({ where: { nurseId_patientId: { nurseId, patientId } } })
    if (!link || !link.isActive) {
      return NextResponse.json({ error: 'That nurse is not authorized for this patient' }, { status: 400 })
    }
  }

  const originalActiveUntil = template.activeUntil
  await capTemplateBeforeOccurrence(templateId, existing.startTime)
  await cancelFutureGeneratedShifts(templateId, existing.startTime)

  const newTemplate = await ((prisma as any).shiftTemplate.create)({
    data: {
      id: crypto.randomUUID(),
      patientId,
      nurseId: 'nurseId' in body ? (nurseId || null) : template.nurseId,
      label: 'label' in body ? (label || null) : template.label,
      startTimeOfDay: startTimeOfDay || template.startTimeOfDay,
      durationHours: typeof durationHours === 'number' ? durationHours : template.durationHours,
      recurrence: template.recurrence,
      daysOfWeek: template.daysOfWeek,
      activeFrom: existing.startTime,
      activeUntil: originalActiveUntil || defaultActiveUntil(existing.startTime),
      notes: 'notes' in body ? (notes || null) : template.notes,
      createdByUserId: session.id,
      createdByRole: session.role,
    },
  })
  await materializeShiftTemplate(newTemplate, materializationHorizon())

  return NextResponse.json({ template: newTemplate })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; templateId: string; shiftId: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId, templateId, shiftId } = await params

  const ctx = await loadContext(patientId, templateId, shiftId)
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { shift: existing } = ctx

  const scope = new URL(req.url).searchParams.get('scope')
  if (scope !== 'this' && scope !== 'future') {
    return NextResponse.json({ error: 'scope must be "this" or "future"' }, { status: 400 })
  }

  if (!(await canCancelShift(session, { patientId, nurseId: existing.nurseId }))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (scope === 'this') {
    const shift = await cancelSingleShift(shiftId)
    if (!shift) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }

  if (existing.status === 'completed' || (await hasConfirmedPendingHour(shiftId))) {
    return NextResponse.json({ error: 'This occurrence is already confirmed and can’t be part of a bulk delete — delete it individually instead.' }, { status: 400 })
  }

  await capTemplateBeforeOccurrence(templateId, existing.startTime)
  await cancelFutureGeneratedShifts(templateId, existing.startTime)
  return NextResponse.json({ ok: true })
}
