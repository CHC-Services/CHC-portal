import { NextResponse } from 'next/server'
import { runClaimReminders } from '../../../../lib/runClaimReminders'

// Vercel cron invokes with GET — protected by CRON_SECRET header
export async function GET(req: Request) {
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runClaimReminders()
  return NextResponse.json({ ok: true, ...result })
}
