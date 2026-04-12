import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../lib/auth'
import { sendPromptPayReminder } from '../../../../lib/sendEmail'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST — send a test Prompt Pay reminder using current settings (no claim data required)
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const s = body.settings || {}

  const toEmail        = s['promptPay.toEmail']        || 'support@cominghomecare.com'
  const fromEmail      = s['promptPay.fromEmail']      || 'alerts@cominghomecare.com'
  const formLinkName   = s['promptPay.formLinkName']   || 'Prompt Pay Interest Form'
  const formUrl        = s['promptPay.formUrl']        || null
  const subjectTemplate = s['promptPay.subjectTemplate'] || 'Prompt Pay Alert: Claim {claimId} — {provider} — Day 30 on {day30}'
  const customNote     = s['promptPay.customNote']     || ''

  const submitDate = new Date('2025-01-01')
  const day30 = new Date('2025-01-31')

  const ok = await sendPromptPayReminder({
    toEmail,
    fromEmail,
    providerName: 'Test Provider (Sample)',
    claimId: 'CLM-SAMPLE',
    submitDate,
    day30,
    formLinkName,
    formUrl,
    subjectTemplate,
    customNote,
  })

  if (ok) return NextResponse.json({ ok: true })
  return NextResponse.json({ error: 'Email failed to send' }, { status: 500 })
}
