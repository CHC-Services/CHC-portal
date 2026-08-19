import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { uploadToS3, deleteFromS3, getPresignedDownloadUrl } from '../../../../lib/s3'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Current signature, as a short-lived presigned URL for display.
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await prisma.nurseProfile.findUnique({
    where: { id: session.nurseProfileId },
    select: { signatureImageKey: true },
  })

  if (!profile?.signatureImageKey) return NextResponse.json({ signatureUrl: null })

  const signatureUrl = await getPresignedDownloadUrl(profile.signatureImageKey, 900, { inline: true, contentType: 'image/png' })
  return NextResponse.json({ signatureUrl })
}

// Save/overwrite the nurse's current signature.
export async function POST(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { imageDataUrl } = await req.json()
  const match = typeof imageDataUrl === 'string' ? imageDataUrl.match(/^data:image\/png;base64,(.+)$/) : null
  if (!match) return NextResponse.json({ error: 'A valid PNG data URL is required' }, { status: 400 })

  const buffer = Buffer.from(match[1], 'base64')
  const key = `nurse-signatures/${session.nurseProfileId}/signature.png`
  await uploadToS3(key, buffer, 'image/png')

  const signedAt = new Date()
  await prisma.nurseProfile.update({
    where: { id: session.nurseProfileId },
    data: { signatureImageKey: key, signatureSavedAt: signedAt },
  })

  const signatureUrl = await getPresignedDownloadUrl(key, 900, { inline: true, contentType: 'image/png' })
  return NextResponse.json({ signatureUrl, signatureSavedAt: signedAt })
}

// Clear the current signature so the nurse can start fresh.
export async function DELETE(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await prisma.nurseProfile.findUnique({
    where: { id: session.nurseProfileId },
    select: { signatureImageKey: true },
  })

  if (profile?.signatureImageKey) {
    await deleteFromS3(profile.signatureImageKey).catch(() => {})
  }

  await prisma.nurseProfile.update({
    where: { id: session.nurseProfileId },
    data: { signatureImageKey: null, signatureSavedAt: null },
  })

  return NextResponse.json({ ok: true })
}
