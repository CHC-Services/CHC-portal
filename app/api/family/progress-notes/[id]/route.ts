import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { canViewProgressNote } from '../../../../../lib/permissions'
import { getPresignedDownloadUrl } from '../../../../../lib/s3'
import { authorDisplayName } from '../../../../../lib/progressNoteAuthor'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

const AUTHOR_SELECT = { select: { name: true, nurseProfile: { select: { displayName: true } } } } as const

// Signed, non-voided notes only — drafts are the author's private working copy.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'guardian') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const note = await prisma.progressNote.findUnique({
    where: { id },
    include: {
      vitals: { orderBy: { sortOrder: 'asc' } },
      intakeOutput: { orderBy: { sortOrder: 'asc' } },
      authorUser: AUTHOR_SELECT,
      addenda: { include: { authorUser: AUTHOR_SELECT }, orderBy: { signedAt: 'asc' } },
    },
  })
  if (!note || !note.signedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canViewProgressNote(session, note.patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const signatureUrl = note.signatureImageKey
    ? await getPresignedDownloadUrl(note.signatureImageKey, 900, { inline: true, contentType: 'image/png' })
    : null

  const addenda = await Promise.all(note.addenda.map(async a => ({
    ...a,
    authorDisplayName: authorDisplayName(a),
    signatureUrl: await getPresignedDownloadUrl(a.signatureImageKey, 900, { inline: true, contentType: 'image/png' }),
  })))

  return NextResponse.json({ note: { ...note, authorDisplayName: authorDisplayName(note), addenda }, signatureUrl })
}
