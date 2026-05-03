import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { sendInvoiceEmail } from '../../../../lib/sendEmail'
import { calcCampaignDiscount, campaignRuleLabel } from '../../../../lib/campaignDiscount'

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

  const { nurseId, dueTerm, notes, manualDiscountAmt, manualDiscountNote } = await req.json()
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
      entries: { connect: entries.map(e => ({ id: e.id })) },
    },
    include: { entries: true },
  })

  // Send email
  await sendInvoiceEmail({
    to: nurse.user.email,
    nurseName: nurse.displayName,
    nurseFirstName: nurse.firstName  ?? undefined,
    nurseLastName:  nurse.lastName   ?? undefined,
    nurseAddress:   nurse.address    ?? undefined,
    nurseCity:      nurse.city       ?? undefined,
    nurseState:     nurse.state      ?? undefined,
    nurseZip:       nurse.zip        ?? undefined,
    invoiceNumber,
    grossAmount,
    discountAmt,
    discountNote:   discountNote ?? undefined,
    totalAmount,
    dueTerm,
    dueDate,
    entries: entries.map(e => ({
      workDate: e.workDate,
      invoiceFeePlan: e.invoiceFeePlan ?? '',
      invoiceFeeAmt: e.invoiceFeeAmt ?? 0,
    })),
    notes: notes || undefined,
  })

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
