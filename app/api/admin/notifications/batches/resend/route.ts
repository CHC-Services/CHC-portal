import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { sendBulkImportSummary } from '../../../../../../lib/sendEmail'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST /api/admin/notifications/batches/resend
// Body: { batchId } — resend all entries in the batch
//    or { entryId } — resend a single entry
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { batchId, entryId } = await req.json() as { batchId?: string; entryId?: string }

  let entries: { id: string; nurseName: string; nurseEmail: string; claims: unknown; documents: unknown }[] = []

  if (entryId) {
    const e = await prisma.notificationBatchEntry.findUnique({ where: { id: entryId } })
    if (!e) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    entries = [e]
  } else if (batchId) {
    entries = await prisma.notificationBatchEntry.findMany({
      where: { batchId },
      orderBy: { nurseName: 'asc' },
    })
    if (entries.length === 0) return NextResponse.json({ error: 'Batch not found or empty' }, { status: 404 })
  } else {
    return NextResponse.json({ error: 'batchId or entryId required' }, { status: 400 })
  }

  let sent = 0
  let failed = 0

  for (const entry of entries) {
    const claims = (Array.isArray(entry.claims) ? entry.claims : []) as { claimId: string; dosStart: string | null; dosStop: string | null; totalBilled: number | null }[]
    const documents = (Array.isArray(entry.documents) ? entry.documents : []) as { documentTitle: string; category: string }[]

    if (claims.length === 0 && documents.length === 0) continue

    const ok = await sendBulkImportSummary({
      nurseEmail: entry.nurseEmail,
      nurseName: entry.nurseName,
      claims: claims.map(c => ({
        claimId: c.claimId,
        dosStart: c.dosStart ? new Date(c.dosStart) : null,
        dosStop:  c.dosStop  ? new Date(c.dosStop)  : null,
        totalBilled: c.totalBilled,
      })),
      documents,
    })

    if (ok) sent++; else failed++
  }

  return NextResponse.json({ ok: true, sent, failed })
}
