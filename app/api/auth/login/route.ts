import { NextResponse } from 'next/server'
import * as bcrypt from 'bcrypt'
import { prisma } from '../../../../lib/prisma'
import { signToken, signPendingToken } from '../../../../lib/auth'

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

  const user = await prisma.user.findUnique({
    where: { email },
    include: { nurseProfile: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password)

  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Effective phone: User.phone takes priority, fall back to NurseProfile.phone
  const effectivePhone = (user as any).phone || user.nurseProfile?.phone || null

  const globalSetting = await (prisma.systemSetting.findUnique as any)({ where: { key: 'twofa_enabled' } })
  const globalTwoFa = globalSetting?.value === 'true'
  const adminMfa = user.role === 'admin' && (user as any).mfaEnabled
  const needsTwoFa = globalTwoFa || adminMfa

  if (needsTwoFa) {
    const needsConsent = user.role !== 'admin' && !(user as any).twoFaConsentAt

    const pendingToken = signPendingToken(user.id)
    const res = NextResponse.json({
      requires2FA: true,
      needsConsent,
      hasSms: !!effectivePhone,
      phoneLast4: effectivePhone ? maskPhone(effectivePhone) : null,
      emailMasked: maskEmail(user.email),
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
  res.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24-hour inactivity window — refreshed on every page visit
  })

  return res
}
