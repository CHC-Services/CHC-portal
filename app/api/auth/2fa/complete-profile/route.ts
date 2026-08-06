import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyPendingToken } from '../../../../../lib/auth'

// POST — first-login step for accounts (currently: guardians) invited without a
// phone number on file. Captures name + phone before the 2FA method screens so
// SMS becomes an available option instead of leaving the account stuck on email-only.
export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const pendingToken = cookie.split('pending_2fa=').pop()?.split(';')[0]
  const pending = pendingToken ? verifyPendingToken(pendingToken) : null
  if (!pending) return NextResponse.json({ error: 'Session expired — please log in again' }, { status: 401 })

  const { firstName, lastName, phone } = await req.json()
  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
  }
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 10) {
    return NextResponse.json({ error: 'Enter a valid 10-digit phone number' }, { status: 400 })
  }

  await (prisma.user.update as any)({
    where: { id: pending.id },
    data: { name: `${firstName.trim()} ${lastName.trim()}`, phone },
  })

  return NextResponse.json({ ok: true })
}
