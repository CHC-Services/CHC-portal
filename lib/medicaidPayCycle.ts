// Pay cycle anchor: cycle 2540 = 2026-05-14 (deposit date)
// Close date for cycle 2540 = 2026-04-23 (Thursday, 21 days before deposit)
// Each cycle is one week (7 days); cycle closes Thursday at 00:00 UTC
const ANCHOR_CYCLE = 2540
const ANCHOR_DEPOSIT_DATE  = '2026-05-14'
const ANCHOR_CLOSE_MS = Date.UTC(2026, 3, 23) // April 23, 2026

export function payCycleToDate(
  cycle: number,
  anchorCycle = ANCHOR_CYCLE,
  anchorDateStr = ANCHOR_DEPOSIT_DATE,
): Date {
  const anchor = new Date(anchorDateStr + 'T00:00:00Z')
  const offsetDays = (cycle - anchorCycle) * 7
  const result = new Date(anchor)
  result.setUTCDate(anchor.getUTCDate() + offsetDays)
  return result
}

export function payCycleDateLabel(
  cycle: number,
  anchorCycle?: number,
  anchorDateStr?: string,
): string {
  const d = payCycleToDate(cycle, anchorCycle, anchorDateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Given a Medicaid processed date (YYYY-MM-DD string), returns the pay cycle
 * number and deposit date string.
 *
 * Logic:
 *   - Medicaid pay cycle week runs Thursday through Wednesday
 *   - Cycle closes the following Thursday at 00:00 UTC
 *   - Deposit posts 21 days (3 weeks) after the close date, also on a Thursday
 */
export function calcMedicaidCycleInfo(procDateStr: string): { cycle: number; depositDateStr: string } | null {
  const d = new Date(procDateStr + 'T00:00:00Z')
  if (isNaN(d.getTime())) return null

  const day = d.getUTCDay() // 0=Sun … 4=Thu … 6=Sat
  // Days until the next Thursday that closes this cycle.
  // If proc date is Thursday (day=4), it opens the NEXT cycle — close is 7 days out.
  const daysToClose = ((4 - day) + 7) % 7 || 7

  const closeMs   = d.getTime() + daysToClose * 86_400_000
  const depositMs = closeMs + 21 * 86_400_000

  const cycle = ANCHOR_CYCLE + Math.round((closeMs - ANCHOR_CLOSE_MS) / (7 * 86_400_000))
  const depositDateStr = new Date(depositMs).toISOString().slice(0, 10)

  return { cycle, depositDateStr }
}
