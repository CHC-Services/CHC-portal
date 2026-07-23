import { NextResponse } from 'next/server'
import { runMedicationReminders } from '../../../../lib/runMedicationReminders'

// Vercel cron invokes with GET — protected by CRON_SECRET header
export async function GET(req: Request) {
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runMedicationReminders()
  return NextResponse.json({ ok: true, ...result })
}
