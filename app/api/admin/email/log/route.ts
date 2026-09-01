import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const channel = searchParams.get('channel') === 'sms' ? 'sms' : 'email'
  const category = searchParams.get('category') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = 50
  const where = category ? { category } : {}

  if (channel === 'sms') {
    const [rows, total] = await Promise.all([
      (prisma.smsLog.findMany as any)({
        where,
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, sentAt: true, recipientName: true, recipientPhone: true, category: true, message: true, status: true },
      }),
      (prisma.smsLog.count as any)({ where }),
    ])
    // Normalized to the same shape the page already renders for email.
    const logs = rows.map((r: any) => ({
      id: r.id, sentAt: r.sentAt, recipientName: r.recipientName, recipientEmail: r.recipientPhone,
      category: r.category, subject: r.message, status: r.status,
    }))
    return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) })
  }

  const [logs, total] = await Promise.all([
    (prisma.emailLog.findMany as any)({
      where,
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, sentAt: true, recipientName: true, recipientEmail: true, category: true, subject: true, status: true },
    }),
    (prisma.emailLog.count as any)({ where }),
  ])

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) })
}
