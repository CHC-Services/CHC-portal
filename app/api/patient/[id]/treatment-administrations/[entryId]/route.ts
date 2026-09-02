import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canEditTreatmentAdministration } from '../../../../../../lib/permissions'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

function serializeEntry(row: any) {
  return {
    id: row.id,
    scheduledDate: row.scheduledDate.toISOString().slice(0, 10),
    status: row.status,
    omissionReason: row.omissionReason,
    initialedByUserId: row.initialedByUserId,
    initialedByRole: row.initialedByRole,
    initialedByDisplayNameSnapshot: row.initialedByDisplayNameSnapshot,
    notes: row.notes,
  }
}

async function loadEntry(patientId: string, entryId: string) {
  const entry = await (prisma.treatmentAdministration.findUnique as any)({ where: { id: entryId } })
  if (!entry || entry.patientId !== patientId) return null
  return entry
}

// Correct or remove a single TAR entry. Gated by canEditTreatmentAdministration
// (whoever initialed it, or admin) — narrower than canDocumentTreatmentAdministration,
// since fixing an existing entry is a narrower action than creating one.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId, entryId } = await params

  const existing = await loadEntry(patientId, entryId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canEditTreatmentAdministration(session, existing))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { status, omissionReason, notes } = await req.json()
  const data: Record<string, any> = {}

  if (status !== undefined) {
    if (!['done', 'refused', 'omitted'].includes(status)) {
      return NextResponse.json({ error: 'status must be done, refused, or omitted' }, { status: 400 })
    }
    const effectiveReason = omissionReason !== undefined ? omissionReason : existing.omissionReason
    if (status !== 'done' && !effectiveReason?.trim()) {
      return NextResponse.json({ error: 'A reason is required when refused or omitted' }, { status: 400 })
    }
    data.status = status
    data.omissionReason = status === 'done' ? null : effectiveReason.trim()
  } else if (omissionReason !== undefined) {
    data.omissionReason = omissionReason?.trim() || null
  }
  if (notes !== undefined) data.notes = notes?.trim() || null

  const entry = await (prisma.treatmentAdministration.update as any)({ where: { id: entryId }, data })
  return NextResponse.json({ ok: true, entry: serializeEntry(entry) })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId, entryId } = await params

  const existing = await loadEntry(patientId, entryId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canEditTreatmentAdministration(session, existing))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await (prisma.treatmentAdministration.delete as any)({ where: { id: entryId } })
  return NextResponse.json({ ok: true })
}
