import { prisma } from './prisma'
import { sendDocumentExpirationReminder } from './sendEmail'

const LEAD_DAYS = 14

export async function runPatientDocumentReminders(): Promise<{ sent: number; skipped: number }> {
  const docs = await (prisma.patientDocument.findMany as any)({
    where: { expiresAt: { not: null }, reminderSentAt: null },
    include: { patient: { select: { firstName: true, lastName: true, documentRemindersEnabled: true } } },
  })

  const now = new Date()
  const msPerDay = 1000 * 60 * 60 * 24
  let sent = 0
  let skipped = 0
  const firedIds: string[] = []

  for (const doc of docs) {
    if (!doc.expiresAt || !doc.patient?.documentRemindersEnabled) continue
    const daysUntil = Math.ceil((doc.expiresAt.getTime() - now.getTime()) / msPerDay)
    if (daysUntil < 0 || daysUntil > LEAD_DAYS) continue

    // Recipients: everyone currently linked to the patient — gated by the
    // patient-level documentRemindersEnabled toggle, not a per-link opt-in.
    const [nurseLinks, guardianLinks] = await Promise.all([
      (prisma.nursePatient.findMany as any)({
        where: { patientId: doc.patientId, isActive: true },
        include: { nurse: { select: { userId: true } } },
      }),
      (prisma.guardianPatient.findMany as any)({
        where: { patientId: doc.patientId },
        select: { userId: true },
      }),
    ])
    const recipientUserIds = new Set<string>()
    for (const link of nurseLinks) recipientUserIds.add(link.nurse.userId)
    for (const link of guardianLinks) recipientUserIds.add(link.userId)

    const patientName = `${doc.patient.firstName} ${doc.patient.lastName}`.trim()
    if (recipientUserIds.size > 0) {
      const recipients = await prisma.user.findMany({
        where: { id: { in: [...recipientUserIds] } },
        select: { email: true, name: true },
      })
      for (const r of recipients) {
        if (!r.email) continue
        const ok = await sendDocumentExpirationReminder({
          nurseEmail: r.email,
          nurseName: r.name || 'there',
          documentTitle: `${doc.title} (${patientName})`,
          expiresAt: doc.expiresAt,
          daysUntilExpiry: daysUntil,
        })
        if (ok) sent++
        else skipped++
      }
    }

    // Mark this document as processed regardless of individual send
    // outcomes — a bad email shouldn't retry forever.
    firedIds.push(doc.id)
  }

  if (firedIds.length > 0) {
    await (prisma.patientDocument.updateMany as any)({
      where: { id: { in: firedIds } },
      data: { reminderSentAt: new Date() },
    })
  }

  return { sent, skipped }
}
