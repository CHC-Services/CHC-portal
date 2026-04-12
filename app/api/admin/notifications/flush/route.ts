import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { sendBulkImportSummary } from '../../../../../lib/sendEmail'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST /api/admin/notifications/flush
// Groups all PendingNotification records by nurse, sends one summary email per
// eligible nurse, records the batch for history, then deletes the queue.
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const filterNurseIds: string[] | undefined = Array.isArray(body.nurseIds) ? body.nurseIds : undefined
  const trigger: string = body.trigger || 'manual'

  const pending = await prisma.pendingNotification.findMany({
    where: filterNurseIds ? { nurseId: { in: filterNurseIds } } : undefined,
    orderBy: { createdAt: 'asc' },
  })

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, message: 'No pending notifications' })
  }

  // Group by nurseId
  const byNurse = new Map<string, typeof pending>()
  for (const n of pending) {
    if (!byNurse.has(n.nurseId)) byNurse.set(n.nurseId, [])
    byNurse.get(n.nurseId)!.push(n)
  }

  const nurseIds = [...byNurse.keys()]
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
    const docNotifs   = notifications.filter(n => n.type === 'document')
    const eligibleClaims = profile.notifyNewClaim     ? claimNotifs : []
    const eligibleDocs   = profile.notifyNewDocument  ? docNotifs   : []

    if (eligibleClaims.length === 0 && eligibleDocs.length === 0) { skipped++; continue }

    // Deduplicate claims by claimId
    const seenClaimIds = new Set<string>()
    const claims = eligibleClaims.reduce<{ claimId: string; dosStart: string | null; dosStop: string | null; totalBilled: number | null }[]>((acc, n) => {
      const p = n.payload as Record<string, any>
      const claimId = p.claimId || '—'
      if (seenClaimIds.has(claimId)) return acc
      seenClaimIds.add(claimId)
      acc.push({ claimId, dosStart: p.dosStart ?? null, dosStop: p.dosStop ?? null, totalBilled: typeof p.totalBilled === 'number' ? p.totalBilled : null })
      return acc
    }, [])

    // Deduplicate docs by title+category
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

    const ok = await sendBulkImportSummary({
      nurseEmail: email,
      nurseName: profile.displayName,
      claims: claimsForEmail,
      documents,
    })

    batchEntries.push({ nurseId: profile.id, nurseName: profile.displayName, nurseEmail: email, claims, documents, sentOk: ok })
    if (ok) sent++; else skipped++
  }

  // Record batch history (only if at least one entry was attempted)
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

  // Delete all flushed pending notifications
  await prisma.pendingNotification.deleteMany({
    where: { nurseId: { in: nurseIds } },
  })

  return NextResponse.json({ ok: true, sent, skipped })
}
