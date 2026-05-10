import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { billingStatus } = await req.json()

  const allowed = ['Active', 'Termed', 'Seasonal', 'Pending', null]
  if (!allowed.includes(billingStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const updated = await (prisma.nurseProfile as any).update({
    where: { id },
    data: { billingStatus },
  })

  return NextResponse.json(updated)
}
