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
