import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const item = await (prisma.faqItem as any).update({
    where: { id: params.id },
    data,
  })
  return NextResponse.json(item)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await (prisma.faqItem as any).delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
