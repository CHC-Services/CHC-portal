import { prisma } from './prisma'
import { sendSms } from './sendSms'
import { isReminderDue } from './medicationReminders'

// Privacy-conscious masking for a plain-text SMS — never the full drug or
// pharmacy name over an unencrypted channel. "Lansoprazole" -> "Lans****";
// short/edge-case names just fall through with whatever's available (no
// crash on a name under 4 chars).
function maskMedicationName(name: string): string {
  return `${name.slice(0, 4)}****`
}
function maskPharmacyName(name: string): string {
  return `${name.slice(0, 5)} Pharm`
}

type DueMed = { medicationName: string; pharmacyName: string | null }

// One consolidated message per patient per day, however many of that
// patient's medications are due — never one text per medication (see
// runMedicationReminders below for the grouping that makes this true).
export function buildReminderMessage(patientLabel: string, meds: DueMed[]): string {
  const verb = meds.length > 1 ? 'are' : 'is'
  const lines = meds.map((m, i) => {
    const pharmacyPart = m.pharmacyName ? `, from ${maskPharmacyName(m.pharmacyName)}` : ''
    return `${i + 1}) ${maskMedicationName(m.medicationName)}${pharmacyPart}`
  })
  return [
    `Good Morning! There ${verb} ${meds.length} RX ready to reorder today for patient ${patientLabel}:`,
    '',
    ...lines,
    '',
    'For full details login to your COMING HOMECARE Portal @ cominghomecare.com',
  ].join('\n')
}

// First initial + last initial only, e.g. "J.S." — an SMS is an unsecured
// channel, so this stays well short of anything identifying.
export function patientInitialsLabel(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return `${firstName?.[0] || ''}.${lastName?.[0] || ''}.`
}

export async function runMedicationReminders(): Promise<{ sent: number; total: number }> {
  const meds = await (prisma.patientMedication.findMany as any)({
    where: { active: true, reminderSentAt: null },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      pharmacy: { select: { name: true } },
    },
  })

  const due = meds.filter((m: any) => isReminderDue(m.lastFillDate, m.daySupply, m.refillsRemaining))
  if (due.length === 0) return { sent: 0, total: 0 }

  // Grouped by patient — a recipient linked to a patient with several meds
  // due the same day gets one consolidated text, not one per medication.
  const byPatient = new Map<string, any[]>()
  for (const med of due) {
    if (!byPatient.has(med.patientId)) byPatient.set(med.patientId, [])
    byPatient.get(med.patientId)!.push(med)
  }

  let sent = 0
  const processedIds: string[] = []

  for (const [patientId, patientMeds] of byPatient) {
    const patient = patientMeds[0].patient
    const patientLabel = patientInitialsLabel(patient.firstName, patient.lastName)
    const message = buildReminderMessage(patientLabel, patientMeds.map((m: any) => ({
      medicationName: m.medicationName,
      pharmacyName: m.pharmacy?.name ?? null,
    })))

    // Recipients: whoever created each of these records, plus anyone else
    // linked to the patient who has explicitly opted in to reminders.
    const recipientUserIds = new Set<string>(patientMeds.map((m: any) => m.createdByUserId))

    const [nurseLinks, guardianLinks] = await Promise.all([
      (prisma.nursePatient.findMany as any)({
        where: { patientId, medicationRemindersOptIn: true },
        include: { nurse: { select: { userId: true } } },
      }),
      (prisma.guardianPatient.findMany as any)({
        where: { patientId, medicationRemindersOptIn: true },
        select: { userId: true },
      }),
    ])
    for (const link of nurseLinks) recipientUserIds.add(link.nurse.userId)
    for (const link of guardianLinks) recipientUserIds.add(link.userId)

    const recipients = await prisma.user.findMany({
      where: { id: { in: [...recipientUserIds] } },
      select: { id: true, phone: true, name: true },
    })

    for (const r of recipients) {
      if (!r.phone) continue
      const result = await sendSms(r.phone, message, 'reminder', r.name)
      if (result.ok) sent++
    }

    for (const m of patientMeds) processedIds.push(m.id)
  }

  if (processedIds.length > 0) {
    await (prisma.patientMedication.updateMany as any)({
      where: { id: { in: processedIds } },
      data: { reminderSentAt: new Date() },
    })
  }

  return { sent, total: due.length }
}
