import { prisma } from './prisma'
import { medicationDueDate } from './medicationReminders'

export type CalendarItem = {
  id: string
  source: 'globalEvent' | 'personalReminder' | 'shift' | 'appointment' | 'medication' | 'priorAuth' | 'claimReminder' | 'document' | 'progressNote'
  title: string
  date: Date
  endDate?: Date
  patientId?: string
  patientName?: string
  category: string
  description?: string
  status?: string
  editable: boolean
}

// This nurse's full calendar: global broadcasts + their own personal
// reminders + shifts (assigned + open-and-claimable) + appointments +
// medication/PA/claim/document reminders across every patient they're
// actively linked to. Generalizes the merge app/api/nurse/calendar/route.ts
// used to do inline (GlobalEvent + NurseReminder only).
export async function getNurseCalendarFeed(nurseProfileId: string, session: { id: string; role: string }): Promise<CalendarItem[]> {
  const now = new Date()

  const links = await prisma.nursePatient.findMany({
    where: { nurseId: nurseProfileId, isActive: true },
    select: { patientId: true, patient: { select: { firstName: true, lastName: true } } },
  })
  const patientIds = links.map(l => l.patientId)
  const patientName = Object.fromEntries(links.map(l => [l.patientId, `${l.patient.firstName} ${l.patient.lastName}`]))

  const [globalEvents, personalReminders, myShifts, openShifts, appointments, meds, pas, claimReminders, documents, progressNotes] = await Promise.all([
    prisma.globalEvent.findMany({ where: { eventDate: { gte: now } }, orderBy: { eventDate: 'asc' } })
      .then(rows => rows.filter(e => e.targetRoles.length === 0 || e.targetRoles.includes(session.role))),
    prisma.nurseReminder.findMany({ where: { nurseId: nurseProfileId, completed: false, dueDate: { gte: now } }, orderBy: { dueDate: 'asc' } }),
    prisma.shift.findMany({ where: { nurseId: nurseProfileId, status: { not: 'cancelled' } }, orderBy: { startTime: 'asc' } }),
    patientIds.length ? prisma.shift.findMany({ where: { patientId: { in: patientIds }, status: { in: ['open', 'coverage_needed'] } }, orderBy: { startTime: 'asc' } }) : [],
    patientIds.length ? prisma.appointment.findMany({ where: { patientId: { in: patientIds }, status: { not: 'cancelled' } }, orderBy: { startTime: 'asc' } }) : [],
    patientIds.length ? prisma.patientMedication.findMany({ where: { patientId: { in: patientIds }, active: true }, select: { id: true, patientId: true, medicationName: true, lastFillDate: true, daySupply: true } }) : [],
    patientIds.length ? prisma.patientPA.findMany({ where: { patientId: { in: patientIds }, paEndDate: { not: null } } }) : [],
    prisma.claimReminder.findMany({ where: { nurseId: nurseProfileId, completed: false, dueDate: { gte: now } } }),
    patientIds.length ? prisma.patientDocument.findMany({ where: { patientId: { in: patientIds }, expiresAt: { not: null, gte: now } } }) : [],
    patientIds.length ? prisma.progressNote.findMany({ where: { patientId: { in: patientIds }, signedAt: { not: null }, voidedAt: null } }) : [],
  ])

  const items: CalendarItem[] = [
    ...globalEvents.map(e => ({ id: e.id, source: 'globalEvent' as const, title: e.title, date: e.eventDate, category: e.category, description: e.description ?? undefined, editable: false })),
    ...personalReminders.map(r => ({ id: r.id, source: 'personalReminder' as const, title: r.title, date: r.dueDate, category: r.category, description: r.notes ?? undefined, editable: true })),
    ...[...myShifts, ...openShifts].map(s => ({ id: s.id, source: 'shift' as const, title: s.status === 'assigned' ? 'Shift' : s.status === 'coverage_needed' ? 'Coverage Needed' : 'Open Shift', date: s.startTime, endDate: s.endTime, patientId: s.patientId, patientName: patientName[s.patientId], category: 'shift', status: s.status, editable: s.nurseId === nurseProfileId })),
    ...appointments.map(a => ({ id: a.id, source: 'appointment' as const, title: a.title, date: a.startTime, endDate: a.endTime ?? undefined, patientId: a.patientId, patientName: patientName[a.patientId], category: 'appointment', status: a.status, editable: true })),
    ...meds.map(m => ({ id: m.id, source: 'medication' as const, title: `Refill: ${m.medicationName}`, date: medicationDueDate(m.lastFillDate, m.daySupply), patientId: m.patientId, patientName: patientName[m.patientId], category: 'medication', editable: false })),
    ...pas.map(p => ({ id: p.id, source: 'priorAuth' as const, title: `PA Expiring: ${p.paNumber}`, date: new Date(p.paEndDate!), patientId: p.patientId, patientName: patientName[p.patientId], category: 'priorAuth', editable: false })),
    ...claimReminders.map(c => ({ id: c.id, source: 'claimReminder' as const, title: c.reason, date: c.dueDate, category: 'claim', editable: false })),
    ...documents.map(d => ({ id: d.id, source: 'document' as const, title: `Expiring: ${d.title}`, date: d.expiresAt!, patientId: d.patientId, patientName: patientName[d.patientId], category: 'document', editable: false })),
    ...progressNotes.map(n => ({ id: n.id, source: 'progressNote' as const, title: 'Progress Note', date: n.serviceDate, patientId: n.patientId, patientName: patientName[n.patientId], category: 'progressNote', editable: false })),
  ]

  return items.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// One patient's feed — everything patient-scoped (shifts, appointments, and
// that patient's own medication/PA/document reminders). Excludes GlobalEvent/
// NurseReminder/ClaimReminder since none of those are patient-scoped concepts.
// Reused by the admin Schedule tab and the family read-only calendar route.
export async function getPatientCalendarFeed(patientId: string): Promise<CalendarItem[]> {
  const now = new Date()
  const [shifts, appointments, meds, pas, documents] = await Promise.all([
    prisma.shift.findMany({ where: { patientId, status: { not: 'cancelled' } }, orderBy: { startTime: 'asc' } }),
    prisma.appointment.findMany({ where: { patientId, status: { not: 'cancelled' } }, orderBy: { startTime: 'asc' } }),
    prisma.patientMedication.findMany({ where: { patientId, active: true }, select: { id: true, patientId: true, medicationName: true, lastFillDate: true, daySupply: true } }),
    prisma.patientPA.findMany({ where: { patientId, paEndDate: { not: null } } }),
    prisma.patientDocument.findMany({ where: { patientId, expiresAt: { not: null, gte: now } } }),
  ])

  const items: CalendarItem[] = [
    ...shifts.map(s => ({ id: s.id, source: 'shift' as const, title: s.status === 'assigned' ? 'Shift' : s.status === 'coverage_needed' ? 'Coverage Needed' : 'Open Shift', date: s.startTime, endDate: s.endTime, patientId, category: 'shift', status: s.status, editable: true })),
    ...appointments.map(a => ({ id: a.id, source: 'appointment' as const, title: a.title, date: a.startTime, endDate: a.endTime ?? undefined, patientId, category: 'appointment', status: a.status, editable: true })),
    ...meds.map(m => ({ id: m.id, source: 'medication' as const, title: `Refill: ${m.medicationName}`, date: medicationDueDate(m.lastFillDate, m.daySupply), patientId, category: 'medication', editable: false })),
    ...pas.map(p => ({ id: p.id, source: 'priorAuth' as const, title: `PA Expiring: ${p.paNumber}`, date: new Date(p.paEndDate!), patientId, category: 'priorAuth', editable: false })),
    ...documents.map(d => ({ id: d.id, source: 'document' as const, title: `Expiring: ${d.title}`, date: d.expiresAt!, patientId, category: 'document', editable: false })),
  ]

  return items.sort((a, b) => a.date.getTime() - b.date.getTime())
}
