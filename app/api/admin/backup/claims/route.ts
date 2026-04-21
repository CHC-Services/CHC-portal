import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// GET — list all backups (metadata only, no snapshot payload)
export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const backups = await prisma.claimBackup.findMany({
    select: { id: true, label: true, claimCount: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(backups)
}

// POST — create a new snapshot (label defaults to 'manual')
export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const label: string = body.label === 'auto' ? 'auto' : 'manual'

  const claims = await prisma.claim.findMany({ orderBy: { createdAt: 'asc' } })

  const backup = await prisma.claimBackup.create({
    data: {
      label,
      claimCount: claims.length,
      snapshot: claims as object,
    },
    select: { id: true, label: true, claimCount: true, createdAt: true },
  })

  return NextResponse.json(backup)
}
