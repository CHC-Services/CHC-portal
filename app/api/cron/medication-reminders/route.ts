import { NextResponse } from 'next/server'
import { runMedicationReminders } from '../../../../lib/runMedicationReminders'
import { runPAReminders } from '../../../../lib/runPAReminders'

// Vercel cron invokes with GET — protected by CRON_SECRET header
export async function GET(req: Request) {
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [medications, priorAuths] = await Promise.all([
    runMedicationReminders(),
    runPAReminders(),
  ])
  return NextResponse.json({ ok: true, medications, priorAuths })
}
