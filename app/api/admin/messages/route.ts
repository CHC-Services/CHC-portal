import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const messages = await prisma.portalMessage.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(messages)
}

export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { title, body, category, audiences } = await req.json()
  if (!body?.trim()) {
    return NextResponse.json({ error: 'Message body is required.' }, { status: 400 })
  }

  const message = await prisma.portalMessage.create({
    data: {
      title: title?.trim() || null,
      body: body.trim(),
      category: category || 'General',
      audiences: Array.isArray(audiences) ? audiences : [],
      createdBy: session.id,
    },
  })

  return NextResponse.json(message, { status: 201 })
}
