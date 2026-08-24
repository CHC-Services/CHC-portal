import { NextResponse } from 'next/server'
import { maybeAutoFlush } from '../../../../lib/flushNurseNotifications'

// Once-daily safety net (see vercel.json — Hobby-tier Vercel plan only
// allows daily crons). The real day-to-day 30-minute release comes from
// lib/flushNurseNotifications.ts's triggerOpportunisticFlush(), piggybacked
// on actual claim/EOB activity in app/api/admin/claims/**+documents/confirm.
// This just catches anything left queued after activity stopped for the day
// (or during Bulk Mode) so nothing sits unsent indefinitely.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await maybeAutoFlush('cron')
  if (!result) return NextResponse.json({ ok: true, sent: 0, skipped: 0, message: 'Bulk Mode is on — skipped' })

  return NextResponse.json({ ok: true, ...result })
}
