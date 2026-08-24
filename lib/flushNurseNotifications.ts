import { prisma } from './prisma'
import { sendBulkImportSummary } from './sendEmail'

const BATCH_WINDOW_MINUTES = 30

// Shared per-nurse "group pending rows → suppress redundant ones → send one
// combined email → record batch history → delete the queue" logic, reused by
// both the manual admin flush route (Bulk Mode toggled off) and the cron
// route (30-minute batch window). Keeping this in one place avoids exactly
// the kind of duplicated claims-adjacent logic that caused confusion before
// (see the commercial/Medicaid claim consolidation cleanup).
export async function flushNurseNotifications({
  nurseIds: filterNurseIds,
  trigger = 'manual',
  minAgeMinutes,
}: {
  nurseIds?: string[]
  trigger?: string
  // When set, only flushes nurses whose OLDEST pending row is at least this
  // many minutes old — used by the cron route so a batch window stays open
  // long enough to collect same-session activity before sending.
  minAgeMinutes?: number
}): Promise<{ sent: number; skipped: number }> {
  const pending = await prisma.pendingNotification.findMany({
    where: filterNurseIds ? { nurseId: { in: filterNurseIds } } : undefined,
    orderBy: { createdAt: 'asc' },
  })

  if (pending.length === 0) return { sent: 0, skipped: 0 }

  const byNurse = new Map<string, typeof pending>()
  for (const n of pending) {
    if (!byNurse.has(n.nurseId)) byNurse.set(n.nurseId, [])
    byNurse.get(n.nurseId)!.push(n)
  }

  let nurseIds = [...byNurse.keys()]
  if (minAgeMinutes != null) {
    const cutoff = Date.now() - minAgeMinutes * 60_000
    nurseIds = nurseIds.filter(id => {
      const oldest = Math.min(...byNurse.get(id)!.map(r => r.createdAt.getTime()))
      return oldest <= cutoff
    })
  }
  if (nurseIds.length === 0) return { sent: 0, skipped: 0 }

  const profiles = await prisma.nurseProfile.findMany({
    where: { id: { in: nurseIds } },
    include: { user: { select: { email: true } } },
  })

  let sent = 0
  let skipped = 0
  const batchEntries: {
    nurseId: string; nurseName: string; nurseEmail: string
    claims: object[]; documents: object[]; sentOk: boolean
  }[] = []

  for (const profile of profiles) {
    const notifications = byNurse.get(profile.id) || []
    const email = profile.user?.email
    if (!email) { skipped++; continue }

    const claimNotifs = notifications.filter(n => n.type === 'claim')
    const paidNotifs   = notifications.filter(n => n.type === 'claimPaid')
    const docNotifs    = notifications.filter(n => n.type === 'document')

    // A claim that also has a pending "paid" notification in this same batch
    // doesn't need its own "new claim"/EOB line — the paid line covers it.
    const paidClaimIds = new Set(
      paidNotifs.map(n => (n.payload as Record<string, any>).claimId).filter(Boolean)
    )

    const eligibleClaims = profile.notifyNewClaim
      ? claimNotifs.filter(n => !paidClaimIds.has((n.payload as Record<string, any>).claimId))
      : []
    const eligiblePaid = profile.notifyNewClaim ? paidNotifs : []
    const eligibleDocs = profile.notifyNewDocument
      ? docNotifs.filter(n => {
          const p = n.payload as Record<string, any>
          if (p.category !== 'EOB' || !p.claimId) return true
          return !paidClaimIds.has(p.claimId)
        })
      : []

    if (eligibleClaims.length === 0 && eligiblePaid.length === 0 && eligibleDocs.length === 0) { skipped++; continue }

    const seenClaimIds = new Set<string>()
    const claims = eligibleClaims.reduce<{ claimId: string; dosStart: string | null; dosStop: string | null; totalBilled: number | null }[]>((acc, n) => {
      const p = n.payload as Record<string, any>
      const claimId = p.claimId || '—'
      if (seenClaimIds.has(claimId)) return acc
      seenClaimIds.add(claimId)
      acc.push({ claimId, dosStart: p.dosStart ?? null, dosStop: p.dosStop ?? null, totalBilled: typeof p.totalBilled === 'number' ? p.totalBilled : null })
      return acc
    }, [])

    const seenPaidIds = new Set<string>()
    const paid = eligiblePaid.reduce<{ claimId: string; totalReimbursed: number | null; paidDate: string | null }[]>((acc, n) => {
      const p = n.payload as Record<string, any>
      const claimId = p.claimId || '—'
      if (seenPaidIds.has(claimId)) return acc
      seenPaidIds.add(claimId)
      acc.push({ claimId, totalReimbursed: typeof p.totalReimbursed === 'number' ? p.totalReimbursed : null, paidDate: p.paidDate ?? null })
      return acc
    }, [])

    const seenDocs = new Set<string>()
    const documents = eligibleDocs.reduce<{ documentTitle: string; category: string }[]>((acc, n) => {
      const p = n.payload as Record<string, any>
      const key = `${p.documentTitle}|${p.category}`
      if (seenDocs.has(key)) return acc
      seenDocs.add(key)
      acc.push({ documentTitle: p.documentTitle || 'Untitled', category: p.category || 'General' })
      return acc
    }, [])

    const claimsForEmail = claims.map(c => ({
      claimId: c.claimId,
      dosStart: c.dosStart ? new Date(c.dosStart) : null,
      dosStop:  c.dosStop  ? new Date(c.dosStop)  : null,
      totalBilled: c.totalBilled,
    }))
    const paidForEmail = paid.map(c => ({
      claimId: c.claimId,
      totalReimbursed: c.totalReimbursed,
      paidDate: c.paidDate ? new Date(c.paidDate) : null,
    }))

    const ok = await sendBulkImportSummary({
      nurseEmail: email,
      nurseName: profile.displayName,
      claims: claimsForEmail,
      paidClaims: paidForEmail,
      documents,
    })

    batchEntries.push({ nurseId: profile.id, nurseName: profile.displayName, nurseEmail: email, claims: [...claims, ...paid], documents, sentOk: ok })
    if (ok) sent++; else skipped++
  }

  if (batchEntries.length > 0) {
    await prisma.notificationBatch.create({
      data: {
        trigger,
        totalSent: sent,
        totalSkipped: skipped,
        entries: { create: batchEntries },
      },
    })
  }

  await prisma.pendingNotification.deleteMany({
    where: { nurseId: { in: nurseIds } },
  })

  return { sent, skipped }
}

