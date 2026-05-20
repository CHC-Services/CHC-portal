import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import speakeasy from 'speakeasy'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { secret, code } = await req.json()
  if (!secret || !code) return NextResponse.json({ error: 'Missing secret or code' }, { status: 400 })

  const valid = (speakeasy as any).totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: 1,
  })

  if (!valid) return NextResponse.json({ error: 'Invalid code — try again' }, { status: 400 })

  await (prisma.user as any).update({
    where: { id: session.id },
    data: { mfaSecret: secret, mfaEnabled: true },
  })

  return NextResponse.json({ ok: true })
}
