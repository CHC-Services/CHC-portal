import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { sendDocumentExpirationReminder } from '../../../../lib/sendEmail'

export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Find all documents with expiration dates and reminder thresholds set
  const documents = await prisma.nurseDocument.findMany({
    where: {
      expiresAt: { not: null },
      reminderDays: { isEmpty: false },
    },
    include: {
      nurse: {
        include: { user: { select: { email: true, name: true } } },
      },
    },
  })

  let sent = 0
  let skipped = 0

  for (const doc of documents) {
    if (!doc.expiresAt) continue

    const msPerDay = 1000 * 60 * 60 * 24
    const daysUntil = Math.ceil((doc.expiresAt.getTime() - now.getTime()) / msPerDay)

    // Skip already expired documents
    if (daysUntil < 0) continue

    for (const threshold of doc.reminderDays) {
      // Fire when we're within 1 day of this threshold (e.g., threshold=30 fires when daysUntil is 29-30)
      if (daysUntil > threshold) continue
      if (doc.remindersSentDays.includes(threshold)) continue

      const nurseEmail = doc.nurse.user.email
      const nurseName = doc.nurse.displayName || doc.nurse.user.name

      const ok = await sendDocumentExpirationReminder({
        nurseEmail,
        nurseName,
        documentTitle: doc.title,
        expiresAt: doc.expiresAt,
        daysUntilExpiry: daysUntil,
      })

      if (ok) {
        await prisma.nurseDocument.update({
          where: { id: doc.id },
          data: { remindersSentDays: { push: threshold } },
        })
        sent++
      } else {
        skipped++
      }
    }
  }

  return NextResponse.json({ ok: true, sent, skipped })
}
