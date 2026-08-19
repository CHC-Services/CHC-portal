import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { uploadToS3, deleteFromS3, getPresignedDownloadUrl } from '../../../../lib/s3'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Admin's own stored e-signature — mirrors /api/nurse/signature exactly, but
// reads/writes User.signatureImageKey directly off session.id (no
// NurseProfile indirection, since admin accounts don't have one).

// Current signature, as a short-lived presigned URL for display.
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { signatureImageKey: true },
  })

  if (!user?.signatureImageKey) return NextResponse.json({ signatureUrl: null })

  const signatureUrl = await getPresignedDownloadUrl(user.signatureImageKey, 900, { inline: true, contentType: 'image/png' })
  return NextResponse.json({ signatureUrl })
}

// Save/overwrite admin's current signature.
export async function POST(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { imageDataUrl } = await req.json()
  const match = typeof imageDataUrl === 'string' ? imageDataUrl.match(/^data:image\/png;base64,(.+)$/) : null
  if (!match) return NextResponse.json({ error: 'A valid PNG data URL is required' }, { status: 400 })

  const buffer = Buffer.from(match[1], 'base64')
  const key = `admin-signatures/${session.id}/signature.png`
  await uploadToS3(key, buffer, 'image/png')

  const signedAt = new Date()
  await prisma.user.update({
    where: { id: session.id },
    data: { signatureImageKey: key, signatureSavedAt: signedAt },
  })

  const signatureUrl = await getPresignedDownloadUrl(key, 900, { inline: true, contentType: 'image/png' })
  return NextResponse.json({ signatureUrl, signatureSavedAt: signedAt })
}

// Clear the current signature so admin can start fresh.
export async function DELETE(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { signatureImageKey: true },
  })

  if (user?.signatureImageKey) {
    await deleteFromS3(user.signatureImageKey).catch(() => {})
  }

  await prisma.user.update({
    where: { id: session.id },
    data: { signatureImageKey: null, signatureSavedAt: null },
  })

  return NextResponse.json({ ok: true })
}
