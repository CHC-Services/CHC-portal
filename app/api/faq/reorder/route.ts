import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Accepts: [{ id, sortOrder }, ...]
export async function POST(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const updates: { id: string; sortOrder: number }[] = await req.json()

  await Promise.all(
    updates.map(({ id, sortOrder }) =>
      (prisma.faqItem as any).update({ where: { id }, data: { sortOrder } })
    )
  )

  return NextResponse.json({ ok: true })
}
