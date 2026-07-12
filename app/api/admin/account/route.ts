import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET/PATCH the signed-in admin's own account fields (currently just the 2FA phone number)
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await (prisma.user.findUnique as any)({
    where: { id: session.id },
    select: { phone: true, mfaEnabled: true },
  })
  return NextResponse.json({ phone: user?.phone || '', mfaEnabled: user?.mfaEnabled ?? false })
}

export async function PATCH(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone } = await req.json()
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 10) {
    return NextResponse.json({ error: 'Enter a valid 10-digit phone number' }, { status: 400 })
  }

  await (prisma.user.update as any)({ where: { id: session.id }, data: { phone } })
  return NextResponse.json({ ok: true, phone })
}
