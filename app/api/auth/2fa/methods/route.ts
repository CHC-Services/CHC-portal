import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyPendingToken } from '../../../../../lib/auth'

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : phone
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  return `${local[0]}***@${domain}`
}

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const pendingToken = cookie.split('pending_2fa=').pop()?.split(';')[0]
  const pending = pendingToken ? verifyPendingToken(pendingToken) : null
  if (!pending) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const user = await (prisma.user.findUnique as any)({ where: { id: pending.id }, include: { nurseProfile: true } })
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const effectivePhone = user.phone || user.nurseProfile?.phone || null

  return NextResponse.json({
    hasSms: !!effectivePhone,
    phoneLast4: effectivePhone ? maskPhone(effectivePhone) : null,
    emailMasked: maskEmail(user.email),
    hasAuthenticator: !!(user.mfaEnabled && user.mfaSecret),
  })
}
