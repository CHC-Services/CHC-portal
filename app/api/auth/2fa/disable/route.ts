import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import speakeasy from 'speakeasy'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const user = await (prisma.user as any).findUnique({ where: { id: session.id } })
  if (!user?.mfaSecret) return NextResponse.json({ error: '2FA not enabled' }, { status: 400 })

  const valid = (speakeasy as any).totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token: code,
    window: 1,
  })

  if (!valid) return NextResponse.json({ error: 'Invalid code — try again' }, { status: 400 })

  await (prisma.user as any).update({
    where: { id: session.id },
    data: { mfaSecret: null, mfaEnabled: false },
  })

  return NextResponse.json({ ok: true })
}
