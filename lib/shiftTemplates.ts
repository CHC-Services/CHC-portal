import { prisma } from './prisma'
import { easternMidnightUtc, nextNyDateKey, previousNyDateKey, easternTimeOfDayUtc, nyDateKeyOf, dateKeyToUtcMidnight } from './easternTime'
import { reassignShiftPendingHours, releaseShiftPendingHours, regenerateScheduledPendingHours, cancelShiftPendingHours } from './pendingHours'

// Rolling window a template stays materialized into real Shift rows —
// "roughly a month visible/claimable ahead," refreshed daily by the
// materialize-shift-templates cron so day 31 doesn't fall off a cliff.
export const MATERIALIZATION_HORIZON_DAYS = 30

// Date-only fields (activeFrom/activeUntil, and this loop's own day cursor)
// use this codebase's established "UTC-midnight represents the calendar day"
// convention (see lib/easternTime.ts's dateKeyToUtcMidnight) — explicit UTC
// math here, not server-local Date methods, so day-walking is correct
// regardless of the server process's own timezone.
function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}
function addDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n))
}
function dayKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function materializationHorizon(): Date {
  return addDays(startOfDay(new Date()), MATERIALIZATION_HORIZON_DAYS)
}

// When a template's end date is left blank, it defaults to 4 months out
// rather than recurring indefinitely (the daily cron's rolling materialization
// horizon would otherwise keep pushing activeUntil-less templates forward
// forever). UTC calendar-month math, consistent with the date-only convention
// activeFrom/activeUntil already use.
export function defaultActiveUntil(activeFrom: Date): Date {
  return new Date(Date.UTC(activeFrom.getUTCFullYear(), activeFrom.getUTCMonth() + 4, activeFrom.getUTCDate()))
}

export type MaterializableTemplate = {
  id: string
  patientId: string
  nurseId: string | null
  startTimeOfDay: string
  durationHours: number
  recurrence: string
  daysOfWeek: number[]
  activeFrom: Date
  activeUntil: Date | null
  notes: string | null
  createdByUserId: string
  createdByRole: string
}

// Expands one ShiftTemplate into real Shift rows out to `horizonEnd`,
// idempotently — skips any date that already has a generated Shift for this
// template, so it's safe to call repeatedly (inline on create/edit, and
// daily from the cron). Never touches shifts outside its own templateId, and
// never deletes/cancels anything — shrinking a template's date range doesn't
// retroactively cancel already-generated future shifts (that's a deliberate
// choice: only explicit template deletion does that, see the DELETE route).
export async function materializeShiftTemplate(template: MaterializableTemplate, horizonEnd: Date): Promise<number> {
  const today = startOfDay(new Date())
  const rangeStart = template.activeFrom > today ? startOfDay(template.activeFrom) : today
  const cappedEnd = template.activeUntil && template.activeUntil < horizonEnd ? template.activeUntil : horizonEnd
  const rangeEnd = startOfDay(cappedEnd)
  if (rangeStart > rangeEnd) return 0

  const [hh, mm] = template.startTimeOfDay.split(':').map(Number)

  let created = 0
  for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) {
    const matches = template.recurrence === 'daily'
      || (template.recurrence === 'weekly' && template.daysOfWeek.includes(d.getUTCDay()))
    if (!matches) continue

    const dayKey = dayKeyOf(d)
    // Eastern wall-clock time, not the server process's own timezone (UTC in
    // prod on Vercel) — see CLAUDE.md's "Time/date-of-day logic" convention.
    const startTime = easternTimeOfDayUtc(dayKey, hh, mm)
    const endTime = new Date(startTime.getTime() + template.durationHours * 60 * 60 * 1000)

    // Same-Eastern-calendar-day match, not exact-instant — a materialized
    // shift whose time was individually edited (see the occurrence-scoped
    // edit routes) still counts as "already covering this day," so the next
    // materialization pass doesn't create a duplicate at the original slot.
    const dayStartUtc = easternMidnightUtc(dayKey)
    const dayEndUtc = easternMidnightUtc(nextNyDateKey(dayKey))
    const existing = await (prisma.shift.findFirst as any)({
      where: { templateId: template.id, startTime: { gte: dayStartUtc, lt: dayEndUtc } },
    })
    if (existing) continue

    await (prisma.shift.create as any)({
      data: {
        id: crypto.randomUUID(),
        patientId: template.patientId,
        nurseId: template.nurseId,
        templateId: template.id,
        startTime,
        endTime,
        status: template.nurseId ? 'assigned' : 'open',
        notes: template.notes,
        createdByUserId: template.createdByUserId,
        createdByRole: template.createdByRole,
      },
    })
    created++
  }
  return created
}

// Core "update one Shift row + keep Pending Hours in sync" logic, shared by
// the plain single-shift PATCH route and the occurrence-scoped ?scope=this
// edit — both apply the exact same update once the caller has already
// authorized it, so the pending-hours reassignment/regeneration hooks (spec
// §10-13) aren't duplicated between them.
export async function updateShiftAndSyncPendingHours(
  shiftId: string,
  existing: { nurseId: string | null },
  data: Record<string, any>,
  session: { id: string }
): Promise<any> {
  const shift = await (prisma.shift.update as any)({ where: { id: shiftId }, data }).catch(() => null)
  if (!shift) return null

  const isReassignment = 'nurseId' in data
  if (isReassignment) {
    if (shift.nurseId) {
      await reassignShiftPendingHours(shift, shift.nurseId, session.id)
    } else if (existing.nurseId) {
      await releaseShiftPendingHours(shiftId, existing.nurseId)
    }
  } else if ('startTime' in data || 'endTime' in data) {
    await regenerateScheduledPendingHours(shift)
  }
  return shift
}

// Core "cancel one Shift row + preserve its Pending Hours history" logic,
// shared the same way as updateShiftAndSyncPendingHours above.
export async function cancelSingleShift(shiftId: string): Promise<any> {
  const shift = await (prisma.shift.update as any)({ where: { id: shiftId }, data: { status: 'cancelled' } }).catch(() => null)
  if (shift) await cancelShiftPendingHours(shiftId)
  return shift
}

// Caps a template's activeUntil to the Eastern calendar day before the given
// occurrence, so the daily cron never regenerates that date or anything
// after it — the first step of both "this and future" delete and edit.
export async function capTemplateBeforeOccurrence(templateId: string, occurrenceStartTime: Date): Promise<void> {
  const capKey = previousNyDateKey(nyDateKeyOf(occurrenceStartTime))
  await ((prisma as any).shiftTemplate.update)({ where: { id: templateId }, data: { activeUntil: dateKeyToUtcMidnight(capKey) } })
}

// Cancels every not-yet-worked shift a template generated from `fromInstant`
// onward (inclusive) — used by "this and future" delete/edit so already
// materialized future occurrences under the old template don't linger
// alongside whatever replaces them.
export async function cancelFutureGeneratedShifts(templateId: string, fromInstant: Date): Promise<void> {
  const shifts = await (prisma.shift.findMany as any)({
    where: { templateId, startTime: { gte: fromInstant }, status: { in: ['open', 'coverage_needed', 'assigned'] } },
    select: { id: true },
  })
  for (const s of shifts) await cancelSingleShift(s.id)
}
