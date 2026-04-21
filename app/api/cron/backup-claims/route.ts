import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

const KEEP_DAYS = 10 // retain last 10 daily auto-backups

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Create today's snapshot
  const claims = await prisma.claim.findMany({ orderBy: { createdAt: 'asc' } })

  await prisma.claimBackup.create({
    data: {
      label: 'auto',
      claimCount: claims.length,
      snapshot: claims as object,
    },
  })

  // Prune old auto backups beyond the retention window
  const oldAutoBackups = await prisma.claimBackup.findMany({
    where: { label: 'auto' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true },
  })

  if (oldAutoBackups.length > KEEP_DAYS) {
    const toDelete = oldAutoBackups.slice(KEEP_DAYS).map(b => b.id)
    await prisma.claimBackup.deleteMany({ where: { id: { in: toDelete } } })
  }

  return NextResponse.json({
    ok: true,
    claimCount: claims.length,
    pruned: Math.max(0, oldAutoBackups.length + 1 - KEEP_DAYS),
  })
}
