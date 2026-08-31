// Scheduling → Pending Hours shared logic — the midnight-split, the
// derived (never-stored) 'awaiting_confirmation' status, the hard
// confirm-eligibility rule, and the row-generation helper every Shift
// create/reassign/edit hook calls through. Kept here so the API routes that
// touch PendingHour never duplicate this math (mirrors how
// lib/campaignDiscount.ts and lib/medicationReminders.ts centralize their
// own date logic) — this one also owns the Prisma write since the DB
// side-effect (not just date math) is the actual point of this feature.

import { prisma } from './prisma'

const NY_TZ = 'America/New_York'

// This agency operates out of Buffalo, NY — overnight shifts split at
// Eastern midnight, not UTC midnight (UTC would misplace the boundary by
// 4-5 hours and attribute hours to the wrong date of service). DST-safe:
// tries both possible ET offsets and keeps whichever is self-consistent,
// rather than assuming a fixed offset.
function nyOffsetMinutesAt(instant: Date): number {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: NY_TZ, timeZoneName: 'shortOffset' })
    .formatToParts(instant)
    .find(p => p.type === 'timeZoneName')!.value // e.g. "GMT-4" or "GMT-5"
  const match = part.match(/GMT([+-]\d+)/)
  return match ? parseInt(match[1], 10) * 60 : -300
}

function nyDateKey(instant: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: NY_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(instant)
      .map(p => [p.type, p.value])
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** The UTC instant of Eastern midnight (00:00 ET) starting the given YYYY-MM-DD calendar date. */
function nyMidnightUtc(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  for (const guessOffsetMin of [-300, -240]) { // EST, then EDT
    const candidate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - guessOffsetMin * 60_000)
    if (nyOffsetMinutesAt(candidate) === guessOffsetMin) return candidate
  }
  return new Date(Date.UTC(y, m - 1, d, 5, 0, 0)) // fallback: assume EST
}

function nextDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
}

