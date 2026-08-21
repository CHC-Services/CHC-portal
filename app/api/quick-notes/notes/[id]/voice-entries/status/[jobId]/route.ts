import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../../lib/prisma'
import { getQuickAccessIdentity } from '../../../../../../../../lib/nurseQuickAccess'
import { checkTranscription } from '../../../../../../../../lib/awsTranscribe'

function isEditableDraft(note: { authorUserId: string | null; signedAt: Date | null }, userId: string) {
  return note.authorUserId === userId && !note.signedAt
}

// Micro-Charting: the client polls this every ~2s after starting a
// transcription job. On COMPLETED, this is the moment the entry actually
// gets durably saved — nothing is held client-side waiting for a later
// bulk action.
export async function GET(req: Request, { params }: { params: Promise<{ id: string; jobId: string }> }) {
  const identity = await getQuickAccessIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, jobId } = await params

  const note = await prisma.progressNote.findUnique({ where: { id } })
  if (!note || !isEditableDraft(note, identity.userId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const result = await checkTranscription(jobId)

  if (result.status === 'IN_PROGRESS') {
    return NextResponse.json({ status: 'IN_PROGRESS' })
  }

  if (result.status === 'FAILED') {
    return NextResponse.json({ status: 'FAILED', error: "Didn't catch that — try again." })
  }

  const entry = await prisma.progressNoteVoiceEntry.create({
    data: { progressNoteId: id, rawText: result.text },
  })

  return NextResponse.json({ status: 'COMPLETED', entry })
}
