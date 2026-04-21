import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function getNurseId(req: Request): string | null {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  if (!token) return null
  const session = verifyToken(token)
  if (!session?.nurseProfileId) return null
  return session.nurseProfileId
}

export async function GET(req: Request) {
  const nurseId = getNurseId(req)
  if (!nurseId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const claims = await prisma.claim.findMany({
    where: { nurseId },
    select: {
      claimId: true,
      resubmissionOf: true,
      totalBilled: true,
      hours: true,
      primaryAllowedAmt: true,
      secondaryAllowedAmt: true,
      totalReimbursed: true,
    },
  })

  // Build map: claimId string → claim (for root lookup)
  const byClaimId = new Map(claims.filter(c => c.claimId).map(c => [c.claimId!, c]))

  // Partition into roots and resubmissions
  const roots = claims.filter(c => !c.resubmissionOf)
  const resubsByParent = new Map<string, typeof claims>()
  for (const c of claims) {
    if (c.resubmissionOf) {
      if (!resubsByParent.has(c.resubmissionOf)) resubsByParent.set(c.resubmissionOf, [])
      resubsByParent.get(c.resubmissionOf)!.push(c)
    }
  }

  let totalBilled = 0
  let totalAllowed = 0
  let totalPaid = 0
  let paidHours = 0
  let paidReimbursed = 0

  for (const root of roots) {
    const chain = [root, ...(root.claimId ? (resubsByParent.get(root.claimId) ?? []) : [])]

    // Total billed: use root's amount (what was originally submitted)
    totalBilled += root.totalBilled ?? 0

    // Allowed + Paid: use best value across the chain (resubmission may have been paid when original wasn't)
    const bestAllowed = Math.max(...chain.map(c => (c.primaryAllowedAmt ?? 0) + (c.secondaryAllowedAmt ?? 0)))
    const bestPaid = Math.max(...chain.map(c => c.totalReimbursed ?? 0))
    totalAllowed += bestAllowed
    totalPaid += bestPaid

    // Avg $/hr: accumulate from chains that have a paid amount
    if (bestPaid > 0) {
      // Use hours from whichever claim in the chain has hours + payment data
      const paidClaim = chain.find(c => (c.totalReimbursed ?? 0) > 0 && (c.hours ?? 0) > 0)
        ?? chain.find(c => (c.hours ?? 0) > 0)
      const chainHours = paidClaim?.hours ?? root.hours ?? 0
      if (chainHours > 0) {
        paidHours += chainHours
        paidReimbursed += bestPaid
      }
    }
  }

  const avgPerHour = paidHours > 0 ? paidReimbursed / paidHours : null

  return NextResponse.json({ totalBilled, totalAllowed, totalPaid, avgPerHour })
}
