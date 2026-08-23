import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { flushNurseNotifications } from '../../../../lib/flushNurseNotifications'

const BATCH_WINDOW_MINUTES = 30

// Runs every 5 minutes (see vercel.json). Releases each nurse's queued
// claim/EOB notifications once their oldest pending item has sat for 30
// minutes, so a session of several claim uploads/EOBs lands in one combined
// email instead of flooding the inbox. Skips entirely while Bulk Mode is on
// — that's a manual "hold everything" pause; turning it off is what forces
// an immediate release (see app/api/admin/notifications/flush/route.ts).
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const bulkSetting = await prisma.systemSetting.findUnique({ where: { key: 'bulkImportMode' } })
  if (bulkSetting?.value === 'true') {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, message: 'Bulk Mode is on — skipped' })
  }

  const { sent, skipped } = await flushNurseNotifications({ trigger: 'cron', minAgeMinutes: BATCH_WINDOW_MINUTES })

  return NextResponse.json({ ok: true, sent, skipped })
}
