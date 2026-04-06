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
// Called when admin turns Bulk Import Mode OFF.
// Groups all PendingNotification records by nurse, respects individual
// notification preferences, sends one summary email per eligible nurse,
// then deletes all queued notifications.
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pending = await prisma.pendingNotification.findMany({
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

  // Load all affected nurse profiles + emails in one query
  const nurseIds = [...byNurse.keys()]
  const profiles = await prisma.nurseProfile.findMany({
    where: { id: { in: nurseIds } },
    include: { user: { select: { email: true } } },
  })

  let sent = 0
  let skipped = 0

  for (const profile of profiles) {
    const notifications = byNurse.get(profile.id) || []
    const email = profile.user?.email
    if (!email) { skipped++; continue }

    const claimNotifs = notifications.filter(n => n.type === 'claim')
    const docNotifs = notifications.filter(n => n.type === 'document')

    // Respect individual preferences — only include sections the nurse opted into
    const eligibleClaims = profile.notifyNewClaim ? claimNotifs : []
    const eligibleDocs = profile.notifyNewDocument ? docNotifs : []

    if (eligibleClaims.length === 0 && eligibleDocs.length === 0) {
      skipped++
      continue
    }

    // Parse claim payloads safely
    const claims = eligibleClaims.map(n => {
      const p = n.payload as Record<string, any>
      return {
        claimId: p.claimId || '—',
        dosStart: p.dosStart ? new Date(p.dosStart) : null,
        dosStop: p.dosStop ? new Date(p.dosStop) : null,
        totalBilled: typeof p.totalBilled === 'number' ? p.totalBilled : null,
      }
    })

    const documents = eligibleDocs.map(n => {
      const p = n.payload as Record<string, any>
      return {
        documentTitle: p.documentTitle || 'Untitled',
        category: p.category || 'General',
      }
    })

    sendBulkImportSummary({
      nurseEmail: email,
      nurseName: profile.displayName,
      claims,
      documents,
    }).catch(() => {})

    sent++
  }

  // Clear all pending notifications regardless of whether email was sent
  await prisma.pendingNotification.deleteMany({
    where: { nurseId: { in: nurseIds } },
  })

  return NextResponse.json({ ok: true, sent, skipped })
}
