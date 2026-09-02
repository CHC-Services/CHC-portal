import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { getOrCreateInvoicePdf } from '../../../../../../lib/invoicePdf'
import { sendInvoiceEmail } from '../../../../../../lib/sendEmail'

// Puppeteer launching headless Chromium + rendering can run past Vercel's
// default serverless timeout — see the matching comment in
// app/api/admin/invoices/route.ts.
export const maxDuration = 30

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// A genuinely missing invoice reports 404; any other failure (Chromium
// timeout/crash, S3 hiccup) previously got flattened into the same "Not
// found" response, which reads as "this invoice doesn't exist" when it
// really does — misleading for what's usually a transient render failure.
function errorResponse(err: unknown) {
  if (err instanceof Error && err.message === 'Invoice not found') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  console.error('Invoice PDF generation failed:', err)
  return NextResponse.json({ error: 'Failed to generate the invoice PDF. Please try again.' }, { status: 500 })
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
  } catch (err) {
    return errorResponse(err)
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

  let pdfUrl: string
  try {
    ;({ url: pdfUrl } = await getOrCreateInvoicePdf(invoiceId))
  } catch (err) {
    return errorResponse(err)
  }
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
