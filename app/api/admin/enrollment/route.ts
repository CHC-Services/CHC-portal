import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const nurses = await (prisma.nurseProfile as any).findMany({
    where: { isDemo: false },
    include: {
      user: { select: { id: true, email: true, role: true, createdAt: true, lastLoginAt: true } },
    },
    orderBy: { displayName: 'asc' },
  })

  return NextResponse.json(nurses)
}
