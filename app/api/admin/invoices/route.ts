import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { sendInvoiceEmail } from '../../../../lib/sendEmail'
import { calcCampaignDiscount, campaignRuleLabel } from '../../../../lib/campaignDiscount'
import { getOrCreateInvoicePdf } from '../../../../lib/invoicePdf'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

function calcDueDate(dueTerm: string): Date {
  const d = new Date()
  if (dueTerm === '30') d.setDate(d.getDate() + 30)
  else if (dueTerm === '60') d.setDate(d.getDate() + 60)
  else if (dueTerm === '90') d.setDate(d.getDate() + 90)
  // ASAP = today
  return d
}

export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const {
    nurseId, dueTerm, notes,
    manualDiscountAmt, manualDiscountNote,
    lateFeePlan, lateFeeAmt, lateFeePercent,
    promptPayDays, promptPayCredit,
  } = await req.json()
  if (!nurseId || !dueTerm) {
    return NextResponse.json({ error: 'nurseId and dueTerm required' }, { status: 400 })
  }

  // Fetch flagged entries not yet invoiced
  const entries = await prisma.timeEntry.findMany({
    where: { nurseId, readyToInvoice: true, invoiceId: null },
    orderBy: { workDate: 'asc' },
  })

  if (entries.length === 0) {
    return NextResponse.json({ error: 'No entries flagged for invoicing.' }, { status: 400 })
  }

  // Fetch nurse info
  const nurse = await prisma.nurseProfile.findUnique({
    where: { id: nurseId },
    include: { user: true },
  })
  if (!nurse) return NextResponse.json({ error: 'Nurse not found' }, { status: 404 })

  // Generate invoice number: CHC-YYYY-NNNN
  const count = await prisma.invoice.count()
  const invoiceNumber = `CHC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

  const grossAmount = entries.reduce((sum, e) => sum + (e.invoiceFeeAmt ?? 0), 0)
  const dueDate = calcDueDate(dueTerm)

  // Determine discount: campaign auto-calc OR manual override (manual takes full precedence)
  let discountAmt = 0
  let discountNote: string | null = null
  let campaignEnrollmentId: string | null = null

  if (manualDiscountAmt != null && manualDiscountAmt > 0) {
    discountAmt = Math.min(manualDiscountAmt, grossAmount)
    discountNote = manualDiscountNote || 'Manual discount'
  } else {
    // Check for active campaign enrollment
    const enrollment = await prisma.campaignEnrollment.findFirst({
      where: { nurseId, active: true },
      include: { campaign: true },
    })

    if (enrollment) {
      const result = calcCampaignDiscount(enrollment.campaign, entries)
      discountAmt = result.discountAmt
      if (discountAmt > 0) {
        discountNote = `Campaign: ${enrollment.campaign.name} (${campaignRuleLabel(enrollment.campaign)})`
        campaignEnrollmentId = enrollment.id
      }
    }
  }

  const totalAmount = Math.max(0, grossAmount - discountAmt)

  // Create invoice + link entries
  const invoice = await prisma.invoice.create({
    data: {
      nurseId,
      invoiceNumber,
      grossAmount,
      discountAmt,
      discountNote,
      totalAmount,
      dueTerm,
      dueDate,
      status: 'Sent',
      notes: notes || null,
      nurseEmail: nurse.user.email,
      nurseName: nurse.displayName,
      campaignEnrollmentId,
      lateFeePlan:    lateFeePlan   ?? null,
      lateFeeAmt:     lateFeePlan === 'flat'    ? (lateFeeAmt    ?? null) : null,
      lateFeePercent: lateFeePlan === 'percent' ? (lateFeePercent ?? null) : null,
      promptPayDays:  promptPayDays   ?? null,
      promptPayCredit: promptPayCredit ?? null,
      entries: { connect: entries.map(e => ({ id: e.id })) },
    },
    include: { entries: true },
  })

  // Render the canonical PDF and store it in S3 — this is the one artifact
  // every later print/email/view reuses instead of re-rendering its own copy.
  const { url: pdfUrl } = await getOrCreateInvoicePdf(invoice.id)

  // Send email with the stored PDF attached — fire-and-forget so a slow or
  // failed Resend call can't hang the response for an invoice that has
  // already been created successfully at this point (matches the pattern
  // used for other action-triggered emails, e.g. sendNewDocumentAlert).
  sendInvoiceEmail({
    to: nurse.user.email,
    pdfUrl,
    invoiceNumber,
    status: invoice.status,
    nurseName: nurse.displayName,
    nurseEmail: nurse.user.email,
    nurse: {
      displayName: nurse.displayName,
      accountNumber: nurse.accountNumber,
      firstName: nurse.firstName,
      lastName: nurse.lastName,
      address: nurse.address,
      city: nurse.city,
      state: nurse.state,
      zip: nurse.zip,
      phone: nurse.phone,
      hasBusinessProvider: nurse.hasBusinessProvider,
      bizEntityName: nurse.bizEntityName,
      bizServiceAddress: nurse.bizServiceAddress,
      bizPhone: nurse.bizPhone,
      bizEmail: nurse.bizEmail,
      user: nurse.user,
    },
    grossAmount,
    discountAmt,
    discountNote,
    totalAmount,
    paidAmount: 0,
    dueTerm,
    dueDate,
    sentAt: invoice.sentAt,
    lateFeePlan,
    lateFeeAmt: lateFeePlan === 'flat'    ? lateFeeAmt    : null,
    lateFeePercent: lateFeePlan === 'percent' ? lateFeePercent : null,
    promptPayDays,
    promptPayCredit,
    entries: entries.map(e => ({
      workDate: e.workDate,
      invoiceFeePlan: e.invoiceFeePlan ?? '',
      invoiceFeeAmt: e.invoiceFeeAmt ?? 0,
    })),
    notes: notes || undefined,
  }).catch(err => console.error('Invoice email failed to send:', err))

  return NextResponse.json(invoice)
}

export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: 'desc' },
    include: { nurse: { select: { displayName: true } } },
  })
  return NextResponse.json(invoices)
}
