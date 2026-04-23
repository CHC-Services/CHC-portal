import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

export async function GET(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const commercialId = searchParams.get('commercialId')
  const medicaidId   = searchParams.get('medicaidId')

  if (!commercialId && !medicaidId) {
    return NextResponse.json({ error: 'commercialId or medicaidId required' }, { status: 400 })
  }

  const logs = await (prisma.claimAuditLog.findMany as any)({
    where: commercialId ? { commercialId } : { medicaidId },
    orderBy: { savedAt: 'desc' },
    take: 100,
  })

  return NextResponse.json(logs)
}
