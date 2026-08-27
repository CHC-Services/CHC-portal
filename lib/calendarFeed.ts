import { prisma } from './prisma'
import { medicationDueDate, effectiveRefillStatus } from './medicationReminders'

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
  // Only populated for globalEvent items in the admin management view
  // (app/api/admin/calendar/route.ts's no-patientId branch) — the raw
  // audience roles, for pre-filling the Audience dropdown on edit.
  targetRoles?: string[]
  // shift items only — powers the nurse-name and has/hasn't-progress-notes
  // filters.
  nurseName?: string
  hasProgressNotes?: boolean
  // appointment items only — true means date/endDate are date boundaries
  // (possibly spanning multiple days), not a same-day time range. Drives
  // CalendarGrid's month-view spanning-bar rendering.
  allDay?: boolean
}

// Optional date-range window shared by every feed function below. When
// omitted, callers get today's original behavior (reminders/expirations
// default to "upcoming only", shifts/appointments unbounded) — every current
// call site now passes a real range (see app/api/*/calendar/route.ts), but
// this keeps the functions safe to call without one too.
export type DateRange = { start?: Date; end?: Date }

// Shared ?start=&end= parsing for every /api/*/calendar route (and the new
// per-patient one) — both are plain YYYY-MM-DD or full ISO strings.
export function parseDateRangeParams(url: URL): DateRange {
  const startParam = url.searchParams.get('start')
  const endParam = url.searchParams.get('end')
  const start = startParam ? new Date(startParam) : undefined
  const end = endParam ? new Date(endParam) : undefined
  return {
    start: start && !isNaN(start.getTime()) ? start : undefined,
    end: end && !isNaN(end.getTime()) ? end : undefined,
  }
}

function dateFilter(range: DateRange | undefined, fallbackGteNow: Date | null) {
  if (range?.start || range?.end) {
    const f: { gte?: Date; lte?: Date } = {}
    if (range.start) f.gte = range.start
    if (range.end) f.lte = range.end
    return f
  }
  return fallbackGteNow ? { gte: fallbackGteNow } : undefined
}

