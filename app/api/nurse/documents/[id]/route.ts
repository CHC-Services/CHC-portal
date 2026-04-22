import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { getPresignedDownloadUrl } from '../../../../../lib/s3'

// GET /api/nurse/documents/[id] — returns a 15-minute presigned download URL
// Verifies the document belongs to the requesting nurse before issuing the URL
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.nurseProfile.findUnique({ where: { userId: session.id } })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { id } = await params
  const doc = await prisma.nurseDocument.findUnique({ where: { id } })

  // Ensure the document belongs to this nurse — no cross-access
  if (!doc || doc.nurseId !== profile.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const url = await getPresignedDownloadUrl(doc.storageKey, 900, {
    contentType: doc.mimeType || undefined,
    fileName: doc.fileName,
    inline: true,
  })
  return NextResponse.json({ url })
}
