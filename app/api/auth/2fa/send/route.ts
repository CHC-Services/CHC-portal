import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyPendingToken } from '../../../../../lib/auth'
import { sendSms } from '../../../../../lib/sendSms'
import { sendTwoFactorCodeEmail } from '../../../../../lib/sendEmail'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const pendingToken = cookie.split('pending_2fa=').pop()?.split(';')[0]
  const pending = pendingToken ? verifyPendingToken(pendingToken) : null
  if (!pending) return NextResponse.json({ error: 'Session expired — please log in again' }, { status: 401 })

  const { method } = await req.json()
  if (method !== 'sms' && method !== 'email') {
    return NextResponse.json({ error: 'Invalid method' }, { status: 400 })
  }

  const user = await (prisma.user.findUnique as any)({ where: { id: pending.id } })
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  if (method === 'sms') {
    if (!user.phone) return NextResponse.json({ error: 'No phone number on file' }, { status: 400 })
    const result = await sendSms(user.phone, `Your myProvider login code is ${code}. Do not share this code with anyone.`)
    if (!result.ok) return NextResponse.json({ error: result.error || 'Unable to send SMS — try email instead' }, { status: 500 })
  } else {
    const sent = await sendTwoFactorCodeEmail({ to: user.email, name: user.name, code })
    if (!sent) return NextResponse.json({ error: 'Unable to send email — please try again' }, { status: 500 })
  }

  await (prisma.user.update as any)({
    where: { id: user.id },
    data: { smsOtp: code, smsOtpExpiresAt: expiresAt },
  })

  return NextResponse.json({ ok: true })
}
