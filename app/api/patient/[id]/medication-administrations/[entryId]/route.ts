import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canEditMedicationAdministration, canDocumentMedicationAdministration } from '../../../../../../lib/permissions'
import { sessionDisplayName, resolveAdministeredByActor } from '../../../../../../lib/medicationAdministrationActor'
import { easternTimeOfDayUtc } from '../../../../../../lib/easternTime'

const TIME_OF_DAY_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

function resolveAdministeredAt(scheduledDate: string, administeredTimeOfDay: string | undefined | null): Date | undefined {
  if (administeredTimeOfDay === undefined) return undefined
  if (!administeredTimeOfDay) return new Date()
  const match = TIME_OF_DAY_RE.exec(administeredTimeOfDay)
  if (!match) return new Date()
  return easternTimeOfDayUtc(scheduledDate, Number(match[1]), Number(match[2]))
}

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

function serializeEntry(row: any) {
  return {
    id: row.id,
    scheduledDate: row.scheduledDate.toISOString().slice(0, 10),
    scheduledTimeOfDay: row.scheduledTimeOfDay,
    status: row.status,
    omissionReason: row.omissionReason,
    administeredByUserId: row.administeredByUserId,
    administeredByRole: row.administeredByRole,
    administeredByDisplayNameSnapshot: row.administeredByDisplayNameSnapshot,
    administeredAt: row.administeredAt,
    documentedByUserId: row.documentedByUserId,
    documentedByRole: row.documentedByRole,
    documentedByDisplayNameSnapshot: row.documentedByDisplayNameSnapshot,
    notes: row.notes,
  }
}

async function loadEntry(patientId: string, entryId: string) {
  const entry = await (prisma.medicationAdministration.findUnique as any)({ where: { id: entryId } })
  if (!entry || entry.patientId !== patientId) return null
  return entry
}

// Correct or remove a single MAR entry. Gated by canEditMedicationAdministration
// (whoever documented it, or admin) — not the broader canDocumentMedicationAdministration,
// since fixing an existing entry is a narrower action than creating one.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId, entryId } = await params

  const existing = await loadEntry(patientId, entryId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canEditMedicationAdministration(session, existing))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const { status, administeredByUserId: rawAdministeredBy, administeredTimeOfDay, omissionReason, notes } = body

  const data: Record<string, any> = {}

  if (status !== undefined) {
    if (!['given', 'refused', 'omitted'].includes(status)) {
      return NextResponse.json({ error: 'status must be given, refused, or omitted' }, { status: 400 })
    }
    const effectiveReason = omissionReason !== undefined ? omissionReason : existing.omissionReason
    if (status !== 'given' && !effectiveReason?.trim()) {
      return NextResponse.json({ error: 'A reason is required when refused or omitted' }, { status: 400 })
    }
    data.status = status
    data.omissionReason = status === 'given' ? null : effectiveReason.trim()
  } else if (omissionReason !== undefined) {
    data.omissionReason = omissionReason?.trim() || null
  }

  if (rawAdministeredBy !== undefined) {
    const administeredByUserId = rawAdministeredBy || session.id
    if (!(await canDocumentMedicationAdministration(session, patientId, administeredByUserId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (administeredByUserId === session.id) {
      data.administeredByUserId = administeredByUserId
      data.administeredByRole = session.role
      data.administeredByDisplayNameSnapshot = sessionDisplayName(session)
    } else {
      const actor = await resolveAdministeredByActor(administeredByUserId, patientId)
      if (!actor) return NextResponse.json({ error: 'That person is not linked to this patient' }, { status: 400 })
      data.administeredByUserId = administeredByUserId
      data.administeredByRole = actor.role
      data.administeredByDisplayNameSnapshot = actor.displayName
    }
  }

  if (administeredTimeOfDay !== undefined) {
    const scheduledDateKey = existing.scheduledDate.toISOString().slice(0, 10)
    data.administeredAt = resolveAdministeredAt(scheduledDateKey, administeredTimeOfDay)
  }
  if (notes !== undefined) data.notes = notes?.trim() || null

  const entry = await (prisma.medicationAdministration.update as any)({ where: { id: entryId }, data })
  return NextResponse.json({ ok: true, entry: serializeEntry(entry) })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId, entryId } = await params

  const existing = await loadEntry(patientId, entryId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canEditMedicationAdministration(session, existing))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await (prisma.medicationAdministration.delete as any)({ where: { id: entryId } })
  return NextResponse.json({ ok: true })
}
