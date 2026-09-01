import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { getQuickAccessIdentity } from '../../../../../../lib/nurseQuickAccess'
import { generateDraftProgressNotePdf } from '../../../../../../lib/progressNotePdf'

// Puppeteer launching headless Chromium + rendering can run past Vercel's
// default serverless timeout — same reasoning as the signed-note pdf routes.
export const maxDuration = 60

// Lets a nurse print/preview her note before signing it, once there's
// something worth reviewing — reuses the same HTML template as the final
// signed export (lib/progressNoteHtml.ts) but renders on demand, uncached,
// since draft content keeps changing right up until Sign. Once actually
// signed, the normal /progress-notes/[id]/pdf route (cached, requires a
// signature) takes over instead.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getQuickAccessIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const note = await prisma.progressNote.findUnique({ where: { id }, select: { authorUserId: true, signedAt: true } })
  if (!note || note.authorUserId !== identity.userId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (note.signedAt) return NextResponse.json({ error: 'This note is already signed — log in normally to print the signed copy instead.' }, { status: 400 })

  try {
    const pdfBuffer = await generateDraftProgressNotePdf(id)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="progress-note-draft.pdf"',
      },
    })
  } catch (err) {
    console.error(`Failed to generate draft PDF preview for progress note ${id}:`, err)
    return NextResponse.json({ error: 'Failed to generate preview. Please try again.' }, { status: 500 })
  }
}
