import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// DELETE — remove a single backup record
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.claimBackup.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// POST /api/admin/backup/claims/[id]/restore — restore claims from this snapshot
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const backup = await prisma.claimBackup.findUnique({ where: { id } })
  if (!backup) return NextResponse.json({ error: 'Backup not found.' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshotClaims = backup.snapshot as any[]

  // Collect the IDs in the snapshot so we can delete claims that were added after it
  const snapshotIds = new Set(snapshotClaims.map((c: any) => c.id))

  // Delete claims that don't exist in this snapshot (created after the backup)
  const currentClaims = await prisma.claim.findMany({ select: { id: true } })
  const toDelete = currentClaims.filter(c => !snapshotIds.has(c.id)).map(c => c.id)
  if (toDelete.length > 0) {
    await prisma.claim.deleteMany({ where: { id: { in: toDelete } } })
  }

  // Upsert every claim from the snapshot
  for (const claim of snapshotClaims) {
    const { id: cid, createdAt, updatedAt, nurseId, ...fields } = claim

    // Parse date strings back to Date objects for DateTime fields
    const parseDate = (v: string | null | undefined) => (v ? new Date(v) : null)

    const data = {
      ...fields,
      nurseId,
      dosStart:             parseDate(fields.dosStart),
      dosStop:              parseDate(fields.dosStop),
      primaryPaidDate:      parseDate(fields.primaryPaidDate),
      secondaryPaidDate:    parseDate(fields.secondaryPaidDate),
      dateFullyFinalized:   parseDate(fields.dateFullyFinalized),
      submitDate:           parseDate(fields.submitDate),
      submitDateReminderSentAt: parseDate(fields.submitDateReminderSentAt),
    }

    await prisma.claim.upsert({
      where: { id: cid },
      update: { ...data, updatedAt: new Date() },
      create: { id: cid, ...data, createdAt: new Date(createdAt), updatedAt: new Date() },
    })
  }

  return NextResponse.json({ ok: true, restored: snapshotClaims.length, deleted: toDelete.length })
}
