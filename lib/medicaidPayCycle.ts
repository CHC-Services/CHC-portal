// Pay cycle anchor: cycle 2540 = 2026-05-14
// Each subsequent cycle is +7 days
const DEFAULT_ANCHOR_CYCLE = 2540
const DEFAULT_ANCHOR_DATE  = '2026-05-14'

export function payCycleToDate(
  cycle: number,
  anchorCycle = DEFAULT_ANCHOR_CYCLE,
  anchorDateStr = DEFAULT_ANCHOR_DATE,
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
