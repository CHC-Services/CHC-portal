import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { getOrCreateInvoicePdf } from '../../../../../../lib/invoicePdf'
import { sendInvoiceEmail } from '../../../../../../lib/sendEmail'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET — redirects to the invoice's stored PDF (generating/storing it first if needed)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: invoiceId } = await params

  try {
    const { url } = await getOrCreateInvoicePdf(invoiceId)
    return NextResponse.redirect(url)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

// POST — emails the stored PDF to the nurse
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: invoiceId } = await params

  const invoice = await (prisma.invoice.findUnique as any)({
    where: { id: invoiceId },
    include: {
      entries: { orderBy: { workDate: 'asc' } },
      payments: { orderBy: { appliedAt: 'asc' } },
      nurse: {
        select: {
          displayName: true, accountNumber: true, firstName: true, lastName: true,
          address: true, city: true, state: true, zip: true, phone: true,
          hasBusinessProvider: true, bizEntityName: true, bizServiceAddress: true,
          bizPhone: true, bizEmail: true, user: { select: { email: true } },
        },
      },
    },
  })

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Email not configured' }, { status: 500 })

  const { url: pdfUrl } = await getOrCreateInvoicePdf(invoiceId)
  const nurseEmail = invoice.nurse?.user?.email || invoice.nurseEmail

  const sent = await sendInvoiceEmail({
    to: nurseEmail,
    pdfUrl,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    nurseName: invoice.nurse?.displayName || invoice.nurseName,
    nurseEmail,
    nurse: invoice.nurse,
    grossAmount: invoice.grossAmount,
    discountAmt: invoice.discountAmt,
    discountNote: invoice.discountNote,
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    dueTerm: invoice.dueTerm,
    dueDate: invoice.dueDate,
    sentAt: invoice.sentAt,
    paidAt: invoice.paidAt,
    entries: invoice.entries,
    payments: invoice.payments,
    notes: invoice.notes,
    lateFeePlan: invoice.lateFeePlan,
    lateFeeAmt: invoice.lateFeeAmt,
    lateFeePercent: invoice.lateFeePercent,
    promptPayCredit: invoice.promptPayCredit,
    promptPayDays: invoice.promptPayDays,
  })

  if (!sent) return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
