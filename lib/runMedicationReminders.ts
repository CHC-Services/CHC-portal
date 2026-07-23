import { prisma } from './prisma'
import { sendSms } from './sendSms'
import { isReminderDue } from './medicationReminders'

export async function runMedicationReminders(): Promise<{ sent: number; total: number }> {
  const meds = await (prisma.patientMedication.findMany as any)({
    where: { active: true, reminderSentAt: null },
    include: {
      patient: { select: { firstName: true, lastName: true } },
    },
  })

  const due = meds.filter((m: any) => isReminderDue(m.lastFillDate, m.daySupply, m.refillsRemaining))
  if (due.length === 0) return { sent: 0, total: 0 }

  let sent = 0
  const processedIds: string[] = []

  for (const med of due) {
    const patientName = `${med.patient.firstName} ${med.patient.lastName}`.trim()
    const message = `myProvider reminder: ${med.medicationName} for ${patientName} needs a refill soon. Last filled ${med.lastFillDate.toISOString().slice(0, 10)}.`

    // Recipients: whoever created this record, plus anyone else linked to the
    // patient who has explicitly opted in to reminders for this patient.
    const recipientUserIds = new Set<string>([med.createdByUserId])

    const [nurseLinks, guardianLinks] = await Promise.all([
      (prisma.nursePatient.findMany as any)({
        where: { patientId: med.patientId, medicationRemindersOptIn: true },
        include: { nurse: { select: { userId: true } } },
      }),
      (prisma.guardianPatient.findMany as any)({
        where: { patientId: med.patientId, medicationRemindersOptIn: true },
        select: { userId: true },
      }),
    ])
    for (const link of nurseLinks) recipientUserIds.add(link.nurse.userId)
    for (const link of guardianLinks) recipientUserIds.add(link.userId)

    const recipients = await prisma.user.findMany({
      where: { id: { in: [...recipientUserIds] } },
      select: { id: true, phone: true },
    })

    for (const r of recipients) {
      if (!r.phone) continue
      const result = await sendSms(r.phone, message)
      if (result.ok) sent++
    }

    // Mark this cycle as processed regardless of individual send outcomes —
    // a permanently bad phone number shouldn't retry forever.
    processedIds.push(med.id)
  }

  if (processedIds.length > 0) {
    await (prisma.patientMedication.updateMany as any)({
      where: { id: { in: processedIds } },
      data: { reminderSentAt: new Date() },
    })
  }

  return { sent, total: due.length }
}
