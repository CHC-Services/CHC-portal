import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { uploadToS3 } from '../../../../../../lib/s3'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

async function generateReceiptNumber(): Promise<string> {
  const count = await (prisma.payment as any).count()
  const year = new Date().getFullYear()
  return `RCT-${year}-${String(count + 1).padStart(4, '0')}`
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { amount, method, note } = await req.json()

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return NextResponse.json({ error: 'Valid amount required' }, { status: 400 })
  }

  // Fetch invoice + nurse for receipt
  const invoice = await (prisma.invoice.findUnique as any)({
    where: { id },
    include: {
      nurse: { select: { displayName: true, accountNumber: true, user: { select: { email: true } } } },
      entries: { orderBy: { workDate: 'asc' } },
    },
  })
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (['Paid', 'WrittenOff'].includes(invoice.status)) {
    return NextResponse.json({ error: 'Invoice is already closed.' }, { status: 400 })
  }

  const receiptNumber = await generateReceiptNumber()
  const newPaid = (invoice.paidAmount || 0) + Number(amount)
  const newStatus = newPaid >= invoice.totalAmount ? 'Paid' : 'Partial'
  const appliedAt = new Date()

  // Build receipt payload for S3
  const receiptPayload = {
    receiptNumber,
    invoiceNumber: invoice.invoiceNumber,
    provider: {
      name: invoice.nurse?.displayName || invoice.nurseName,
      email: invoice.nurse?.user?.email || invoice.nurseEmail,
      accountNumber: invoice.nurse?.accountNumber || null,
    },
    payment: {
      amount: Number(amount),
      method: method || null,
      note: note || null,
      appliedAt: appliedAt.toISOString(),
    },
    invoice: {
      totalAmount: invoice.totalAmount,
      previouslyPaid: invoice.paidAmount || 0,
      newTotalPaid: newPaid,
      balance: Math.max(0, invoice.totalAmount - newPaid),
      newStatus,
    },
    generatedAt: new Date().toISOString(),
  }

  const s3Key = `receipts/${invoice.nurseId}/${receiptNumber}.json`

  // Save receipt to S3
  let s3Saved = false
  try {
    await uploadToS3(s3Key, Buffer.from(JSON.stringify(receiptPayload, null, 2), 'utf-8'), 'application/json')
    s3Saved = true
  } catch (err) {
    console.error('S3 receipt save failed:', err)
    // Don't block payment creation if S3 fails
  }

  // Create payment + update invoice in a transaction
  const [payment] = await (prisma.$transaction as any)([
    (prisma.payment as any).create({
      data: {
        invoiceId: id,
        receiptNumber,
        amount: Number(amount),
        method: method || null,
        note: note || null,
        appliedAt,
        ...(s3Saved ? { s3Key } : {}),
      },
    }),
    (prisma.invoice as any).update({
      where: { id },
      data: {
        paidAmount: newPaid,
        status: newStatus,
        ...(newStatus === 'Paid' ? { paidAt: appliedAt } : {}),
      },
    }),
  ])

  return NextResponse.json({
    ok: true,
    payment,
    receiptNumber,
    s3Key: s3Saved ? s3Key : null,
    newStatus,
    newPaid,
  })
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const payments = await (prisma.payment as any).findMany({
    where: { invoiceId: id },
    orderBy: { appliedAt: 'asc' },
  })
  return NextResponse.json(payments)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id: invoiceId } = await params
  const { paymentId } = await req.json()
  if (!paymentId) return NextResponse.json({ error: 'paymentId required' }, { status: 400 })

  const payment = await (prisma.payment as any).findUnique({ where: { id: paymentId } })
  if (!payment || payment.invoiceId !== invoiceId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const invoice = await (prisma.invoice.findUnique as any)({
    where: { id: invoiceId },
    select: { totalAmount: true, paidAmount: true },
  })
  const newPaid = Math.max(0, (invoice?.paidAmount || 0) - payment.amount)
  const newStatus = newPaid <= 0 ? 'Sent' : newPaid >= (invoice?.totalAmount || 0) ? 'Paid' : 'Partial'

  await (prisma.$transaction as any)([
    (prisma.payment as any).delete({ where: { id: paymentId } }),
    (prisma.invoice as any).update({
      where: { id: invoiceId },
      data: { paidAmount: newPaid, status: newStatus, ...(newStatus !== 'Paid' ? { paidAt: null } : {}) },
    }),
  ])

  return NextResponse.json({ ok: true })
}
