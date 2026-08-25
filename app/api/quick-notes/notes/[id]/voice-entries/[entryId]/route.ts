import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { getQuickAccessIdentity } from '../../../../../../../lib/nurseQuickAccess'

function isEditableDraft(note: { authorUserId: string | null; signedAt: Date | null }, userId: string) {
  return note.authorUserId === userId && !note.signedAt
}

// Fixes a transcription error in one voice entry's text (e.g. one wrong
// word) without having to re-record the whole clip.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const identity = await getQuickAccessIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, entryId } = await params

  const note = await prisma.progressNote.findUnique({ where: { id } })
  if (!note || !isEditableDraft(note, identity.userId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const entry = await prisma.progressNoteVoiceEntry.findUnique({ where: { id: entryId } })
  if (!entry || entry.progressNoteId !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { rawText } = await req.json()
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return NextResponse.json({ error: 'rawText is required' }, { status: 400 })
  }

  const updated = await prisma.progressNoteVoiceEntry.update({ where: { id: entryId }, data: { rawText } })
  return NextResponse.json({ entry: updated })
}

// Removes one mis-transcribed voice entry (e.g. a bad recording she wants
// to redo) before it's ever included in a compile.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const identity = await getQuickAccessIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, entryId } = await params

  const note = await prisma.progressNote.findUnique({ where: { id } })
  if (!note || !isEditableDraft(note, identity.userId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const entry = await prisma.progressNoteVoiceEntry.findUnique({ where: { id: entryId } })
  if (!entry || entry.progressNoteId !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.progressNoteVoiceEntry.delete({ where: { id: entryId } })
  return NextResponse.json({ ok: true })
}
