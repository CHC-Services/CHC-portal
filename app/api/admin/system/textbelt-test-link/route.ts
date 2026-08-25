import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../lib/auth'
import { sendSms } from '../../../../../lib/sendSms'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Manual, on-demand self-test: sends a real SMS containing a link via
// TextBelt so an admin can check — by actually looking at the phone that
// receives it — whether TextBelt's separate link-sending approval has come
// through, without depending on TextBelt support replying to the approval
// request. A 200 here only means TextBelt accepted the send; it does not
// confirm the link survived delivery.
export async function POST(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone } = await req.json()
  if (!phone) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })

  const sentAt = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const message = `CHC Portal link test (${sentAt}): https://cominghomecare.com — if this arrived with a working link, TextBelt link approval is active.`

  const result = await sendSms(phone, message)
  if (!result.ok) return NextResponse.json({ error: result.error || 'Send failed' }, { status: 502 })

  return NextResponse.json({ ok: true, message })
}
