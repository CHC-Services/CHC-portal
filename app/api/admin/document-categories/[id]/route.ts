import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// PATCH /api/admin/document-categories/[id] — rename a category
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { name } = await req.json() as { name?: string }
  const trimmed = name?.trim()
  if (!trimmed) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  try {
    const category = await prisma.documentCategory.update({ where: { id }, data: { name: trimmed } })
    return NextResponse.json({ ok: true, category })
  } catch {
    return NextResponse.json({ error: 'Name already in use' }, { status: 409 })
  }
}

// DELETE /api/admin/document-categories/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  await prisma.documentCategory.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
