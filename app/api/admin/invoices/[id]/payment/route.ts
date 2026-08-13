import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { uploadToS3 } from '../../../../../../lib/s3'
import { sendReceiptEmail } from '../../../../../../lib/sendEmail'
import { getAccountBalance } from '../../../../../../lib/accountBalance'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

async function generateReceiptNumber(year: number): Promise<string> {
  const count = await (prisma.payment as any).count()
  return `RCT-${year}-${String(count + 1).padStart(4, '0')}`
}

function calcLateFee(invoice: {
  lateFeePlan: string | null
  lateFeeAmt: number | null
  lateFeePercent: number | null
  totalAmount: number
  dueDate: Date
}, paidAt: Date): number {
  if (!invoice.lateFeePlan || invoice.lateFeePlan === 'none') return 0
  const daysOverdue = Math.floor((paidAt.getTime() - invoice.dueDate.getTime()) / 86_400_000)
  if (daysOverdue <= 0) return 0
  const monthsOverdue = Math.floor(daysOverdue / 30)
  if (monthsOverdue === 0) return 0
  if (invoice.lateFeePlan === 'flat' && invoice.lateFeeAmt) {
    return monthsOverdue * invoice.lateFeeAmt
  }
  if (invoice.lateFeePlan === 'percent' && invoice.lateFeePercent) {
    return monthsOverdue * (invoice.lateFeePercent / 100) * invoice.totalAmount
  }
  return 0
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { amount, method, note, paidDate } = await req.json()

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return NextResponse.json({ error: 'Valid amount required' }, { status: 400 })
  }

  // Parse the paid date — default to now if not provided
  const appliedAt = paidDate ? new Date(paidDate + 'T12:00:00Z') : new Date()
  if (isNaN(appliedAt.getTime())) {
    return NextResponse.json({ error: 'Invalid paidDate' }, { status: 400 })
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

  const requestedAmount = Number(amount)
  const remaining = Math.max(0, invoice.totalAmount - (invoice.paidAmount || 0))
  const isAccountBalance = method === 'Account Balance'
  const priorBalance = await getAccountBalance(invoice.nurseId)

  // "Account Balance" spends down the nurse's existing credit ledger instead
  // of taking real money — never let it apply more than the nurse actually has.
  if (isAccountBalance && requestedAmount > priorBalance) {
    return NextResponse.json(
      { error: `Insufficient account balance (available: $${priorBalance.toFixed(2)})` },
      { status: 400 }
    )
  }

  // The amount that actually reduces this invoice's balance is capped at what's
  // owed — for real-money methods, anything beyond that is an overpayment that
  // becomes a new account-balance credit rather than silently inflating paidAmount
  // past totalAmount. For Account Balance, any requested-but-unneeded amount is
  // just left un-spent (the cap check above already guarantees enough exists).
  const appliedAmount = Math.min(requestedAmount, remaining)
  const overageAmount = isAccountBalance ? 0 : Math.max(0, requestedAmount - appliedAmount)
  // Account Balance payments only ever move `appliedAmount` (there's no "extra
  // cash received" concept); every other method records the real amount received.
  const paymentAmount = isAccountBalance ? appliedAmount : requestedAmount

  const paymentId = crypto.randomUUID()
  const receiptNumber = await generateReceiptNumber(appliedAt.getFullYear())
  const newPaid = (invoice.paidAmount || 0) + appliedAmount
  const newStatus = newPaid >= invoice.totalAmount ? 'Paid' : 'Partial'
  const isNowFullyPaid = newStatus === 'Paid'

  // Calculate late fee and prompt-pay eligibility based on payment date
  const lateFeeOwed = isNowFullyPaid ? calcLateFee(invoice, appliedAt) : 0

  const daysSinceSent = Math.floor(
    (appliedAt.getTime() - new Date(invoice.sentAt).getTime()) / 86_400_000
  )
  const promptPayQualifies = isNowFullyPaid &&
    invoice.promptPayDays != null &&
    invoice.promptPayCredit != null &&
    daysSinceSent <= invoice.promptPayDays

  // Check for existing credits on this invoice to avoid duplicates
  const existingCredits = isNowFullyPaid
    ? await (prisma.providerCredit.findMany as any)({
        where: { invoiceId: id, type: { in: ['prompt_pay', 'late_fee'] } },
        select: { type: true },
      })
    : []
  const hasPromptPayCredit = existingCredits.some((c: any) => c.type === 'prompt_pay')
  const hasLateFeeCredit   = existingCredits.some((c: any) => c.type === 'late_fee')

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
      amount: paymentAmount,
      appliedToInvoice: appliedAmount,
      method: method || null,
      note: note || null,
      appliedAt: appliedAt.toISOString(),
      paidDate: paidDate || null,
    },
    invoice: {
      totalAmount: invoice.totalAmount,
      previouslyPaid: invoice.paidAmount || 0,
      newTotalPaid: newPaid,
      balance: Math.max(0, invoice.totalAmount - newPaid),
      newStatus,
    },
    accountBalance: {
      overageCredited: overageAmount || null,
      appliedFromBalance: isAccountBalance ? appliedAmount : null,
      newBalance: priorBalance - (isAccountBalance ? appliedAmount : 0) + overageAmount,
    },
    generatedAt: new Date().toISOString(),
  }

  const s3Key = `receipts/${invoice.nurseId}/${receiptNumber}.json`

  let s3Saved = false
  try {
    await uploadToS3(s3Key, Buffer.from(JSON.stringify(receiptPayload, null, 2), 'utf-8'), 'application/json')
    s3Saved = true
  } catch (err) {
    console.error('S3 receipt save failed:', err)
  }

  // Build transaction operations
  const txOps: any[] = [
    (prisma.payment as any).create({
      data: {
        id: paymentId,
        invoiceId: id,
        receiptNumber,
        amount: paymentAmount,
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
        s3Key: null,
        ...(isNowFullyPaid ? { paidAt: appliedAt } : {}),
      },
    }),
  ]

  // Real-money overpayment beyond what the invoice owed becomes a new
  // account-balance credit, spendable against a future invoice.
  if (overageAmount > 0) {
    txOps.push(
      (prisma.providerCredit as any).create({
        data: {
          id: crypto.randomUUID(),
          nurseId: invoice.nurseId,
          invoiceId: id,
          paymentId,
          type: 'account_balance',
          amount: overageAmount,
          description: `Overpayment credit — paid $${requestedAmount.toFixed(2)} via ${method || 'payment'} against $${remaining.toFixed(2)} owed on invoice ${invoice.invoiceNumber}`,
          appliedAt,
        },
      })
    )
  }

  // Paying via Account Balance debits the ledger by exactly what was applied.
  if (isAccountBalance && appliedAmount > 0) {
    txOps.push(
      (prisma.providerCredit as any).create({
        data: {
          id: crypto.randomUUID(),
          nurseId: invoice.nurseId,
          invoiceId: id,
          paymentId,
          type: 'account_balance',
          amount: -appliedAmount,
          description: `Applied to invoice ${invoice.invoiceNumber}`,
          appliedAt,
        },
      })
    )
  }

  // Auto-record prompt-pay credit (positive = credit on next invoice)
  if (promptPayQualifies && !hasPromptPayCredit) {
    txOps.push(
      (prisma.providerCredit as any).create({
        data: {
          id: crypto.randomUUID(),
          nurseId: invoice.nurseId,
          invoiceId: id,
          type: 'prompt_pay',
          amount: invoice.promptPayCredit,
          description: `Prompt-pay credit — paid ${daysSinceSent}d after invoice (within ${invoice.promptPayDays}-day window)`,
          appliedAt,
        },
      })
    )
  }

  // Auto-record late fee (negative = charge on next invoice)
  if (lateFeeOwed > 0 && !hasLateFeeCredit) {
    const daysOverdue = Math.floor(
      (appliedAt.getTime() - new Date(invoice.dueDate).getTime()) / 86_400_000
    )
    txOps.push(
      (prisma.providerCredit as any).create({
        data: {
          id: crypto.randomUUID(),
          nurseId: invoice.nurseId,
          invoiceId: id,
          type: 'late_fee',
          amount: -lateFeeOwed,
          description: `Late fee — ${daysOverdue}d overdue (${Math.floor(daysOverdue / 30)} month${Math.floor(daysOverdue / 30) !== 1 ? 's' : ''})`,
          appliedAt,
        },
      })
    )
  }

  const [payment] = await (prisma.$transaction as any)(txOps)
  const newAccountBalance = priorBalance - (isAccountBalance ? appliedAmount : 0) + overageAmount

  // Send receipt email fire-and-forget
  const nurseEmail = invoice.nurse?.user?.email || invoice.nurseEmail
  if (nurseEmail) {
    sendReceiptEmail({
      to: nurseEmail,
      nurseName: invoice.nurse?.displayName || invoice.nurseName,
      accountNumber: invoice.nurse?.accountNumber ?? null,
      receiptNumber,
      invoiceNumber: invoice.invoiceNumber,
      paymentAmount,
      paymentMethod: method || null,
      paymentNote: note || null,
      appliedAt,
      invoiceTotal: invoice.totalAmount,
      previouslyPaid: invoice.paidAmount || 0,
      newTotalPaid: newPaid,
      balance: Math.max(0, invoice.totalAmount - newPaid),
      newStatus,
      overageAmount: overageAmount || undefined,
      accountBalanceApplied: isAccountBalance ? appliedAmount : undefined,
      newAccountBalance: (overageAmount > 0 || isAccountBalance) ? newAccountBalance : undefined,
    }).catch(() => {})
  }

  return NextResponse.json({
    ok: true,
    payment,
    receiptNumber,
    s3Key: s3Saved ? s3Key : null,
    newStatus,
    newPaid,
    promptPayCreditApplied: promptPayQualifies && !hasPromptPayCredit ? invoice.promptPayCredit : null,
    lateFeeApplied: lateFeeOwed > 0 && !hasLateFeeCredit ? lateFeeOwed : null,
    overageAmount: overageAmount || null,
    appliedFromBalance: isAccountBalance ? appliedAmount : null,
    accountBalance: newAccountBalance,
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

  // Reverse whatever this payment did to the nurse's account-balance ledger:
  // an overpayment credit (positive) it created, or a balance debit (negative)
  // it spent. Only the overpayment-credit portion was ever diverted away from
  // this invoice, so that's what has to come back out of `payment.amount`
  // before subtracting it from the invoice's paidAmount.
  const linkedCredits = await (prisma.providerCredit.findMany as any)({ where: { paymentId } })
  const overageReversed = linkedCredits
    .filter((c: any) => c.type === 'account_balance' && c.amount > 0)
    .reduce((s: number, c: any) => s + c.amount, 0)
  const appliedToInvoice = payment.amount - overageReversed

  const invoice = await (prisma.invoice.findUnique as any)({
    where: { id: invoiceId },
    select: { totalAmount: true, paidAmount: true },
  })
  const newPaid = Math.max(0, (invoice?.paidAmount || 0) - appliedToInvoice)
  const newStatus = newPaid <= 0 ? 'Sent' : newPaid >= (invoice?.totalAmount || 0) ? 'Paid' : 'Partial'

  await (prisma.$transaction as any)([
    (prisma.providerCredit as any).deleteMany({ where: { paymentId } }),
    (prisma.payment as any).delete({ where: { id: paymentId } }),
    (prisma.invoice as any).update({
      where: { id: invoiceId },
      data: { paidAmount: newPaid, status: newStatus, s3Key: null, ...(newStatus !== 'Paid' ? { paidAt: null } : {}) },
    }),
  ])

  return NextResponse.json({ ok: true })
}
