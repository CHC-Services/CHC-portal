import { prisma } from './prisma'

type ClaimForNotification = {
  nurseId: string
  claimId: string | null
  dosStart: Date | null
  dosStop: Date | null
  totalBilled: number | null
  totalReimbursed: number | null
  dateFullyFinalized: Date | null
  primaryPaidDate: Date | null
}

// Queues a PendingNotification for a claim create / paid-transition event —
// picked up later by lib/flushNurseNotifications.ts on its 30-minute batch
// window (or an immediate manual flush). Skips demo nurses, matching the
// isDemo guard already used by lib/runHoursAlerts.ts.
export async function queueClaimNotification(claim: ClaimForNotification, event: 'created' | 'paid'): Promise<void> {
  const nurse = await prisma.nurseProfile.findUnique({ where: { id: claim.nurseId }, select: { isDemo: true } })
  if (!nurse || nurse.isDemo) return

  if (event === 'paid') {
    await prisma.pendingNotification.create({
      data: {
        nurseId: claim.nurseId,
        type: 'claimPaid',
        payload: {
          claimId: claim.claimId,
          totalReimbursed: claim.totalReimbursed,
          paidDate: claim.dateFullyFinalized ?? claim.primaryPaidDate ?? new Date(),
        },
      },
    })
  } else {
    await prisma.pendingNotification.create({
      data: {
        nurseId: claim.nurseId,
        type: 'claim',
        payload: {
          claimId: claim.claimId,
          dosStart: claim.dosStart,
          dosStop: claim.dosStop,
          totalBilled: claim.totalBilled,
        },
      },
    })
  }
}
