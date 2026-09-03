import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { uploadToS3, deleteFromS3, getPresignedDownloadUrl } from '../../../../lib/s3'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Mirrors /api/nurse/signature exactly — a short drawn initial instead of a
// full signature, for MAR/TAR grid cells.

// Current initials, as a short-lived presigned URL for display.
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await prisma.nurseProfile.findUnique({
    where: { id: session.nurseProfileId },
    select: { initialsImageKey: true },
  })

  if (!profile?.initialsImageKey) return NextResponse.json({ initialsUrl: null })

  const initialsUrl = await getPresignedDownloadUrl(profile.initialsImageKey, 900, { inline: true, contentType: 'image/png' })
  return NextResponse.json({ initialsUrl })
}

// Save/overwrite the nurse's current initials.
export async function POST(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { imageDataUrl } = await req.json()
  const match = typeof imageDataUrl === 'string' ? imageDataUrl.match(/^data:image\/png;base64,(.+)$/) : null
  if (!match) return NextResponse.json({ error: 'A valid PNG data URL is required' }, { status: 400 })

  const buffer = Buffer.from(match[1], 'base64')
  const key = `nurse-initials/${session.nurseProfileId}/initials.png`
  await uploadToS3(key, buffer, 'image/png')

  const savedAt = new Date()
  await prisma.nurseProfile.update({
    where: { id: session.nurseProfileId },
    data: { initialsImageKey: key, initialsSavedAt: savedAt },
  })

  const initialsUrl = await getPresignedDownloadUrl(key, 900, { inline: true, contentType: 'image/png' })
  return NextResponse.json({ initialsUrl, initialsSavedAt: savedAt })
}

// Clear the current initials so the nurse can start fresh.
export async function DELETE(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await prisma.nurseProfile.findUnique({
    where: { id: session.nurseProfileId },
    select: { initialsImageKey: true },
  })

  if (profile?.initialsImageKey) {
    await deleteFromS3(profile.initialsImageKey).catch(() => {})
  }

  await prisma.nurseProfile.update({
    where: { id: session.nurseProfileId },
    data: { initialsImageKey: null, initialsSavedAt: null },
  })

  return NextResponse.json({ ok: true })
}
