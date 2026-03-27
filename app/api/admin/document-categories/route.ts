import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET /api/admin/document-categories — list all categories sorted alphabetically
export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const categories = await prisma.documentCategory.findMany({
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ categories })
}

// POST /api/admin/document-categories — create a new category
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name } = await req.json() as { name?: string }
  const trimmed = name?.trim()
  if (!trimmed) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  try {
    const category = await prisma.documentCategory.create({ data: { name: trimmed } })
    return NextResponse.json({ ok: true, category })
  } catch {
    return NextResponse.json({ error: 'Category already exists' }, { status: 409 })
  }
}
