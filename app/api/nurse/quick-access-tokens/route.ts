import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { generateQuickAccessToken, hashQuickAccessToken } from '../../../../lib/nurseQuickAccess'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// List this nurse's quick-access shortcuts (metadata only — never the token itself).
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tokens = await prisma.nurseQuickAccessToken.findMany({
    where: { nurseId: session.nurseProfileId },
    select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true, revokedAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ tokens })
}

// Issue a new shortcut — the plaintext token is returned exactly once here
// and never stored or retrievable again.
export async function POST(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { deviceLabel } = await req.json()
  const label = typeof deviceLabel === 'string' ? deviceLabel.trim() : ''
  if (!label) return NextResponse.json({ error: 'deviceLabel required' }, { status: 400 })

  const token = generateQuickAccessToken()
  await prisma.nurseQuickAccessToken.create({
    data: { nurseId: session.nurseProfileId, tokenHash: hashQuickAccessToken(token), deviceLabel: label },
  })

  return NextResponse.json({ token })
}
