import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../lib/auth'
import { sendReceiptEmail } from '../../../../../lib/sendEmail'

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

  const ok = await sendReceiptEmail({
    to: PREVIEW_TO,
    nurseName: 'Jane R. Sample, RN',
    nurseFirstName: 'Jane',
    nurseLastName: 'Sample, RN',
    accountNumber: 'CHC-00099',
    receiptNumber: 'RCT-PREVIEW',
    invoiceNumber: 'CHC-PREVIEW',
    paymentAmount: 270.00,
    paymentMethod: 'Venmo',
    paymentNote: 'INV-CHC-PREVIEW',
    appliedAt: new Date(),
    invoiceTotal: 765.00,
    previouslyPaid: 0,
    newTotalPaid: 270.00,
    balance: 495.00,
    newStatus: 'Partial',
  })

  if (!ok) {
    return NextResponse.json({ error: 'Email send failed — check RESEND_API_KEY.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sentTo: PREVIEW_TO })
}
