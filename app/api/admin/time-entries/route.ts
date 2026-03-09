import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// GET all time entries across all nurses
export async function GET(req: Request) {
  if (!adminOnly(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const entries = await (prisma.timeEntry.findMany as any)({
    orderBy: [{ billed: 'asc' }, { workDate: 'desc' }],
    include: {
      nurse: {
        select: { displayName: true, accountNumber: true }
      }
    }
  })

  return NextResponse.json(entries)
}

// PATCH a single entry to mark/unmark as billed
export async function PATCH(req: Request) {
  if (!adminOnly(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, billed } = await req.json() as { id: string; billed: boolean }

  await (prisma.timeEntry.update as any)({
    where: { id },
    data: { billed }
  })

  return NextResponse.json({ ok: true })
}
