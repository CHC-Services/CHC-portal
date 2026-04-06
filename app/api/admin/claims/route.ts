import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

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

  if (!body.nurseId) {
    return NextResponse.json({ error: 'nurseId is required' }, { status: 400 })
  }

  const claim = await prisma.claim.create({
    data: {
      nurseId:             body.nurseId,
      claimId:             parseStr(body.claimId),
      providerName:        parseStr(body.providerName),
      dosStart:            parseDate(body.dosStart),
      dosStop:             parseDate(body.dosStop),
      totalBilled:         parseNum(body.totalBilled),
      claimStage:          parseStr(body.claimStage),
      primaryPayer:        parseStr(body.primaryPayer),
      primaryAllowedAmt:   parseNum(body.primaryAllowedAmt),
      primaryPaidAmt:      parseNum(body.primaryPaidAmt),
      primaryPaidDate:     parseDate(body.primaryPaidDate),
      primaryPaidTo:       parseStr(body.primaryPaidTo),
      secondaryPayer:      parseStr(body.secondaryPayer),
      secondaryAllowedAmt: parseNum(body.secondaryAllowedAmt),
      secondaryPaidAmt:    parseNum(body.secondaryPaidAmt),
      secondaryPaidDate:   parseDate(body.secondaryPaidDate),
      secondaryPaidTo:     parseStr(body.secondaryPaidTo),
      totalReimbursed:     parseNum(body.totalReimbursed),
      remainingBalance:    parseNum(body.remainingBalance),
      dateFullyFinalized:  parseDate(body.dateFullyFinalized),
      processingNotes:     parseStr(body.processingNotes),
    },
    include: {
      nurse: { select: { displayName: true, accountNumber: true } },
    },
  })

  return NextResponse.json({ ok: true, claim })
}

export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const claims = await (prisma.claim.findMany as any)({
    include: {
      nurse: { select: { displayName: true, accountNumber: true } }
    },
    orderBy: { dosStart: 'desc' }
  })

  return NextResponse.json({ claims })
}
