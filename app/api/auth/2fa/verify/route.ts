import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { signToken, verifyPendingToken } from '../../../../../lib/auth'
import speakeasy from 'speakeasy'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const pendingToken = cookie.split('pending_2fa=').pop()?.split(';')[0]
  const pending = pendingToken ? verifyPendingToken(pendingToken) : null
  if (!pending) return NextResponse.json({ error: 'Session expired — please log in again' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const user = await (prisma.user as any).findUnique({
    where: { id: pending.id },
    include: { nurseProfile: true },
  })
  if (!user?.mfaSecret) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const valid = (speakeasy as any).totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token: code,
    window: 1,
  })

  if (!valid) return NextResponse.json({ error: 'Invalid code — try again' }, { status: 400 })

  await (prisma.user as any).update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  const portalAgreementSigned = !!user.nurseProfile?.portalAgreementSignedAt

  const authToken = signToken({
    id: user.id,
    role: user.role,
    nurseProfileId: user.nurseProfile?.id,
    name: user.name,
    displayName: user.nurseProfile?.displayName,
    firstName: user.nurseProfile?.firstName ?? undefined,
    lastName: user.nurseProfile?.lastName ?? undefined,
    isDemo: user.nurseProfile?.isDemo ?? false,
    portalAgreementSigned,
  })

  const res = NextResponse.json({ ok: true, role: user.role, portalAgreementSigned })

  // Clear pending cookie, set full session
  res.cookies.set('pending_2fa', '', { maxAge: 0, path: '/' })
  res.cookies.set('auth_token', authToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  })

  return res
}
