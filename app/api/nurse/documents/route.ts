import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.nurseProfile.findUnique({ where: { userId: session.id } })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const documents = await prisma.nurseDocument.findMany({
    where: { nurseId: profile.id, OR: [{ visibleToNurse: true }, { nurseUploaded: true }] },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      fileName: true,
      category: true,
      fileSize: true,
      mimeType: true,
      expiresAt: true,
      createdAt: true,
      claimId: true,
      // storageKey intentionally excluded — never sent to client
    },
  })

  return NextResponse.json({ documents })
}
