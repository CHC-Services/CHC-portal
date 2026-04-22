import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  const { description } = await req.json()
  if (!description?.trim()) return NextResponse.json({ error: 'description required' }, { status: 400 })

  const record = await (prisma.medicaidStatusCode.update as any)({
    where: { code },
    data: { description: description.trim() },
  })
  return NextResponse.json(record)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  await (prisma.medicaidStatusCode.delete as any)({ where: { code } })
  return NextResponse.json({ ok: true })
}
