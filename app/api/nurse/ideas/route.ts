import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { body } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Missing body' }, { status: 400 })

  const name = session.displayName || session.name || 'A provider'
  const fullBody = `[${name}] ${body.trim()}`

  await (prisma.adminIdea as any).create({
    data: { body: fullBody, category: 'Feedback' },
  })

  return NextResponse.json({ ok: true })
}
