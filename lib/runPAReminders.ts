import { prisma } from './prisma'
import { sendSms } from './sendSms'

const LEAD_DAYS = 21 // 3 weeks before paEndDate

export async function runPAReminders(): Promise<{ sent: number; total: number }> {
  const pas = await (prisma.patientPA.findMany as any)({
    where: { reminderSentAt: null, paEndDate: { not: null } },
    include: { patient: { select: { firstName: true, lastName: true, paRemindersEnabled: true } } },
  })

  const now = new Date()
  const msPerDay = 1000 * 60 * 60 * 24
  const due = pas.filter((pa: any) => {
    if (!pa.patient?.paRemindersEnabled || !pa.paEndDate) return false
    const end = new Date(pa.paEndDate)
    if (isNaN(end.getTime())) return false
    const daysUntil = Math.ceil((end.getTime() - now.getTime()) / msPerDay)
    return daysUntil >= 0 && daysUntil <= LEAD_DAYS
  })
  if (due.length === 0) return { sent: 0, total: 0 }

  let sent = 0
  const processedIds: string[] = []

  for (const pa of due) {
    const patientName = `${pa.patient.firstName} ${pa.patient.lastName}`.trim()
    const message = `myProvider reminder: ${patientName}'s Prior Authorization (${pa.paNumber}) expires ${pa.paEndDate}. Renew soon.`

    // Recipients: everyone currently linked to the patient — no separate
    // per-link opt-in for this reminder, it's gated by the patient-level
    // paRemindersEnabled toggle instead.
    const [nurseLinks, guardianLinks] = await Promise.all([
      (prisma.nursePatient.findMany as any)({
        where: { patientId: pa.patientId, isActive: true },
        include: { nurse: { select: { userId: true } } },
      }),
      (prisma.guardianPatient.findMany as any)({
        where: { patientId: pa.patientId },
        select: { userId: true },
      }),
    ])
    const recipientUserIds = new Set<string>()
    for (const link of nurseLinks) recipientUserIds.add(link.nurse.userId)
    for (const link of guardianLinks) recipientUserIds.add(link.userId)

    if (recipientUserIds.size > 0) {
      const recipients = await prisma.user.findMany({
        where: { id: { in: [...recipientUserIds] } },
        select: { id: true, phone: true },
      })
      for (const r of recipients) {
        if (!r.phone) continue
        const result = await sendSms(r.phone, message)
        if (result.ok) sent++
      }
    }

    // Mark this PA as processed regardless of individual send outcomes —
    // a permanently bad phone number shouldn't retry forever.
    processedIds.push(pa.id)
  }

  if (processedIds.length > 0) {
    await (prisma.patientPA.updateMany as any)({
      where: { id: { in: processedIds } },
      data: { reminderSentAt: new Date() },
    })
  }

  return { sent, total: due.length }
}
