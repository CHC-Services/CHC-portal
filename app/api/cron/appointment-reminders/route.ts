import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { sendSms } from '../../../../lib/sendSms'
import { sendAppointmentReminder } from '../../../../lib/sendEmail'

// Daily check for AppointmentReminder rows that have come due — day-level
// offsets only (this app's Vercel plan only allows daily crons, so
// hour/minute-precision reminders aren't reliably deliverable; see
// AppointmentForm.tsx's own note on this). Fires once per reminder row
// (sentAt is the idempotency marker) via the appointment's own
// reminderChannel, to every nurse + guardian currently linked to the
// patient — same recipient pattern lib/runPatientDocumentReminders.ts uses.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const msPerDay = 1000 * 60 * 60 * 24

  const dueCandidates = await (prisma.appointmentReminder.findMany as any)({
    where: { sentAt: null, appointment: { status: { not: 'cancelled' } } },
    include: { appointment: { include: { patient: { select: { firstName: true, lastName: true } } } } },
  })

  let sent = 0
  let skipped = 0
  const firedIds: string[] = []

  for (const reminder of dueCandidates) {
    const appt = reminder.appointment
    const daysUntil = Math.ceil((appt.startTime.getTime() - now.getTime()) / msPerDay)
    if (daysUntil < 0 || daysUntil > reminder.offsetDays) continue

    firedIds.push(reminder.id)
    if (appt.reminderChannel === 'none') continue

    const [nurseLinks, guardianLinks] = await Promise.all([
      prisma.nursePatient.findMany({
        where: { patientId: appt.patientId, isActive: true },
        include: { nurse: { select: { userId: true } } },
      }),
      prisma.guardianPatient.findMany({
        where: { patientId: appt.patientId },
        select: { userId: true },
      }),
    ])
    const recipientUserIds = new Set<string>()
    for (const link of nurseLinks) recipientUserIds.add(link.nurse.userId)
    for (const link of guardianLinks) recipientUserIds.add(link.userId)
    if (recipientUserIds.size === 0) continue

    const recipients = await prisma.user.findMany({
      where: { id: { in: [...recipientUserIds] } },
      select: { email: true, phone: true, name: true },
    })
    const patientName = `${appt.patient.firstName} ${appt.patient.lastName}`.trim()

    for (const r of recipients) {
      const wantsEmail = appt.reminderChannel === 'email' || appt.reminderChannel === 'both'
      const wantsText = appt.reminderChannel === 'text' || appt.reminderChannel === 'both'

      if (wantsEmail && r.email) {
        const ok = await sendAppointmentReminder({
          toEmail: r.email,
          recipientName: r.name || 'there',
          patientName,
          appointmentTitle: appt.title,
          startTime: appt.startTime,
          location: appt.location,
          offsetDays: reminder.offsetDays,
        })
        if (ok) sent++; else skipped++
      }
      if (wantsText && r.phone) {
        const whenStr = appt.startTime.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        const result = await sendSms(r.phone, `Reminder: ${patientName}'s appointment "${appt.title}" is ${whenStr}${appt.location ? ` at ${appt.location}` : ''}.`)
        if (result.ok) sent++; else skipped++
      }
    }
  }

  if (firedIds.length > 0) {
    await (prisma.appointmentReminder.updateMany as any)({
      where: { id: { in: firedIds } },
      data: { sentAt: now },
    })
  }

  return NextResponse.json({ ok: true, sent, skipped, processed: firedIds.length })
}
