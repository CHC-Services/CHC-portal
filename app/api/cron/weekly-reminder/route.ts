import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { sendWeeklyHoursReminder } from '../../../../lib/sendEmail'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Check configured day of week (0=Sun … 6=Sat). Default: 5 (Friday)
  const daySetting = await (prisma.systemSetting.findUnique as any)({ where: { key: 'weeklyReminder.dayOfWeek' } })
  const configuredDay = daySetting ? parseInt(daySetting.value, 10) : 5
  const todayDay = new Date().getUTCDay()
  if (todayDay !== configuredDay) {
    return NextResponse.json({ skipped: true, reason: `Today is day ${todayDay}, configured day is ${configuredDay}` })
  }

  const [nurses, subjectRow, bodyRow] = await Promise.all([
    (prisma.nurseProfile.findMany as any)({
      where: { receiveNotifications: true, isDemo: false },
      include: { user: { select: { email: true } } },
    }),
    (prisma.systemSetting.findUnique as any)({ where: { key: 'weeklyReminder.subject' } }),
    (prisma.systemSetting.findUnique as any)({ where: { key: 'weeklyReminder.body' } }),
  ])

  const customSubject = subjectRow?.value || undefined
  const customBody    = bodyRow?.value    || undefined

  const results = await Promise.allSettled(
    nurses.map((nurse: any) =>
      sendWeeklyHoursReminder({
        to: nurse.user.email,
        displayName: nurse.displayName,
        nurseProfileId: nurse.id,
        customSubject,
        customBody,
      })
    )
  )

  const sent = results.filter(r => r.status === 'fulfilled' && r.value).length
  const failed = results.length - sent

  return NextResponse.json({ sent, failed, total: nurses.length })
}
