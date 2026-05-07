import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

export async function GET(req: Request) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const patients = await (prisma.patient.findMany as any)({
    include: {
      nurseLinks: {
        include: {
          nurse: { select: { id: true, displayName: true, accountNumber: true } },
        },
      },
      _count: { select: { timeEntries: true } },
    },
    orderBy: { accountNumber: 'asc' },
  })

  return NextResponse.json({ patients })
}
