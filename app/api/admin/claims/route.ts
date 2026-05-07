import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { runClaimReminders } from '../../../../lib/runClaimReminders'

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

  // Resolve nurseId by matching provider name against aliases (same as CSV import)
  let nurseId: string | null = body.nurseId || null
  if (!nurseId) {
    const profiles = await prisma.nurseProfile.findMany({
      select: { id: true, displayName: true, firstName: true, lastName: true, providerAliases: true },
    })
    const lower = body.providerName.toLowerCase().trim()
    const match = profiles.find(p => {
      const full = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().trim()
      const display = (p.displayName || '').toLowerCase().trim()
      const aliases = (p.providerAliases || []).map((a: string) => a.toLowerCase().trim())
      return full === lower || display === lower || aliases.includes(lower)
    })
    nurseId = match?.id || null
  }

  if (!nurseId) {
    return NextResponse.json({ error: `No provider matched "${body.providerName}". Check the name or set up a provider alias.` }, { status: 422 })
  }

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
      primaryPayer:        parseStr(body.primaryPayer),
      primaryAllowedAmt:   parseNum(body.primaryAllowedAmt),
      primaryCO:           parseNum(body.primaryCO),
      primaryPaidAmt:      parseNum(body.primaryPaidAmt),
      primaryPaidDate:     parseDate(body.primaryPaidDate),
      primaryPaidTo:       parseStr(body.primaryPaidTo),
      secondaryPayer:      parseStr(body.secondaryPayer),
      secondaryAllowedAmt: parseNum(body.secondaryAllowedAmt),
      secondaryCO:         parseNum(body.secondaryCO),
      secondaryPaidAmt:    parseNum(body.secondaryPaidAmt),
      secondaryPaidDate:   parseDate(body.secondaryPaidDate),
      secondaryPaidTo:     parseStr(body.secondaryPaidTo),
      totalReimbursed:     parseNum(body.totalReimbursed),
      remainingBalance:    parseNum(body.remainingBalance),
      dateFullyFinalized:  parseDate(body.dateFullyFinalized),
      processingNotes:     parseStr(body.processingNotes),
    },
    include: {
      nurse: { select: { displayName: true, accountNumber: true, isDemo: true } },
    },
  })

  // Check if this new claim (or any existing ones) now qualify for a prompt-pay reminder
  runClaimReminders().catch(() => {})

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
      nurse: { select: { displayName: true, accountNumber: true } }
    },
    orderBy: { dosStart: 'desc' }
  })

  return NextResponse.json({ claims })
}
