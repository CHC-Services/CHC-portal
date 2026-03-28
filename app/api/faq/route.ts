import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyToken } from '../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Public: return published items. Admins also see unpublished ones.
export async function GET(req: Request) {
  const session = getSession(req)
  const isAdmin = session?.role === 'admin'
  const items = await (prisma.faqItem as any).findMany({
    where: isAdmin ? {} : { published: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(items)
}

// Admin: create a new FAQ item
export async function POST(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { question, answer, category, published } = await req.json()
  if (!question || !answer) return NextResponse.json({ error: 'Question and answer required' }, { status: 400 })

  // Place new item at end of its category
  const maxOrder = await (prisma.faqItem as any).aggregate({
    _max: { sortOrder: true },
    where: { category: category || 'General' },
  })

  const item = await (prisma.faqItem as any).create({
    data: {
      question,
      answer,
      category: category || 'General',
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      published: published !== false,
    },
  })

  return NextResponse.json(item)
}
