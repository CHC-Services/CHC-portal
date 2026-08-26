import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { getQuickAccessIdentity } from '../../../../../../lib/nurseQuickAccess'
import { compileVoiceEntries } from '../../../../../../lib/bedrockClient'

function isEditableDraft(note: { authorUserId: string | null; signedAt: Date | null }, userId: string) {
  return note.authorUserId === userId && !note.signedAt
}

// Bedrock calls are typically fast, but add maxDuration defensively — anything
// that calls out to a third-party service can occasionally run past Vercel's
// default serverless timeout.
export const maxDuration = 30

// Micro-Charting's end-of-shift compile — ONE Bedrock call over every voice
// entry in this note together (never per-entry), so cross-entry references
// resolve correctly. Returns the compiled narrative plus extracted Vitals/
// Intake-Output rows — never writes any of it to the note itself; the
// client decides what to do with it (narrative: fill empty Shift Notes, or
// show a replace/append/discard choice if it already has content; rows:
// shown for review, merged into the existing tables only if she accepts).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getQuickAccessIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const note = await prisma.progressNote.findUnique({ where: { id } })
  if (!note || !isEditableDraft(note, identity.userId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const entries = await prisma.progressNoteVoiceEntry.findMany({
    where: { progressNoteId: id },
    orderBy: { recordedAt: 'asc' },
  })
  if (entries.length === 0) {
    return NextResponse.json({ error: 'No voice entries recorded yet for this note.' }, { status: 400 })
  }

  // Client sends its own IANA timeZone (Intl resolvedOptions) so the
  // compiled note's per-entry times match her device's clock, not the
  // server's — see compileVoiceEntries' own comment for why this matters.
  const body = await req.json().catch(() => ({}))
  const timeZone = typeof body?.timeZone === 'string' ? body.timeZone : undefined

  try {
    const result = await compileVoiceEntries(entries, timeZone)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[Micro-Charting compile error]', err)
    const detail = err?.message || 'Unknown error'
    return NextResponse.json({ error: `Compile failed: ${detail}` }, { status: 502 })
  }
}
