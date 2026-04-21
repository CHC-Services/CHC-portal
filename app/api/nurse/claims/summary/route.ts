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
      claimStage: true,
      totalBilled: true,
      hours: true,
      primaryAllowedAmt: true,
      secondaryAllowedAmt: true,
      totalReimbursed: true,
    },
  })

  // Partition into roots and resubmissions
  const roots = claims.filter(c => !c.resubmissionOf)
  const resubsByParent = new Map<string, typeof claims>()
  for (const c of claims) {
    if (c.resubmissionOf) {
      if (!resubsByParent.has(c.resubmissionOf)) resubsByParent.set(c.resubmissionOf, [])
      resubsByParent.get(c.resubmissionOf)!.push(c)
    }
  }

  // Stage priority — higher = more advanced; used to pick the "current" status of a chain
  const STAGE_PRIORITY: Record<string, number> = {
    'Draft': 0, '': 0,
    'INS-1 Submitted': 1, 'INS-2 Submitted': 2, 'Resubmitted': 2,
    'Pending': 3, 'Info Requested': 3, 'Info Sent': 3, 'Appealed': 4,
    'Rejected': 5, 'Paid': 10, 'Denied': 10,
  }

  function stageBucket(stage: string | null): 'submitted' | 'pending' | 'paid' | 'denied' {
    switch (stage) {
      case 'INS-1 Submitted':
      case 'INS-2 Submitted':
      case 'Resubmitted':   return 'submitted'
      case 'Paid':          return 'paid'
      case 'Denied':
      case 'Rejected':      return 'denied'
      default:              return 'pending'
    }
  }

  let totalBilled = 0, totalAllowed = 0, totalPaid = 0, paidHours = 0, paidReimbursed = 0
  const statusCounts = { submitted: 0, pending: 0, paid: 0, denied: 0 }

  for (const root of roots) {
    const chain = [root, ...(root.claimId ? (resubsByParent.get(root.claimId) ?? []) : [])]

    // Financial totals
    totalBilled += root.totalBilled ?? 0
    const bestAllowed = Math.max(...chain.map(c => (c.primaryAllowedAmt ?? 0) + (c.secondaryAllowedAmt ?? 0)))
    const bestPaid = Math.max(...chain.map(c => c.totalReimbursed ?? 0))
    totalAllowed += bestAllowed
    totalPaid += bestPaid

    if (bestPaid > 0) {
      const paidClaim = chain.find(c => (c.totalReimbursed ?? 0) > 0 && (c.hours ?? 0) > 0)
        ?? chain.find(c => (c.hours ?? 0) > 0)
      const chainHours = paidClaim?.hours ?? root.hours ?? 0
      if (chainHours > 0) { paidHours += chainHours; paidReimbursed += bestPaid }
    }

    // Status count: use the most-advanced stage in the chain
    const currentStage = chain.reduce((best, c) => {
      const p = STAGE_PRIORITY[c.claimStage ?? ''] ?? 0
      return p > (STAGE_PRIORITY[best ?? ''] ?? 0) ? (c.claimStage ?? '') : best
    }, root.claimStage ?? '')
    statusCounts[stageBucket(currentStage)]++
  }

  const avgPerHour = paidHours > 0 ? paidReimbursed / paidHours : null

  return NextResponse.json({ totalBilled, totalAllowed, totalPaid, avgPerHour, statusCounts })
}
