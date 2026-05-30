import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { signToken, verifyPendingToken } from '../../../../../lib/auth'
import * as speakeasy from 'speakeasy'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const pendingToken = cookie.split('pending_2fa=').pop()?.split(';')[0]
  const pending = pendingToken ? verifyPendingToken(pendingToken) : null
  if (!pending) return NextResponse.json({ error: 'Session expired — please log in again' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: pending.id },
    include: { nurseProfile: true },
  })
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  type NurseProfile = {
    id?: string
    displayName?: string | null
    firstName?: string | null
    lastName?: string | null
    isDemo?: boolean | null
    portalAgreementSignedAt?: Date | null
  }

  type AuthUser = {
    id: string
    role: string
    name?: string | null
    smsOtp?: string | null
    smsOtpExpiresAt?: Date | null
    mfaSecret?: string | null
    nurseProfile?: NurseProfile | null
  }

  const authUser = user as AuthUser
  let valid = false

  if (authUser.smsOtp) {
    const expiresAt = authUser.smsOtpExpiresAt ? new Date(authUser.smsOtpExpiresAt) : null
    if (expiresAt && expiresAt.getTime() > Date.now() && code === authUser.smsOtp) {
      valid = true
    }
  } else if (authUser.mfaSecret) {
    valid = speakeasy.totp.verify({
      secret: authUser.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    })
  }

  if (!valid) return NextResponse.json({ error: 'Invalid code — try again' }, { status: 400 })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      smsOtp: null,
      smsOtpExpiresAt: null,
    },
  })

  const nurseProfile = user.nurseProfile
  const portalAgreementSigned = !!nurseProfile?.portalAgreementSignedAt

  const authToken = signToken({
    id: user.id,
    role: user.role,
    nurseProfileId: nurseProfile?.id,
    name: user.name,
    displayName: nurseProfile?.displayName,
    firstName: nurseProfile?.firstName ?? undefined,
    lastName: nurseProfile?.lastName ?? undefined,
    isDemo: nurseProfile?.isDemo ?? false,
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
