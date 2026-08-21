import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canViewProgressNote } from '../../../../../../lib/permissions'
import { getOrCreateProgressNotePdf } from '../../../../../../lib/progressNotePdf'

// Puppeteer launching headless Chromium + rendering can run past Vercel's
// default serverless timeout — same reason app/api/admin/claims/import/route.ts
// needed this (requires Vercel Pro or higher).
export const maxDuration = 60

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Presigned download URL for a signed note's PDF packet (generates it if missing).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const note = await prisma.progressNote.findUnique({ where: { id }, select: { patientId: true, signedAt: true, authorUserId: true } })
  if (!note || !note.signedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Own-authorship stands in for the usual link requirement — see the
  // matching note in [id]/route.ts.
  const isOwnNote = note.authorUserId === session.id
  if (!isOwnNote && !(await canViewProgressNote(session, note.patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const { url } = await getOrCreateProgressNotePdf(id)
    return NextResponse.json({ url })
  } catch (err) {
    console.error(`Failed to generate PDF for progress note ${id}:`, err)
    return NextResponse.json({ error: 'Failed to generate PDF. Please try again.' }, { status: 500 })
  }
}
