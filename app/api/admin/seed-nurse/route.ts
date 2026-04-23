import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setUTCHours(12, 0, 0, 0)
  return d
}

function daysFromNow(n: number) {
  return daysAgo(-n)
}

/**
 * POST /api/admin/seed-nurse
 * Body: { email: string }  — looks up nurse by user email
 * Seeds realistic claims, invoices, time entries, and reminders.
 * Safe to call multiple times — wipes and re-seeds each time.
 */
export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } })
  if (!user) return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 })

  const profile = await prisma.nurseProfile.findUnique({ where: { userId: user.id } })
  if (!profile) return NextResponse.json({ error: 'Nurse profile not found' }, { status: 404 })

  const nurseId = profile.id

  // ── Wipe existing seeded data ──────────────────────────────────────────────
  await prisma.invoiceActivity.deleteMany({ where: { nurseId } })
  await prisma.payment.deleteMany({
    where: { invoice: { nurseId } },
  })
  await prisma.timeEntry.deleteMany({ where: { nurseId } })
  await prisma.invoice.deleteMany({ where: { nurseId } })
  await prisma.claim.deleteMany({ where: { nurseId } })
  await prisma.nurseReminder.deleteMany({ where: { nurseId } })

  // ── Update profile: enrolled in billing with realistic details ─────────────
  await prisma.nurseProfile.update({
    where: { id: nurseId },
    data: {
      enrolledInBilling:  true,
      billingPlan:        'B',          // Dual Payer
      carrierCount:       2,
      billingDurationType: 'full_year',
      planStartDate:      '2026-01-01',
      onboardingComplete: true,
      agreementSignedAt:  new Date('2025-12-18T14:22:00Z'),
      agreementSignature: profile.displayName || user.name,
      npiNumber:          profile.npiNumber || '1234567890',
      medicaidNumber:     profile.medicaidNumber || 'MD-2026-TN884',
      bankName:           profile.bankName || 'First National Bank',
      providerAliases:    profile.providerAliases.length ? profile.providerAliases : ['TN', 'Test Nurse'],
    },
  })

  // ── Claims ─────────────────────────────────────────────────────────────────
  // Claim 1 — Fully paid, dual payer (oldest)
  const c1DosStart = daysAgo(103)
  const c1DosStop  = daysAgo(90)
  const claim1 = await prisma.claim.create({
    data: {
      nurseId,
      claimId:           'CLM-2026-T001',
      providerName:      profile.displayName || user.name,
      dosStart:          c1DosStart,
      dosStop:           c1DosStop,
      totalBilled:       1680.00,
      hours:             84,
      claimStage:        'Paid',
      submitDate:        daysAgo(87),
      primaryPayer:      'Blue Cross Blue Shield',
      primaryAllowedAmt: 1512.00,
      primaryPaidAmt:    1512.00,
      primaryPaidDate:   daysAgo(59),
      primaryPaidTo:     'Provider',
      secondaryPayer:    'Medicaid',
      secondaryAllowedAmt: 168.00,
      secondaryPaidAmt:  168.00,
      secondaryPaidDate: daysAgo(44),
      secondaryPaidTo:   'Provider',
      totalReimbursed:   1680.00,
      remainingBalance:  0.00,
      dateFullyFinalized: daysAgo(44),
      processingNotes:   'Claim fully processed. Both payers remitted on time.',
    },
  })

  // Claim 2 — Fully paid, Medicaid only
  const c2DosStart = daysAgo(75)
  const c2DosStop  = daysAgo(62)
  const claim2 = await prisma.claim.create({
    data: {
      nurseId,
      claimId:           'CLM-2026-T002',
      providerName:      profile.displayName || user.name,
      dosStart:          c2DosStart,
      dosStop:           c2DosStop,
      totalBilled:       1120.00,
      hours:             56,
      claimStage:        'Paid',
      submitDate:        daysAgo(59),
      primaryPayer:      'Medicaid',
      primaryAllowedAmt: 1064.00,
      primaryPaidAmt:    1064.00,
      primaryPaidDate:   daysAgo(31),
      primaryPaidTo:     'Provider',
      totalReimbursed:   1064.00,
      remainingBalance:  56.00,
      dateFullyFinalized: daysAgo(31),
      processingNotes:   'Medicaid paid allowed amount. Small balance written off per contract.',
    },
  })

  // Claim 3 — INS-1 submitted, awaiting BCBS response
  const c3DosStart = daysAgo(48)
  const c3DosStop  = daysAgo(35)
  const claim3 = await prisma.claim.create({
    data: {
      nurseId,
      claimId:           'CLM-2026-T003',
      providerName:      profile.displayName || user.name,
      dosStart:          c3DosStart,
      dosStop:           c3DosStop,
      totalBilled:       1400.00,
      hours:             70,
      claimStage:        'INS-1 Submitted',
      submitDate:        daysAgo(32),
      primaryPayer:      'Blue Cross Blue Shield',
      processingNotes:   'Claim submitted electronically on 3/21. Standard 30-day processing window applies.',
    },
  })

  // Claim 4 — Info requested, awaiting resubmission
  const c4DosStart = daysAgo(22)
  const c4DosStop  = daysAgo(9)
  const claim4 = await prisma.claim.create({
    data: {
      nurseId,
      claimId:           'CLM-2026-T004',
      providerName:      profile.displayName || user.name,
      dosStart:          c4DosStart,
      dosStop:           c4DosStop,
      totalBilled:       960.00,
      hours:             48,
      claimStage:        'Info Requested',
      submitDate:        daysAgo(6),
      primaryPayer:      'Aetna',
      processingNotes:   'Aetna requested updated plan of care documentation. Please submit supporting records through secure upload.',
    },
  })

  // ── Time entries — ~3 months, linked to claims ─────────────────────────────
  const entryNotes = [
    'Home visit — patient care',
    'Wound care and vitals monitoring',
    'Medication administration and review',
    'Therapy session support',
    'Weekly wellness check',
    'Patient assessment and documentation',
    'IV therapy and monitoring',
    'Discharge planning coordination',
  ]

  type TimeEntryData = {
    nurseId: string
    workDate: Date
    hours: number
    notes: string
    billed: boolean
    readyToInvoice: boolean
    invoiceFeePlan: string | null
    invoiceFeeAmt: number | null
    claimRef: string | null
  }

  const timeEntries: TimeEntryData[] = []
  const hourOptions = [6, 7, 8, 8, 6, 7, 8]

  // Entries tied to claim 1 (days 103–90 ago, billed)
  const c1Days = [103, 100, 96, 93, 90]
  for (const d of c1Days) {
    timeEntries.push({
      nurseId,
      workDate:       daysAgo(d),
      hours:          hourOptions[Math.floor(Math.random() * hourOptions.length)],
      notes:          entryNotes[Math.floor(Math.random() * entryNotes.length)],
      billed:         true,
      readyToInvoice: true,
      invoiceFeePlan: 'B',
      invoiceFeeAmt:  6.00,
      claimRef:       claim1.claimId,
    })
  }

  // Entries tied to claim 2 (days 75–62 ago, billed)
  const c2Days = [75, 72, 68, 65, 62]
  for (const d of c2Days) {
    timeEntries.push({
      nurseId,
      workDate:       daysAgo(d),
      hours:          hourOptions[Math.floor(Math.random() * hourOptions.length)],
      notes:          entryNotes[Math.floor(Math.random() * entryNotes.length)],
      billed:         true,
      readyToInvoice: true,
      invoiceFeePlan: 'B',
      invoiceFeeAmt:  6.00,
      claimRef:       claim2.claimId,
    })
  }

  // Entries tied to claim 3 (days 48–35 ago, billed)
  const c3Days = [48, 45, 41, 38, 35]
  for (const d of c3Days) {
    timeEntries.push({
      nurseId,
      workDate:       daysAgo(d),
      hours:          hourOptions[Math.floor(Math.random() * hourOptions.length)],
      notes:          entryNotes[Math.floor(Math.random() * entryNotes.length)],
      billed:         true,
      readyToInvoice: true,
      invoiceFeePlan: 'B',
      invoiceFeeAmt:  6.00,
      claimRef:       claim3.claimId,
    })
  }

  // Entries tied to claim 4 (days 22–9 ago, not yet invoiced)
  const c4Days = [22, 19, 15, 12, 9]
  for (const d of c4Days) {
    timeEntries.push({
      nurseId,
      workDate:       daysAgo(d),
      hours:          hourOptions[Math.floor(Math.random() * hourOptions.length)],
      notes:          entryNotes[Math.floor(Math.random() * entryNotes.length)],
      billed:         false,
      readyToInvoice: true,
      invoiceFeePlan: 'B',
      invoiceFeeAmt:  6.00,
      claimRef:       claim4.claimId,
    })
  }

  // A couple of recent unbilled entries
  for (const d of [5, 2]) {
    timeEntries.push({
      nurseId,
      workDate:       daysAgo(d),
      hours:          hourOptions[Math.floor(Math.random() * hourOptions.length)],
      notes:          entryNotes[Math.floor(Math.random() * entryNotes.length)],
      billed:         false,
      readyToInvoice: false,
      invoiceFeePlan: null,
      invoiceFeeAmt:  null,
      claimRef:       null,
    })
  }

  await prisma.timeEntry.createMany({ data: timeEntries })

  // ── Invoices ───────────────────────────────────────────────────────────────
  const nurseEmail  = (await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } }))!.email
  const nurseName   = profile.displayName || user.name

  // Invoice 1 — Paid (oldest)
  const inv1 = await prisma.invoice.create({
    data: {
      nurseId,
      invoiceNumber: 'CHC-2026-T001',
      nurseName,
      nurseEmail,
      totalAmount:  54.00,
      paidAmount:   54.00,
      dueTerm:      '30',
      dueDate:      daysAgo(55),
      status:       'Paid',
      notes:        'Billing fee — Claims CLM-2026-T001 & CLM-2026-T002 (9 sessions, Dual Payer plan).',
      sentAt:       daysAgo(85),
      paidAt:       daysAgo(70),
    },
  })

  // Invoice 2 — Sent (current, due soon)
  const inv2 = await prisma.invoice.create({
    data: {
      nurseId,
      invoiceNumber: 'CHC-2026-T002',
      nurseName,
      nurseEmail,
      totalAmount:  30.00,
      paidAmount:   0,
      dueTerm:      '30',
      dueDate:      daysFromNow(12),
      status:       'Sent',
      notes:        'Billing fee — Claim CLM-2026-T003 (5 sessions, Dual Payer plan).',
      sentAt:       daysAgo(18),
    },
  })

  // Invoice 3 — Overdue
  const inv3 = await prisma.invoice.create({
    data: {
      nurseId,
      invoiceNumber: 'CHC-2026-T003',
      nurseName,
      nurseEmail,
      totalAmount:  18.00,
      paidAmount:   0,
      dueTerm:      '30',
      dueDate:      daysAgo(15),
      status:       'Overdue',
      notes:        'Billing fee — supplemental entries Dec 2025. Please remit at your earliest convenience.',
      sentAt:       daysAgo(45),
    },
  })

  // ── Reminders ──────────────────────────────────────────────────────────────
  await prisma.nurseReminder.createMany({
    data: [
      {
        nurseId,
        title:    'RN License Renewal',
        category: 'license',
        dueDate:  new Date('2026-09-30T12:00:00Z'),
        notes:    'State license expires Sept 30. Submit renewal application no later than 60 days prior.',
        completed: false,
      },
      {
        nurseId,
        title:    'Malpractice Insurance Renewal',
        category: 'insurance',
        dueDate:  new Date('2026-08-15T12:00:00Z'),
        notes:    'Current policy with Healthcare Providers Service Organization. Confirm coverage dates and limits.',
        completed: false,
      },
      {
        nurseId,
        title:    'Medicaid Enrollment Re-verification',
        category: 'medicaid',
        dueDate:  new Date('2026-06-01T12:00:00Z'),
        notes:    'Annual re-verification required. Upload updated credentialing documents when complete.',
        completed: false,
      },
    ],
  })

  // ── Invoice activities (send log) ──────────────────────────────────────────
  await prisma.invoiceActivity.createMany({
    data: [
      { nurseId, invoiceId: inv1.id, action: 'Email', documentType: 'Invoice', reference: inv1.invoiceNumber, note: 'Sent via portal' },
      { nurseId, invoiceId: inv1.id, action: 'Email', documentType: 'Receipt', reference: 'RCP-2026-T001',   note: 'Payment confirmed — Venmo' },
      { nurseId, invoiceId: inv2.id, action: 'Email', documentType: 'Invoice', reference: inv2.invoiceNumber, note: 'Sent via portal' },
      { nurseId, invoiceId: inv3.id, action: 'Email', documentType: 'Invoice', reference: inv3.invoiceNumber, note: 'Sent via portal' },
    ],
  })

  // ── Payment record for the paid invoice ───────────────────────────────────
  await prisma.payment.create({
    data: {
      invoiceId:     inv1.id,
      receiptNumber: 'RCP-2026-T001',
      amount:        54.00,
      method:        'Venmo',
      note:          'Paid in full',
      appliedAt:     daysAgo(70),
    },
  })

  return NextResponse.json({
    ok: true,
    seeded: {
      claims:         4,
      invoices:       3,
      timeEntries:    timeEntries.length,
      reminders:      3,
      payments:       1,
    },
  })
}
