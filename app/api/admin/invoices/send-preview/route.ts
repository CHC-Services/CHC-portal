import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../lib/auth'
import { sendInvoiceEmail } from '../../../../../lib/sendEmail'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

const PREVIEW_TO = 'support@cominghomecare.com'

export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Sample data that mirrors the template page
  const entries = [
    { workDate: new Date('2025-02-03'), invoiceFeePlan: 'A1', invoiceFeeAmt: 120.00 },
    { workDate: new Date('2025-02-07'), invoiceFeePlan: 'B',  invoiceFeeAmt: 175.00 },
    { workDate: new Date('2025-02-10'), invoiceFeePlan: 'A2', invoiceFeeAmt: 150.00 },
    { workDate: new Date('2025-02-14'), invoiceFeePlan: 'C',  invoiceFeeAmt: 200.00 },
    { workDate: new Date('2025-02-21'), invoiceFeePlan: 'A1', invoiceFeeAmt: 120.00 },
  ]
  const totalAmount = entries.reduce((s, e) => s + e.invoiceFeeAmt, 0)

  const ok = await sendInvoiceEmail({
    to: PREVIEW_TO,
    nurseName: 'Jane R. Sample, RN',
    invoiceNumber: 'CHC-PREVIEW',
    totalAmount,
    dueTerm: '30',
    dueDate: new Date('2025-03-15'),
    entries,
    notes: 'This is a template preview sent from the portal. Sample data only — not a real invoice.',
  })

  if (!ok) {
    return NextResponse.json({ error: 'Email send failed — check RESEND_API_KEY.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sentTo: PREVIEW_TO })
}
