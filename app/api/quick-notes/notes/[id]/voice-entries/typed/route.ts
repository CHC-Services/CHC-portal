import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { getQuickAccessIdentity } from '../../../../../../../lib/nurseQuickAccess'

function isEditableDraft(note: { authorUserId: string | null; signedAt: Date | null }, userId: string) {
  return note.authorUserId === userId && !note.signedAt
}

// Micro-Charting: adds a manually-typed entry alongside voice-recorded ones —
// same ProgressNoteVoiceEntry row shape (recordedAt @default(now())), just
// created directly with no audio/Transcribe Medical step. Compile treats it
// identically to a transcribed entry, since it reads every row for the note
// regardless of how each one was captured.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getQuickAccessIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const note = await prisma.progressNote.findUnique({ where: { id } })
  if (!note || !isEditableDraft(note, identity.userId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { rawText, entryType } = await req.json()
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return NextResponse.json({ error: 'rawText is required' }, { status: 400 })
  }

  const entry = await prisma.progressNoteVoiceEntry.create({
    data: { progressNoteId: id, rawText: rawText.trim(), entryType: entryType === 'arrival' ? 'arrival' : 'shift' },
  })

  return NextResponse.json({ entry })
}
