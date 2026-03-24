import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'admin') return null
  return session
}

export async function GET(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ideas = await prisma.adminIdea.findMany({
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json({ ideas })
}

export async function POST(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { body, category } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Body required' }, { status: 400 })
  const idea = await prisma.adminIdea.create({
    data: { body: body.trim(), category: category?.trim() || 'Task' }
  })
  return NextResponse.json({ idea })
}
