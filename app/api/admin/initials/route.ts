import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { uploadToS3, deleteFromS3, getPresignedDownloadUrl } from '../../../../lib/s3'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Admin's own stored e-initial — mirrors /api/admin/signature exactly, but
// reads/writes User.initialsImageKey directly off session.id (no
// NurseProfile indirection, since admin accounts don't have one).

// Current initials, as a short-lived presigned URL for display.
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { initialsImageKey: true },
  })

  if (!user?.initialsImageKey) return NextResponse.json({ initialsUrl: null })

  const initialsUrl = await getPresignedDownloadUrl(user.initialsImageKey, 900, { inline: true, contentType: 'image/png' })
  return NextResponse.json({ initialsUrl })
}

// Save/overwrite admin's current initials.
export async function POST(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { imageDataUrl } = await req.json()
  const match = typeof imageDataUrl === 'string' ? imageDataUrl.match(/^data:image\/png;base64,(.+)$/) : null
  if (!match) return NextResponse.json({ error: 'A valid PNG data URL is required' }, { status: 400 })

  const buffer = Buffer.from(match[1], 'base64')
  const key = `admin-initials/${session.id}/initials.png`
  await uploadToS3(key, buffer, 'image/png')

  const savedAt = new Date()
  await prisma.user.update({
    where: { id: session.id },
    data: { initialsImageKey: key, initialsSavedAt: savedAt },
  })

  const initialsUrl = await getPresignedDownloadUrl(key, 900, { inline: true, contentType: 'image/png' })
  return NextResponse.json({ initialsUrl, initialsSavedAt: savedAt })
}

// Clear the current initials so admin can start fresh.
export async function DELETE(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { initialsImageKey: true },
  })

  if (user?.initialsImageKey) {
    await deleteFromS3(user.initialsImageKey).catch(() => {})
  }

  await prisma.user.update({
    where: { id: session.id },
    data: { initialsImageKey: null, initialsSavedAt: null },
  })

  return NextResponse.json({ ok: true })
}
