// Shared refill-reminder date math — used by both the cron job and the UI's
// "due date" display so they can never drift apart.

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

// A refill already authorized on the script means restocking is just a pickup,
// so less advance notice is needed than when a new script has to be requested.
export function leadDays(refillsRemaining: number | null | undefined): number {
  return refillsRemaining != null && refillsRemaining > 0 ? 4 : 6
}

export function medicationDueDate(lastFillDate: Date, daySupply: number): Date {
  return addDays(lastFillDate, daySupply)
}

export function medicationReminderDate(
  lastFillDate: Date,
  daySupply: number,
  refillsRemaining: number | null | undefined
): Date {
  return addDays(lastFillDate, daySupply - leadDays(refillsRemaining))
}

export function isReminderDue(
  lastFillDate: Date,
  daySupply: number,
  refillsRemaining: number | null | undefined,
  today: Date = new Date()
): boolean {
  return medicationReminderDate(lastFillDate, daySupply, refillsRemaining).getTime() <= today.getTime()
}

export type RefillStatus = 'due' | 'overdue' | 'ordered' | 'filled'

// Due/Overdue/Filled are always derived from the same date math the reminder
// cron uses, never stored, so the on-screen badge can't drift from it. Only
// "ordered" is a persisted fact (refillOrderedAt) — it wins outright and stays
// sticky through the due date, so an order in flight (waiting on the pharmacy)
// doesn't flip back to due/overdue.
//
// An OTC medication always reports "filled" regardless of the date math —
// it's never tracked for refills, so nothing should ever read as due/overdue
// for it (matches the reminder cron in lib/runMedicationReminders.ts, which
// excludes isOtc medications from consideration entirely).
export function effectiveRefillStatus(
  refillOrderedAt: Date | null | undefined,
  lastFillDate: Date,
  daySupply: number,
  refillsRemaining: number | null | undefined,
  today: Date = new Date(),
  isOtc?: boolean | null
): RefillStatus {
  if (isOtc) return 'filled'
  if (refillOrderedAt) return 'ordered'
  if (today.getTime() >= medicationDueDate(lastFillDate, daySupply).getTime()) return 'overdue'
  if (isReminderDue(lastFillDate, daySupply, refillsRemaining, today)) return 'due'
  return 'filled'
}
