import { NextResponse } from 'next/server'
import * as bcrypt from 'bcrypt'
import { prisma } from '../../../../lib/prisma'
import { signToken, signPendingToken } from '../../../../lib/auth'
import { sendSms } from '../../../../lib/sendSms'

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : phone
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

  type NurseProfile = {
    id?: string
    displayName?: string | null
    firstName?: string | null
    lastName?: string | null
    isDemo?: boolean | null
    portalAgreementSignedAt?: Date | null
  }

  type AdminSmsUser = {
    id: string
    role: string
    password: string
    name?: string | null
    phone?: string | null
    smsOtp?: string | null
    smsOtpExpiresAt?: Date | null
    mfaEnabled?: boolean
    mfaSecret?: string | null
    nurseProfile?: NurseProfile | null
  }

  const adminUser = user as AdminSmsUser
  const valid = await bcrypt.compare(password, adminUser.password)

  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const isAdminSmsMfa = adminUser.role === 'admin' && adminUser.mfaEnabled
  if (isAdminSmsMfa) {
    if (!adminUser.phone) {
      return NextResponse.json({ error: 'Admin 2FA phone number is not configured' }, { status: 400 })
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const message = `Your myProvider login code is ${code}. Do not share this code with anyone.`

    const smsResult = await sendSms(adminUser.phone, message)
    if (!smsResult.ok) {
      return NextResponse.json({ error: smsResult.error || 'Unable to send SMS code. Please try again.' }, { status: 500 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        smsOtp: code,
        smsOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      } as { smsOtp: string; smsOtpExpiresAt: Date },
    })

    const pendingToken = signPendingToken(user.id)
    const res = NextResponse.json({ requires2FA: true, phoneLast4: maskPhone(adminUser.phone) })
    res.cookies.set('pending_2fa', pendingToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 300, // 5 minutes to enter the code
    })
    return res
  }

  if (adminUser.mfaEnabled && adminUser.mfaSecret) {
    const pendingToken = signPendingToken(user.id)
    const res = NextResponse.json({ requires2FA: true })
    res.cookies.set('pending_2fa', pendingToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 300, // 5 minutes to enter the code
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
