import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { canViewProgressNote } from '../../../../../lib/permissions'
import { getPresignedDownloadUrl } from '../../../../../lib/s3'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Signed, non-voided notes only — drafts are the nurse's private working copy.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'guardian') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const note = await prisma.progressNote.findUnique({
    where: { id },
    include: {
      vitals: { orderBy: { sortOrder: 'asc' } },
      intakeOutput: { orderBy: { sortOrder: 'asc' } },
      authorNurse: { select: { displayName: true } },
    },
  })
  if (!note || !note.signedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canViewProgressNote(session, note.patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const signatureUrl = note.signatureImageKey
    ? await getPresignedDownloadUrl(note.signatureImageKey, 900, { inline: true, contentType: 'image/png' })
    : null

  return NextResponse.json({ note, signatureUrl })
}
