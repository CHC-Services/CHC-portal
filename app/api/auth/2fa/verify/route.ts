import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { signToken, verifyPendingToken } from '../../../../../lib/auth'
import * as speakeasy from 'speakeasy'
import { logLogin, getIp } from '../../../../../lib/logLogin'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const pendingToken = cookie.split('pending_2fa=').pop()?.split(';')[0]
  const pending = pendingToken ? verifyPendingToken(pendingToken) : null
  if (!pending || !pending.mfaMethod) return NextResponse.json({ error: 'Session expired — please log in again' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: pending.id },
    include: { nurseProfile: true },
  })
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  // Covers the (small) window where an account gets deactivated after the
  // password step but before 2FA completes — same block as login/route.ts.
  if ((user as any).deactivatedAt) {
    return NextResponse.json({ error: 'This account has been deactivated. Contact your administrator to reactivate it.' }, { status: 403 })
  }

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

  // Check strictly against the method bound to this pending session at selection time
  // (see /api/auth/2fa/send) — never fall back to another method, so e.g. an
  // authenticator-app code can't be used to satisfy a text-message challenge.
  if (pending.mfaMethod === 'totp') {
    if (authUser.mfaSecret) {
      valid = speakeasy.totp.verify({
        secret: authUser.mfaSecret,
        encoding: 'base32',
        token: code,
        window: 1,
      })
    }
  } else if (authUser.smsOtp) {
    const expiresAt = authUser.smsOtpExpiresAt ? new Date(authUser.smsOtpExpiresAt) : null
    if (expiresAt && expiresAt.getTime() > Date.now() && code === authUser.smsOtp) {
      valid = true
    }
  }

  if (!valid) {
    logLogin({
      accountType: authUser.role,
      email: user.email,
      firstName: authUser.nurseProfile?.firstName ?? null,
      lastName: authUser.nurseProfile?.lastName ?? null,
      result: 'Failed - Invalid 2FA code',
      ip: getIp(req),
    })
    return NextResponse.json({ error: 'Invalid code — try again' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      smsOtp: null,
      smsOtpExpiresAt: null,
    },
  })

  const nurseProfile = user.nurseProfile

  logLogin({
    accountType: user.role,
    email: user.email,
    firstName: nurseProfile?.firstName ?? null,
    lastName: nurseProfile?.lastName ?? null,
    accountNumber: (nurseProfile as any)?.accountNumber ?? null,
    result: 'Success',
    ip: getIp(req),
  })

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

  // Guardians who self-registered but abandoned before finishing the shared
  // demographic step need to be sent back there — they have nowhere else
  // useful to land (no patient linked yet).
  const needsOnboarding = user.role === 'guardian' && !(user as any).onboardingCompletedAt

  const res = NextResponse.json({ ok: true, role: user.role, portalAgreementSigned, needsOnboarding })

  // Clear pending cookie, set full session
  res.cookies.set('pending_2fa', '', { maxAge: 0, path: '/' })
  res.cookies.set('auth_token', authToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })

  return res
}