// This nurse's full calendar: global broadcasts + their own personal
// reminders + shifts (assigned + open-and-claimable) + appointments +
// medication/PA/claim/document reminders across every patient they're
// actively linked to. Generalizes the merge app/api/nurse/calendar/route.ts
// used to do inline (GlobalEvent + NurseReminder only).
export async function getNurseCalendarFeed(nurseProfileId: string, session: { id: string; role: string }, range?: DateRange): Promise<CalendarItem[]> {
  const now = new Date()

  const links = await prisma.nursePatient.findMany({
    where: { nurseId: nurseProfileId, isActive: true },
    select: { patientId: true, patient: { select: { firstName: true, lastName: true } } },
  })
  const patientIds = links.map(l => l.patientId)
  const patientName = Object.fromEntries(links.map(l => [l.patientId, `${l.patient.firstName} ${l.patient.lastName}`]))

  const dueFilter = dateFilter(range, now)
  const startTimeFilter = dateFilter(range, null)

  // ClaimReminder is deliberately excluded from the calendar feed — billing
  // follow-ups stay an email-only nudge (see app/api/admin/claims/reminders/
  // route.ts) rather than cluttering the visual calendar.
  const [globalEvents, personalReminders, myShifts, openShifts, appointments, meds, pas, documents, progressNotes] = await Promise.all([
    prisma.globalEvent.findMany({ where: { eventDate: dateFilter(range, now) }, orderBy: { eventDate: 'asc' } })
      .then(rows => rows.filter(e => e.targetRoles.length === 0 || e.targetRoles.includes(session.role))),
    prisma.nurseReminder.findMany({ where: { nurseId: nurseProfileId, completed: false, dueDate: dueFilter }, orderBy: { dueDate: 'asc' } }),
    prisma.shift.findMany({ where: { nurseId: nurseProfileId, status: { not: 'cancelled' }, ...(startTimeFilter ? { startTime: startTimeFilter } : {}) }, orderBy: { startTime: 'asc' }, include: { _count: { select: { progressNotes: true } } } }),
    patientIds.length ? prisma.shift.findMany({ where: { patientId: { in: patientIds }, status: { in: ['open', 'coverage_needed'] }, ...(startTimeFilter ? { startTime: startTimeFilter } : {}) }, orderBy: { startTime: 'asc' }, include: { _count: { select: { progressNotes: true } } } }) : [],
    patientIds.length ? prisma.appointment.findMany({ where: { patientId: { in: patientIds }, status: { not: 'cancelled' }, ...(startTimeFilter ? { startTime: startTimeFilter } : {}) }, orderBy: { startTime: 'asc' } }) : [],
    patientIds.length ? prisma.patientMedication.findMany({ where: { patientId: { in: patientIds }, active: true }, select: { id: true, patientId: true, medicationName: true, lastFillDate: true, daySupply: true, refillsRemaining: true, refillOrderedAt: true } }) : [],
    patientIds.length ? prisma.patientPA.findMany({ where: { patientId: { in: patientIds }, paEndDate: { not: null } } }) : [],
    patientIds.length ? prisma.patientDocument.findMany({ where: { patientId: { in: patientIds }, expiresAt: { not: null, ...dueFilter } } }) : [],
    patientIds.length ? prisma.progressNote.findMany({ where: { patientId: { in: patientIds }, signedAt: { not: null }, voidedAt: null, ...(startTimeFilter ? { serviceDate: startTimeFilter } : {}) } }) : [],
  ])

  const items: CalendarItem[] = [
    ...globalEvents.map(e => ({ id: e.id, source: 'globalEvent' as const, title: e.title, date: e.eventDate, category: e.category, description: e.description ?? undefined, editable: false })),
    ...personalReminders.map(r => ({ id: r.id, source: 'personalReminder' as const, title: r.title, date: r.dueDate, category: r.category, description: r.notes ?? undefined, editable: true })),
    ...[...myShifts, ...openShifts].map(s => ({ id: s.id, source: 'shift' as const, title: s.status === 'assigned' ? 'Shift' : s.status === 'coverage_needed' ? 'Coverage Needed' : 'Open Shift', date: s.startTime, endDate: s.endTime, patientId: s.patientId, patientName: patientName[s.patientId], category: 'shift', status: s.status, editable: s.nurseId === nurseProfileId, hasProgressNotes: s._count.progressNotes > 0 })),
    ...appointments.map(a => ({ id: a.id, source: 'appointment' as const, title: a.title, date: a.startTime, endDate: a.endTime ?? undefined, patientId: a.patientId, patientName: patientName[a.patientId], category: 'appointment', status: a.status, editable: true, allDay: a.allDay })),
    ...meds.map(m => ({ id: m.id, source: 'medication' as const, title: `Refill: ${m.medicationName}`, date: medicationDueDate(m.lastFillDate, m.daySupply), patientId: m.patientId, patientName: patientName[m.patientId], category: 'medication', status: effectiveRefillStatus(m.refillOrderedAt, m.lastFillDate, m.daySupply, m.refillsRemaining), editable: false })),
    ...pas.map(p => ({ id: p.id, source: 'priorAuth' as const, title: `PA Expiring: ${p.paNumber}`, date: new Date(p.paEndDate!), patientId: p.patientId, patientName: patientName[p.patientId], category: 'priorAuth', editable: false })),
    ...documents.map(d => ({ id: d.id, source: 'document' as const, title: `Expiring: ${d.title}`, date: d.expiresAt!, patientId: d.patientId, patientName: patientName[d.patientId], category: 'document', editable: false })),
    ...progressNotes.map(n => ({ id: n.id, source: 'progressNote' as const, title: 'Progress Note', date: n.serviceDate, patientId: n.patientId, patientName: patientName[n.patientId], category: 'progressNote', editable: false })),
  ]

  return items.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// A guardian's full personal calendar: global broadcasts targeted at the
// 'guardian' role + patient-scoped items (shifts, appointments, meds/PA/
// document reminders) across every patient they're linked to. Mirrors
// getNurseCalendarFeed's shape — GlobalEvent isn't patient-scoped, so it's
// fetched here directly rather than folded into getPatientCalendarFeed
// (which every role's per-patient view also uses and shouldn't carry
// role-specific broadcast filtering).
export async function getFamilyCalendarFeed(userId: string, session: { id: string; role: string }, range?: DateRange): Promise<CalendarItem[]> {
  const now = new Date()

  const links = await prisma.guardianPatient.findMany({
    where: { userId },
    select: { patientId: true, patient: { select: { firstName: true, lastName: true } } },
  })
  const patientIds = links.map(l => l.patientId)

  const [globalEvents, perPatient] = await Promise.all([
    prisma.globalEvent.findMany({ where: { eventDate: dateFilter(range, now) }, orderBy: { eventDate: 'asc' } })
      .then(rows => rows.filter(e => e.targetRoles.length === 0 || e.targetRoles.includes(session.role))),
    Promise.all(patientIds.map(id => getPatientCalendarFeed(id, range))),
  ])

  const items: CalendarItem[] = [
    ...globalEvents.map(e => ({ id: e.id, source: 'globalEvent' as const, title: e.title, date: e.eventDate, category: e.category, description: e.description ?? undefined, editable: false })),
    ...perPatient.flat(),
  ]

  return items.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// One patient's feed — everything patient-scoped (shifts, appointments, and
// that patient's own medication/PA/document reminders). Excludes GlobalEvent/
// NurseReminder/ClaimReminder since none of those are patient-scoped concepts.
// Reused by the admin Schedule tab, the per-patient /patient/[id]/calendar
// page, and (fanned out per linked patient) getFamilyCalendarFeed above.
export async function getPatientCalendarFeed(patientId: string, range?: DateRange): Promise<CalendarItem[]> {
  const now = new Date()
  const startTimeFilter = dateFilter(range, null)
  const dueFilter = dateFilter(range, now)

  const [shifts, appointments, meds, pas, documents] = await Promise.all([
    prisma.shift.findMany({
      where: { patientId, status: { not: 'cancelled' }, ...(startTimeFilter ? { startTime: startTimeFilter } : {}) },
      orderBy: { startTime: 'asc' },
      include: { nurse: { select: { displayName: true } }, _count: { select: { progressNotes: true } } },
    }),
    prisma.appointment.findMany({ where: { patientId, status: { not: 'cancelled' }, ...(startTimeFilter ? { startTime: startTimeFilter } : {}) }, orderBy: { startTime: 'asc' } }),
    prisma.patientMedication.findMany({ where: { patientId, active: true }, select: { id: true, patientId: true, medicationName: true, lastFillDate: true, daySupply: true, refillsRemaining: true, refillOrderedAt: true } }),
    prisma.patientPA.findMany({ where: { patientId, paEndDate: { not: null } } }),
    prisma.patientDocument.findMany({ where: { patientId, expiresAt: { not: null, ...dueFilter } } }),
  ])

  const items: CalendarItem[] = [
    ...shifts.map(s => ({ id: s.id, source: 'shift' as const, title: s.status === 'assigned' ? 'Shift' : s.status === 'coverage_needed' ? 'Coverage Needed' : 'Open Shift', date: s.startTime, endDate: s.endTime, patientId, category: 'shift', status: s.status, editable: true, nurseName: s.nurse?.displayName, hasProgressNotes: s._count.progressNotes > 0 })),
    ...appointments.map(a => ({ id: a.id, source: 'appointment' as const, title: a.title, date: a.startTime, endDate: a.endTime ?? undefined, patientId, category: 'appointment', status: a.status, editable: true, allDay: a.allDay })),
    ...meds.map(m => ({ id: m.id, source: 'medication' as const, title: `Refill: ${m.medicationName}`, date: medicationDueDate(m.lastFillDate, m.daySupply), patientId, category: 'medication', status: effectiveRefillStatus(m.refillOrderedAt, m.lastFillDate, m.daySupply, m.refillsRemaining), editable: false })),
    ...pas.map(p => ({ id: p.id, source: 'priorAuth' as const, title: `PA Expiring: ${p.paNumber}`, date: new Date(p.paEndDate!), patientId, category: 'priorAuth', editable: false })),
    ...documents.map(d => ({ id: d.id, source: 'document' as const, title: `Expiring: ${d.title}`, date: d.expiresAt!, patientId, category: 'document', editable: false })),
  ]

  return items.sort((a, b) => a.date.getTime() - b.date.getTime())
}
