import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { deriveCommercialClaimCycle } from '../../../../lib/medicaidPayCycle'
import { queueClaimNotification } from '../../../../lib/queueClaimNotification'
import { triggerOpportunisticFlush } from '../../../../lib/flushNurseNotifications'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

function parseDate(val: unknown): Date | null {
  if (!val || val === '') return null
  const d = new Date(String(val))
  return isNaN(d.getTime()) ? null : d
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = parseFloat(String(val).replace(/[$,]/g, ''))
  return isNaN(n) ? null : n
}

function parseStr(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null
  return String(val).trim()
}

// POST /api/admin/claims — create a single claim manually
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  if (!body.providerName) {
    return NextResponse.json({ error: 'providerName is required' }, { status: 400 })
  }

  // nurseId must be supplied directly — the admin claims UI resolves it from
  // the provider-name autocomplete selection. No name-matching fallback:
  // that's what used to make a typo'd or renamed provider silently attach to
  // the wrong nurse (or fail to attach at all).
  const nurseId: string | null = body.nurseId || null
  if (!nurseId) {
    return NextResponse.json({ error: 'nurseId is required — select a nurse from the suggestions list.' }, { status: 400 })
  }

  const primaryPayer = parseStr(body.primaryPayer)
  const primaryPaidDate = parseDate(body.primaryPaidDate)
  const secondaryPayer = parseStr(body.secondaryPayer)
  const secondaryPaidDate = parseDate(body.secondaryPaidDate)

  // Pay cycle / deposit date are always derived server-side from whichever
  // side is Medicaid — never trusted from the client — same as the dedicated
  // Medicaid claims flow, so a claim always lands in its real pay cycle.
  const { estPayCycle, depositDate } = deriveCommercialClaimCycle({ primaryPayer, primaryPaidDate, secondaryPayer, secondaryPaidDate })

  const claim = await prisma.claim.create({
    data: {
      nurseId,
      claimId:             parseStr(body.claimId),
      providerName:        parseStr(body.providerName),
      dosStart:            parseDate(body.dosStart),
      dosStop:             parseDate(body.dosStop),
      totalBilled:         parseNum(body.totalBilled),
      hours:               parseNum(body.hours),
      claimStage:          parseStr(body.claimStage),
      submitDate:          parseDate(body.submitDate),
      primaryPayer,
      primaryAllowedAmt:   parseNum(body.primaryAllowedAmt),
      primaryCO:           parseNum(body.primaryCO),
      primaryPaidAmt:      parseNum(body.primaryPaidAmt),
      primaryPaidDate,
      primaryPaidTo:       parseStr(body.primaryPaidTo),
      primaryCheckNum:     parseStr(body.primaryCheckNum),
      secondaryPayer,
      secondaryAllowedAmt: parseNum(body.secondaryAllowedAmt),
      secondaryCO:         parseNum(body.secondaryCO),
      secondaryPaidAmt:    parseNum(body.secondaryPaidAmt),
      secondaryPaidDate,
      secondaryPaidTo:     parseStr(body.secondaryPaidTo),
      secondaryCheckNum:   parseStr(body.secondaryCheckNum),
      totalReimbursed:     parseNum(body.totalReimbursed),
      remainingBalance:    parseNum(body.remainingBalance),
      dateFullyFinalized:  parseDate(body.dateFullyFinalized),
      checkReceivedDate:   parseDate(body.checkReceivedDate),
      estPayCycle,
      depositDate,
      resubmissionOf:      parseStr(body.resubmissionOf),
      remarkCodes:         parseStr(body.remarkCodes),
      processingNotes:     parseStr(body.processingNotes),
    },
    include: {
      nurse: { select: { displayName: true, firstName: true, lastName: true, accountNumber: true, isDemo: true } },
    },
  })

  // Notify the nurse — as "paid" if this claim was entered already-finalized
  // (e.g. a historical claim), otherwise as a new claim. Never both.
  queueClaimNotification(claim, claim.claimStage === 'Paid' ? 'paid' : 'created').catch(() => {})
  triggerOpportunisticFlush()

  return NextResponse.json({ ok: true, claim })
}

export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const claims = await (prisma.claim.findMany as any)({
    where: { nurse: { isDemo: false } },
    include: {
      nurse: { select: { displayName: true, firstName: true, lastName: true, accountNumber: true } }
    },
    orderBy: { dosStart: 'desc' }
  })

  triggerOpportunisticFlush()

  return NextResponse.json({ claims })
}
