import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'admin') return null
  return session
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { completed, body, category } = await req.json()
  const data: Record<string, unknown> = {}
  if (completed !== undefined) data.completed = completed
  if (body !== undefined) data.body = body
  if (category !== undefined) data.category = category
  const idea = await prisma.adminIdea.update({ where: { id }, data })
  return NextResponse.json({ idea })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.adminIdea.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
