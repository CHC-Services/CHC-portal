import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import bcrypt from 'bcrypt'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { newEmail, currentPassword } = await req.json()

  if (!newEmail?.trim() || !currentPassword) {
    return NextResponse.json({ error: 'New email and current password are required.' }, { status: 400 })
  }

  const normalized = newEmail.trim().toLowerCase()

  const user = await prisma.user.findUnique({ where: { id: session.id } })
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

  if (normalized === user.email.toLowerCase()) {
    return NextResponse.json({ error: 'That is already your current email address.' }, { status: 400 })
  }

  const passwordOk = await bcrypt.compare(currentPassword, user.password)
  if (!passwordOk) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })

  const taken = await prisma.user.findUnique({ where: { email: normalized } })
  if (taken) return NextResponse.json({ error: 'That email address is already in use.' }, { status: 400 })

  await prisma.user.update({ where: { id: session.id }, data: { email: normalized } })

  return NextResponse.json({ ok: true, email: normalized })
}