// Checks Bulk Mode and, if it's off, flushes any nurse whose oldest pending
// item has aged past the batch window. Returns null (no-op) while Bulk Mode
// is on. Shared by the daily cron backstop and by opportunistic calls below
// — this project's Vercel plan (Hobby) only allows daily crons, so anything
// closer to real 30-minute delivery has to come from piggybacking on actual
// claim/EOB activity instead of polling on a schedule.
export async function maybeAutoFlush(trigger: string): Promise<{ sent: number; skipped: number } | null> {
  const bulkSetting = await prisma.systemSetting.findUnique({ where: { key: 'bulkImportMode' } })
  if (bulkSetting?.value === 'true') return null
  return flushNurseNotifications({ trigger, minAgeMinutes: BATCH_WINDOW_MINUTES })
}

let lastOpportunisticRun = 0
const OPPORTUNISTIC_COOLDOWN_MS = 60_000

// Fire-and-forget hook for claim/EOB routes — throttled so a burst of rapid
// requests in one admin session doesn't each queue their own DB round-trip.
// Never awaited by callers; failures are swallowed since this is a
// best-effort nicety, not part of the request it's attached to.
export function triggerOpportunisticFlush(): void {
  const now = Date.now()
  if (now - lastOpportunisticRun < OPPORTUNISTIC_COOLDOWN_MS) return
  lastOpportunisticRun = now
  maybeAutoFlush('opportunistic').catch(() => {})
}
