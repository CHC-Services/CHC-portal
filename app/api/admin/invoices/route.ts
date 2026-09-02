import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { sendInvoiceEmail } from '../../../../lib/sendEmail'
import { calcCampaignDiscount, campaignRuleLabel } from '../../../../lib/campaignDiscount'
import { getOrCreateInvoicePdf } from '../../../../lib/invoicePdf'

// Puppeteer launching headless Chromium + rendering can run past Vercel's
// default serverless timeout. vercel.json already lists a maxDuration for
// this route, but Next.js App Router's own documented mechanism is this
// inline export — the progress-note pdf routes already rely on it instead
// of vercel.json alone, and this route (invoice creation, same heavy
// Chromium render) was missing it.
export const maxDuration = 30

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
    } else {
      // No personal enrollment — fall back to a site-wide campaign that
      // auto-applies to every invoice while it's active and in-window.
      // A specific per-nurse enrollment always wins over a blanket
      // site-wide promo, which is why this only runs when !enrollment.
      const now = new Date()
      const siteWideCampaign = await prisma.campaign.findFirst({
        where: {
          siteWide: true,
          active: true,
          AND: [
            { OR: [{ startDate: null }, { startDate: { lte: now } }] },
            { OR: [{ endDate: null }, { endDate: { gte: now } }] },
          ],
        },
        orderBy: { createdAt: 'desc' },
      })

      if (siteWideCampaign) {
        const result = calcCampaignDiscount(siteWideCampaign, entries)
        discountAmt = result.discountAmt
        if (discountAmt > 0) {
          discountNote = siteWideCampaign.name
        }
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
  // If this throws (Chrome/S3 hiccup), roll back the invoice + free the
  // entries rather than leaving a broken invoice sitting around with those
  // entries permanently locked as "already invoiced" but nothing actually
  // delivered — a real failure mode this hit once already (see
  // lib/generateInvoicePdf.ts's local-launch fix from the same incident).
  let pdfUrl: string
  try {
    ;({ url: pdfUrl } = await getOrCreateInvoicePdf(invoice.id))
  } catch (err) {
    await prisma.$transaction([
      prisma.timeEntry.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceId: null } }),
      prisma.invoice.delete({ where: { id: invoice.id } }),
    ])
    console.error(`Invoice PDF generation failed for ${invoiceNumber}, rolled back:`, err)
    return NextResponse.json({ error: 'Failed to generate the invoice PDF — nothing was saved, safe to try again.' }, { status: 500 })
  }

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
