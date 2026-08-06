import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET/PATCH the signed-in guardian's own account fields (name, phone, 2FA status)
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'guardian') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await (prisma.user.findUnique as any)({
    where: { id: session.id },
    select: { name: true, email: true, phone: true, mfaEnabled: true },
  })
  return NextResponse.json({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    mfaEnabled: user?.mfaEnabled ?? false,
  })
}

export async function PATCH(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'guardian') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Password change branch
  if ('currentPassword' in body || 'newPassword' in body) {
    const { currentPassword, newPassword } = body
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password are required.' }, { status: 400 })
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 })
    }
    const user = await prisma.user.findUnique({ where: { id: session.id } })
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

    const passwordOk = await bcrypt.compare(currentPassword, user.password)
    if (!passwordOk) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: session.id }, data: { password: hashed } })
    return NextResponse.json({ ok: true })
  }

  // Phone number update branch
  const { phone } = body
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 10) {
    return NextResponse.json({ error: 'Enter a valid 10-digit phone number' }, { status: 400 })
  }

  await (prisma.user.update as any)({ where: { id: session.id }, data: { phone } })
  return NextResponse.json({ ok: true, phone })
}
