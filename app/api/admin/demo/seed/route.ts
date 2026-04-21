import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// Wipes and re-seeds mock data for a demo nurse profile
export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nurseId } = await req.json()
  if (!nurseId) return NextResponse.json({ error: 'nurseId required' }, { status: 400 })

  const profile = await (prisma.nurseProfile.findUnique as any)({
    where: { id: nurseId },
    select: { id: true, isDemo: true, userId: true },
  })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (!profile.isDemo) return NextResponse.json({ error: 'This profile is not marked as a demo account.' }, { status: 400 })

  // ── Clear existing mock data ────────────────────────────────────────────────
  await (prisma.timeEntry.deleteMany as any)({ where: { nurseId } })
  await (prisma.claim.deleteMany as any)({ where: { nurseId } })
  await (prisma.invoice.deleteMany as any)({ where: { nurseId } })

  // ── Seed time entries — last 3 months ──────────────────────────────────────
  const today = new Date()
  const timeEntries: { nurseId: string; workDate: Date; hours: number; notes: string; billed: boolean }[] = []

  const entryNotes = [
    'Home visit — patient care',
    'Wound care and vitals check',
    'Medication administration',
    'Therapy session support',
    'Discharge planning coordination',
    'Patient transport and assessment',
    'Weekly wellness check',
    'IV therapy and monitoring',
  ]

  for (let weeksAgo = 0; weeksAgo < 12; weeksAgo++) {
    const baseDate = new Date(today)
    baseDate.setDate(today.getDate() - weeksAgo * 7)
    const daysInWeek = weeksAgo === 0 ? [0, 2] : [1, 3, 4]
    for (const dayOffset of daysInWeek) {
      const d = new Date(baseDate)
      d.setDate(baseDate.getDate() - dayOffset)
      timeEntries.push({
        nurseId,
        workDate: d,
        hours: [4, 6, 7, 8, 8, 6, 7][Math.floor(Math.random() * 7)],
        notes: entryNotes[Math.floor(Math.random() * entryNotes.length)],
        billed: weeksAgo >= 4,
      })
    }
  }

  await (prisma.timeEntry.createMany as any)({ data: timeEntries })

  // ── Seed claims ────────────────────────────────────────────────────────────
  const claimStages = [
    { stage: 'Paid',             primary: 'Medicaid',  primaryPaid: 980.00,  secondary: null,       secondaryPaid: null,   finalized: true  },
    { stage: 'Paid',             primary: 'BCBS',      primaryPaid: 1240.00, secondary: 'Medicaid', secondaryPaid: 120.00, finalized: true  },
    { stage: 'INS-1 Submitted',  primary: 'Medicaid',  primaryPaid: null,    secondary: null,       secondaryPaid: null,   finalized: false },
    { stage: 'Pending',          primary: 'Aetna',     primaryPaid: null,    secondary: null,       secondaryPaid: null,   finalized: false },
    { stage: 'Info Requested',   primary: 'BCBS',      primaryPaid: null,    secondary: null,       secondaryPaid: null,   finalized: false },
    { stage: 'Resubmitted',      primary: 'Medicaid',  primaryPaid: null,    secondary: null,       secondaryPaid: null,   finalized: false },
    { stage: 'Denied',           primary: 'Aetna',     primaryPaid: 0,       secondary: null,       secondaryPaid: null,   finalized: true  },
    { stage: 'Appealed',         primary: 'BCBS',      primaryPaid: null,    secondary: null,       secondaryPaid: null,   finalized: false },
  ]

  const claimData = claimStages.map((c, i) => {
    const billed = 1200 + i * 180
    const totalPaid = (c.primaryPaid ?? 0) + (c.secondaryPaid ?? 0)
    const dosStart = new Date(today)
    dosStart.setDate(today.getDate() - (i + 1) * 18)
    const dosStop = new Date(dosStart)
    dosStop.setDate(dosStart.getDate() + 13)
    return {
      nurseId,
      claimId:         `DEMO-2024-${String(i + 1).padStart(4, '0')}`,
      providerName:    'Nurse Demo',
      dosStart,
      dosStop,
      totalBilled:     billed,
      claimStage:      c.stage,
      primaryPayer:    c.primary,
      primaryAllowedAmt: c.primaryPaid ? c.primaryPaid * 1.05 : null,
      primaryPaidAmt:  c.primaryPaid,
      primaryPaidDate: c.primaryPaid ? new Date(dosStop.getTime() + 30 * 86400000) : null,
      primaryPaidTo:   c.primaryPaid ? 'Provider' : null,
      secondaryPayer:  c.secondary,
      secondaryPaidAmt: c.secondaryPaid,
      secondaryPaidDate: c.secondaryPaid ? new Date(dosStop.getTime() + 45 * 86400000) : null,
      secondaryPaidTo: c.secondaryPaid ? 'Provider' : null,
      totalReimbursed: totalPaid || null,
      remainingBalance: c.finalized ? billed - totalPaid : null,
      dateFullyFinalized: c.finalized ? new Date(dosStop.getTime() + 60 * 86400000) : null,
      processingNotes: i === 4 ? 'Missing plan of care — please resubmit with attached documentation.' : null,
    }
  })

  await (prisma.claim.createMany as any)({ data: claimData })

  // ── Seed invoices ──────────────────────────────────────────────────────────
  const demoEmail = 'demo@cominghomecare.com'

  const inv1DueDate = new Date(today)
  inv1DueDate.setDate(today.getDate() + 14)

  const inv2DueDate = new Date(today)
  inv2DueDate.setDate(today.getDate() - 45)

  await (prisma.invoice.createMany as any)({
    data: [
      {
        nurseId,
        invoiceNumber: 'CHC-2024-DEMO',
        nurseName:     'Nurse Demo',
        nurseEmail:    demoEmail,
        totalAmount:   48.00,
        paidAmount:    0,
        dueTerm:       '30',
        dueDate:       inv1DueDate,
        status:        'Sent',
        notes:         'Demo invoice — 8 claims processed this billing cycle.',
      },
      {
        nurseId,
        invoiceNumber: 'CHC-2024-DEM2',
        nurseName:     'Nurse Demo',
        nurseEmail:    demoEmail,
        totalAmount:   36.00,
        paidAmount:    36.00,
        dueTerm:       '30',
        dueDate:       inv2DueDate,
        status:        'Paid',
        notes:         'Demo invoice — prior billing cycle. Paid via Venmo.',
      },
    ],
  })

  return NextResponse.json({ ok: true, seeded: { timeEntries: timeEntries.length, claims: claimData.length, invoices: 2 } })
}
