import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { sendWeeklyHoursReminder } from '../../../../lib/sendEmail'

export async function GET(req: Request) {
  // Verify this is called by Vercel Cron (or in dev without a secret)
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const nurses = await prisma.nurseProfile.findMany({
    where: { receiveNotifications: true },
    include: { user: { select: { email: true } } },
  })

  const results = await Promise.allSettled(
    nurses.map(nurse =>
      sendWeeklyHoursReminder({
        to: nurse.user.email,
        displayName: nurse.displayName,
        nurseProfileId: nurse.id,
      })
    )
  )

  const sent = results.filter(r => r.status === 'fulfilled' && r.value).length
  const failed = results.length - sent

  return NextResponse.json({ sent, failed, total: nurses.length })
}