/** Date-only fields in this codebase are stored as UTC-midnight of the intended calendar day (see lib/localDate.ts). */
function dateKeyToUtcMidnight(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`)
}

function hoursBetween(a: Date, b: Date): number {
  return Math.round(((b.getTime() - a.getTime()) / 3_600_000) * 100) / 100
}

export type DaySegment = {
  dateOfService: Date
  scheduledStart: Date
  scheduledEnd: Date
  scheduledHours: number
}

/**
 * Splits a shift into one segment per Eastern calendar day it spans — a
 * same-day shift is always exactly one segment; an overnight shift is two
 * (or more, for the rare multi-day case), each split at Eastern midnight.
 * Spec example: Sat 7PM → Sun 7AM becomes [Sat 5.0h, Sun 7.0h].
 */
export function splitShiftIntoDaySegments(startTime: Date, endTime: Date): DaySegment[] {
  const startKey = nyDateKey(startTime)
  const endKey = nyDateKey(endTime)

  if (startKey === endKey) {
    return [{
      dateOfService: dateKeyToUtcMidnight(startKey),
      scheduledStart: startTime,
      scheduledEnd: endTime,
      scheduledHours: hoursBetween(startTime, endTime),
    }]
  }

  const segments: DaySegment[] = []
  let segStart = startTime
  let currentKey = startKey
  while (currentKey < endKey) {
    const nextMidnight = nyMidnightUtc(nextDateKey(currentKey))
    segments.push({
      dateOfService: dateKeyToUtcMidnight(currentKey),
      scheduledStart: segStart,
      scheduledEnd: nextMidnight,
      scheduledHours: hoursBetween(segStart, nextMidnight),
    })
    segStart = nextMidnight
    currentKey = nyDateKey(segStart)
  }
  segments.push({
    dateOfService: dateKeyToUtcMidnight(endKey),
    scheduledStart: segStart,
    scheduledEnd: endTime,
    scheduledHours: hoursBetween(segStart, endTime),
  })
  return segments
}

export type PendingHourStatus = 'scheduled' | 'awaiting_confirmation' | 'confirmed' | 'not_worked' | 'reassigned'

/**
 * 'awaiting_confirmation' is never stored — it's derived from the parent
 * shift's endTime so it can never drift out of sync (same computed-not-stored
 * pattern as lib/medicationReminders.ts's effectiveRefillStatus). Per spec §8,
 * eligibility keys off the *shift's* endTime, not this segment's own
 * scheduledEnd — an overnight shift's Saturday segment doesn't become
 * confirmable at Saturday midnight, only once the whole shift ends Sunday 7AM.
 */
export function effectivePendingHourStatus(storedStatus: string, shiftEndTime: Date, now: Date = new Date()): PendingHourStatus {
  if (storedStatus === 'scheduled' && now.getTime() >= shiftEndTime.getTime()) return 'awaiting_confirmation'
  return storedStatus as PendingHourStatus
}

/**
 * The hard rule (spec §7): a nurse can never confirm a shift that hasn't
 * ended yet, and only her own. Callers MUST check this server-side on every
 * confirm/adjust/not-worked request — never rely on a disabled frontend button.
 */
export function canConfirmPendingHour(
  pendingHour: { nurseId: string; status: string },
  shiftEndTime: Date,
  nurseProfileId: string,
  now: Date = new Date()
): boolean {
  if (pendingHour.nurseId !== nurseProfileId) return false
  if (pendingHour.status !== 'scheduled') return false
  return now.getTime() >= shiftEndTime.getTime()
}

type ShiftLike = { id: string; patientId: string; startTime: Date; endTime: Date; nurseId?: string | null }

/**
 * Creates (or no-ops if already present) one PendingHour row per day segment
 * for a shift+nurse pair. Idempotent via the [shiftId, nurseId, dateOfService]
 * DB constraint — safe to call on retries, and `update: {}` deliberately never
 * overwrites an existing row, since it could already be confirmed.
 */
export async function generatePendingHoursForShift(shift: ShiftLike, nurseId: string): Promise<void> {
  const segments = splitShiftIntoDaySegments(shift.startTime, shift.endTime)
  for (const seg of segments) {
    await (prisma.pendingHour.upsert as any)({
      where: { shiftId_nurseId_dateOfService: { shiftId: shift.id, nurseId, dateOfService: seg.dateOfService } },
      update: {},
      create: {
        shiftId: shift.id,
        nurseId,
        patientId: shift.patientId,
        dateOfService: seg.dateOfService,
        scheduledStart: seg.scheduledStart,
        scheduledEnd: seg.scheduledEnd,
        scheduledHours: seg.scheduledHours,
      },
    })
  }
}

/**
 * Shift reassigned to a different nurse (spec §10-12). Only rows still
 * 'scheduled' move — anything already confirmed (has a timeEntryId) is left
 * completely alone, attributed to whoever actually confirmed it, regardless
 * of who the shift is reassigned to afterward. Reassigned rows are stamped
 * for the audit trail (spec §11) rather than deleted.
 */
export async function reassignShiftPendingHours(shift: ShiftLike, newNurseId: string, changedByUserId: string): Promise<void> {
  const stillScheduled = await (prisma.pendingHour.findMany as any)({
    where: { shiftId: shift.id, status: 'scheduled' },
  })
  if (stillScheduled.length === 0) {
    await generatePendingHoursForShift(shift, newNurseId)
    return
  }

  const now = new Date()
  await (prisma.$transaction as any)([
    ...stillScheduled.map((row: any) =>
      (prisma.pendingHour.update as any)({
        where: { id: row.id },
        data: {
          status: 'reassigned',
          reassignedFromNurseId: row.nurseId,
          reassignedAt: now,
          reassignedByUserId: changedByUserId,
        },
      })
    ),
  ])
  await generatePendingHoursForShift(shift, newNurseId)
}

/**
 * Shift's start/end time edited, not reassigned (spec §13). Unconfirmed
 * ('scheduled') rows are regenerated from the new times; confirmed rows are
 * left untouched — an already-worked, already-billed day shouldn't silently
 * change because someone corrected next week's shift time.
 */
export async function regenerateScheduledPendingHours(shift: ShiftLike): Promise<void> {
  await (prisma.pendingHour.deleteMany as any)({ where: { shiftId: shift.id, status: 'scheduled' } })
  if (shift.nurseId) await generatePendingHoursForShift(shift, shift.nurseId)
}

/**
 * A nurse releasing her own assigned shift back to open/coverage_needed (no
 * new nurse yet — that happens separately when someone claims it). Her
 * still-'scheduled' rows are stamped 'reassigned' the same way a reassignment
 * would, since they no longer represent expected work for anyone until the
 * shift is claimed again — whoever claims it next gets fresh rows generated
 * at claim time (see app/api/nurse/shifts/[id]/claim/route.ts).
 */
export async function releaseShiftPendingHours(shiftId: string, releasingNurseId: string): Promise<void> {
  const now = new Date()
  await (prisma.pendingHour.updateMany as any)({
    where: { shiftId, status: 'scheduled', nurseId: releasingNurseId },
    data: { status: 'reassigned', reassignedFromNurseId: releasingNurseId, reassignedAt: now, reassignedByUserId: releasingNurseId },
  })
}

/** Shift cancelled — still-scheduled rows become 'not_worked', preserving the historical record (spec §9) instead of deleting it. */
export async function cancelShiftPendingHours(shiftId: string): Promise<void> {
  await (prisma.pendingHour.updateMany as any)({
    where: { shiftId, status: 'scheduled' },
    data: { status: 'not_worked' },
  })
}
