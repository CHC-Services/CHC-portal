import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canEditProgressNote } from '../../../../../../lib/permissions'
import { copyS3Object } from '../../../../../../lib/s3'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Lock an admin-authored draft note. Same shape as the nurse sign route, but
// sources the stored signature from User.signatureImageKey instead of
// NurseProfile.signatureImageKey.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const note = await prisma.progressNote.findUnique({ where: { id } })
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canEditProgressNote(session, note))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!note.shiftNotes || !note.shiftNotes.trim()) {
    return NextResponse.json({ error: 'Shift notes are required before signing' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { signatureImageKey: true, name: true },
  })
  if (!user?.signatureImageKey) {
    return NextResponse.json({ error: 'No stored signature on file — add one on your profile page first', requiresSignatureSetup: true }, { status: 400 })
  }

  const signatureImageKey = `progress-notes/${id}/signature.png`
  await copyS3Object(user.signatureImageKey, signatureImageKey)

  const signed = await prisma.progressNote.update({
    where: { id },
    data: { signedAt: new Date(), signatureImageKey, authorDisplayNameSnapshot: user.name },
  })

  return NextResponse.json({ note: signed })
}
