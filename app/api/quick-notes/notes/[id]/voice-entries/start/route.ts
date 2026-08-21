import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { getQuickAccessIdentity } from '../../../../../../../lib/nurseQuickAccess'
import { startTranscription } from '../../../../../../../lib/awsTranscribe'

// Same draft-only, own-notes-only rule as every other quick-notes route on
// this progress note — a signed note 404s here.
function isEditableDraft(note: { authorUserId: string | null; signedAt: Date | null }, userId: string) {
  return note.authorUserId === userId && !note.signedAt
}

// Micro-Charting: uploads one recorded voice-entry clip and starts its
// Transcribe Medical job. Returns immediately with a jobId — the client
// polls .../voice-entries/status/[jobId] for the transcribed result.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getQuickAccessIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const note = await prisma.progressNote.findUnique({ where: { id } })
  if (!note || !isEditableDraft(note, identity.userId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const formData = await req.formData()
  const audio = formData.get('audio') as File | null
  if (!audio) return NextResponse.json({ error: 'No audio provided' }, { status: 400 })

  const buffer = Buffer.from(await audio.arrayBuffer())
  const { jobId } = await startTranscription(buffer, audio.type || 'audio/webm')

  return NextResponse.json({ jobId })
}
