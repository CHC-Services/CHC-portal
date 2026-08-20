import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { getQuickAccessIdentity } from '../../../../../../lib/nurseQuickAccess'
import { copyS3Object } from '../../../../../../lib/s3'

// Locks the draft, reusing the nurse's already-stored NurseProfile
// signature — quick-access can *use* an existing signature but never create
// one (that stays an account-management action requiring real login).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getQuickAccessIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const note = await prisma.progressNote.findUnique({ where: { id } })
  if (!note || note.authorUserId !== identity.userId || note.signedAt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!note.shiftNotes || !note.shiftNotes.trim()) {
    return NextResponse.json({ error: 'Shift notes are required before signing' }, { status: 400 })
  }

  const profile = await prisma.nurseProfile.findUnique({
    where: { id: identity.nurseId },
    select: { signatureImageKey: true },
  })
  if (!profile?.signatureImageKey) {
    return NextResponse.json({ error: 'No stored signature on file — log in normally to set one up on your profile page first', requiresSignatureSetup: true }, { status: 400 })
  }

  const signatureImageKey = `progress-notes/${id}/signature.png`
  await copyS3Object(profile.signatureImageKey, signatureImageKey)

  const signed = await prisma.progressNote.update({
    where: { id },
    data: { signedAt: new Date(), signatureImageKey },
  })

  return NextResponse.json({ note: signed })
}
