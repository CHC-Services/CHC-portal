import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const latest = await (prisma.emailLog.findFirst as any)({
    orderBy: { sentAt: 'desc' },
    select: { id: true, sentAt: true, recipientName: true, subject: true, category: true, status: true },
  })

  return NextResponse.json(latest ?? null)
}
