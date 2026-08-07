import { NextResponse } from 'next/server'
import { runHoursSummary } from '../../../../lib/runHoursAlerts'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const result = await runHoursSummary()
  return NextResponse.json(result)
}
