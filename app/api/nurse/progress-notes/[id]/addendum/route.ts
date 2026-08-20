import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canAddAddendum } from '../../../../../../lib/permissions'
import { copyS3Object, getPresignedDownloadUrl } from '../../../../../../lib/s3'
import { authorDisplayName } from '../../../../../../lib/progressNoteAuthor'
import { invalidateProgressNotePdf } from '../../../../../../lib/progressNotePdf'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// A late addendum from the original nurse author, appended to their own
// already-signed note — never alters the original note's text or signature.
// Composed and signed in one action (no separate draft state).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const note = await prisma.progressNote.findUnique({ where: { id } })
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canAddAddendum(session, note))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { text } = await req.json()
  const cleaned = typeof text === 'string' ? text.trim() : ''
  if (!cleaned) return NextResponse.json({ error: 'Addendum text is required' }, { status: 400 })

  const profile = await prisma.nurseProfile.findUnique({
    where: { id: session.nurseProfileId },
    select: { signatureImageKey: true },
  })
  if (!profile?.signatureImageKey) {
    return NextResponse.json({ error: 'No stored signature on file — add one on your profile page first', requiresSignatureSetup: true }, { status: 400 })
  }

  const addendumId = crypto.randomUUID()
  const signatureImageKey = `progress-notes/${id}/addenda/${addendumId}/signature.png`
  await copyS3Object(profile.signatureImageKey, signatureImageKey)

  const addendum = await prisma.progressNoteAddendum.create({
    data: {
      id: addendumId,
      progressNoteId: id,
      authorUserId: session.id,
      authorRole: 'nurse',
      text: cleaned,
      signatureImageKey,
    },
    include: { authorUser: { select: { name: true, nurseProfile: { select: { displayName: true } } } } },
  })

  await invalidateProgressNotePdf(id)

  const signatureUrl = await getPresignedDownloadUrl(signatureImageKey, 900, { inline: true, contentType: 'image/png' })

  return NextResponse.json({ addendum: { ...addendum, authorDisplayName: authorDisplayName(addendum), signatureUrl } })
}
