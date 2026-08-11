import { NextResponse } from 'next/server'
import * as bcrypt from 'bcrypt'
import { prisma } from '../../../../lib/prisma'
import { signToken, signPendingToken } from '../../../../lib/auth'
import { logLogin, getIp } from '../../../../lib/logLogin'

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : phone
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  return `${local[0]}***@${domain}`
}

export async function POST(req: Request) {
  const { email: rawEmail, password } = await req.json()
  const email = rawEmail?.trim().toLowerCase()

  const ip = getIp(req)

  const user = await prisma.user.findUnique({
    where: { email },
    include: { nurseProfile: true },
  })

  if (!user) {
    logLogin({ accountType: 'unknown', email, result: 'Failed - Account not found', ip })
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password)

  if (!valid) {
    logLogin({
      accountType: user.role,
      email,
      firstName: user.nurseProfile?.firstName ?? null,
      lastName: user.nurseProfile?.lastName ?? null,
      accountNumber: user.nurseProfile?.accountNumber ?? null,
      result: 'Failed - Incorrect password',
      ip,
    })
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Effective phone: User.phone takes priority, fall back to NurseProfile.phone
  const effectivePhone = (user as any).phone || user.nurseProfile?.phone || null

  const globalSetting = await (prisma.systemSetting.findUnique as any)({ where: { key: 'twofa_enabled' } })
  const globalTwoFa = globalSetting?.value === 'true'
  // Any role's own opt-in (authenticator app enabled) enforces 2FA for that account,
  // independent of the site-wide toggle — not just admins.
  const userMfa = !!(user as any).mfaEnabled
  const needsTwoFa = globalTwoFa || userMfa

  if (needsTwoFa) {
    const needsConsent = user.role !== 'admin' && !(user as any).twoFaConsentAt
    // Guardians are invited by an admin/nurse who may not have had the guardian's
    // phone number on hand — without one, SMS 2FA silently isn't offered. Capture
    // it (plus name) before the 2FA method screens instead of leaving them stuck
    // with email-only and no way to add a phone mid-flow.
    const needsProfileInfo = user.role === 'guardian' && !effectivePhone

    // Log as pending — 2FA verify route logs the final result
    logLogin({
      accountType: user.role,
      email,
      firstName: user.nurseProfile?.firstName ?? null,
      lastName: user.nurseProfile?.lastName ?? null,
      accountNumber: user.nurseProfile?.accountNumber ?? null,
      result: 'Pending - Awaiting 2FA',
      ip,
    })

    const pendingToken = signPendingToken(user.id)
    const res = NextResponse.json({
      requires2FA: true,
      needsProfileInfo,
      needsConsent,
      hasSms: !!effectivePhone,
      phoneLast4: effectivePhone ? maskPhone(effectivePhone) : null,
      emailMasked: maskEmail(user.email),
      hasAuthenticator: !!((user as any).mfaEnabled && (user as any).mfaSecret),
    })
    res.cookies.set('pending_2fa', pendingToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 300,
    })
    return res
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  logLogin({
    accountType: user.role,
    email,
    firstName: user.nurseProfile?.firstName ?? null,
    lastName: user.nurseProfile?.lastName ?? null,
    accountNumber: user.nurseProfile?.accountNumber ?? null,
    result: 'Success',
    ip,
  })

  const nurseProfile = user.nurseProfile
  const portalAgreementSigned = !!nurseProfile?.portalAgreementSignedAt

  const token = signToken({
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

  // use a consistent cookie name that the middleware already expects
  // Session-only cookie (no maxAge): dies on full browser close; the 10-min
  // idle timeout is separately enforced via the lastActivityAt claim in middleware.ts
  res.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })

  return res
}
