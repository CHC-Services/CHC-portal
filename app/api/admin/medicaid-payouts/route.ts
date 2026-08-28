import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { isMedicaidPayerName } from '../../../../lib/medicaidPayCycle'
import { formalName } from '../../../../lib/formatName'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Admin-only view of what the nurse-side "Medicaid Pay Log" tab
// (app/nurse/claims/page.tsx) already shows each nurse for herself — one row
// per nurse per pay cycle with the total amount deposited that cycle. Built
// so admin can screenshot a specific nurse's payout and text/email it to her
// when she doesn't have portal access in front of her. Deliberately
// aggregated server-side (one row per nurse+cycle, not one per claim) since
// that's the "what did she get paid this cycle" number admin actually wants.
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const claims = await prisma.claim.findMany({
    where: {
      voidedAt: null,
      estPayCycle: { not: null },
      OR: [
        { primaryPayer: { contains: 'medicaid', mode: 'insensitive' } },
        { secondaryPayer: { contains: 'medicaid', mode: 'insensitive' } },
      ],
    },
    select: {
      nurseId: true,
      nurse: { select: { firstName: true, lastName: true, displayName: true } },
      primaryPayer: true,
      primaryPaidAmt: true,
      secondaryPayer: true,
      secondaryPaidAmt: true,
      estPayCycle: true,
      depositDate: true,
    },
  })

  type Row = { nurseId: string; nurseName: string; estPayCycle: number; depositDate: string | null; amount: number }
  const groups = new Map<string, Row>()

  for (const c of claims) {
    if (c.estPayCycle == null) continue
    const primaryIsMedicaid = isMedicaidPayerName(c.primaryPayer)
    const secondaryIsMedicaid = !primaryIsMedicaid && isMedicaidPayerName(c.secondaryPayer)
    const paidAmount = (primaryIsMedicaid ? c.primaryPaidAmt : secondaryIsMedicaid ? c.secondaryPaidAmt : null) ?? 0

    const key = `${c.nurseId}:${c.estPayCycle}`
    const existing = groups.get(key)
    if (existing) {
      existing.amount += paidAmount
    } else {
      groups.set(key, {
        nurseId: c.nurseId,
        nurseName: formalName(c.nurse) || c.nurse.displayName,
        estPayCycle: c.estPayCycle,
        depositDate: c.depositDate ? c.depositDate.toISOString().slice(0, 10) : null,
        amount: paidAmount,
      })
    }
  }

  const rows = Array.from(groups.values()).sort((a, b) => {
    if (a.depositDate !== b.depositDate) return (b.depositDate ?? '').localeCompare(a.depositDate ?? '')
    return a.nurseName.localeCompare(b.nurseName)
  })

  return NextResponse.json(rows)
}
