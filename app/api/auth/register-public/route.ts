import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '../../../../lib/prisma'
import { signToken } from '../../../../lib/auth'
import { sendRegistrationConfirmation } from '../../../../lib/sendEmail'
import { trialEndDate } from '../../../../lib/planPermissions'

async function generateAccountNumber(): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(-2)
  const last = await (prisma.nurseProfile.findFirst as any)({
    where: { accountNumber: { startsWith: yy } },
    orderBy: { accountNumber: 'desc' },
    select: { accountNumber: true },
  })
  const lastSeq = last?.accountNumber ? parseInt(last.accountNumber.slice(2), 10) : 0
  const nextSeq = String(lastSeq + 1).padStart(3, '0')
  return `${yy}${nextSeq}`
}

// "Patient or Guardian" is the only self-service selection that creates a
// guardian account. Everything else ("Medical Provider", "Billing Service",
// "Other") collapses into role: 'nurse', with the raw selection preserved as
// free-text NurseProfile.signupRole metadata — unchanged from before.
function resolveRole(signupRole: string | undefined): 'nurse' | 'guardian' {
  return signupRole?.trim() === 'Patient' ? 'guardian' : 'nurse'
}

export async function POST(req: Request) {
  try {
    const { firstName, lastName, phone, email, password, signupRole } = await req.json()

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password || !phone?.trim()) {
      return NextResponse.json({ error: 'First name, last name, phone, email, and password are required.' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (existing) {
      return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 10)
    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const displayName = firstName.trim()
    const role = resolveRole(signupRole)

    const user = role === 'nurse'
      ? await (prisma.user.create as any)({
          data: {
            email: email.toLowerCase().trim(),
            password: hashed,
            name: fullName,
            role: 'nurse',
            nurseProfile: {
              create: {
                displayName,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: phone.trim(),
                accountNumber: await generateAccountNumber(),
                signupRole: signupRole?.trim() || null,
                planTier: 'BASIC',
                trialExpiresAt: trialEndDate(),
              },
            },
          },
          select: {
            id: true,
            email: true,
            role: true,
            nurseProfile: { select: { id: true, displayName: true, firstName: true, lastName: true } },
          },
        })
      : await (prisma.user.create as any)({
          data: {
            email: email.toLowerCase().trim(),
            password: hashed,
            name: fullName,
            role: 'guardian',
            phone: phone.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          },
          select: { id: true, email: true, role: true },
        })

    await sendRegistrationConfirmation({ to: user.email, displayName }).catch(() => {})

    const token = signToken({
      id: user.id,
      role: user.role,
      nurseProfileId: user.nurseProfile?.id,
      name: fullName,
      displayName,
      firstName: (user.nurseProfile as any)?.firstName ?? firstName.trim(),
      lastName: (user.nurseProfile as any)?.lastName ?? lastName.trim(),
    })

    const res = NextResponse.json({ ok: true })
    res.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })
    return res
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Public register error:', msg)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
