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
  const { description, active, outcome } = await req.json()

  const data: Record<string, unknown> = {}
  if (description !== undefined) {
    if (!description.trim()) return NextResponse.json({ error: 'description required' }, { status: 400 })
    data.description = description.trim()
  }
  if (active !== undefined) data.active = !!active
  if (outcome !== undefined) data.outcome = outcome || null

  const record = await (prisma.medicaidStatusCode.update as any)({
    where: { code },
    data,
  })
  return NextResponse.json(record)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await params
  await (prisma.medicaidStatusCode.delete as any)({ where: { code } })
  return NextResponse.json({ ok: true })
}
