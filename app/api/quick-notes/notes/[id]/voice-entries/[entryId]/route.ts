import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { getQuickAccessIdentity } from '../../../../../../../lib/nurseQuickAccess'

function isEditableDraft(note: { authorUserId: string | null; signedAt: Date | null }, userId: string) {
  return note.authorUserId === userId && !note.signedAt
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
