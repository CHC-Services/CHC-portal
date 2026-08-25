export type CalendarViewMode = 'day' | 'week' | 'month' | 'lookahead' | 'custom'

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}
function endOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// The actual data-fetch window for a given view/anchor — NOT necessarily the
// same as what the grid renders (month view pads with adjacent-month days to
// fill a full grid; see monthGridDays below).
export function computeViewRange(view: CalendarViewMode, anchorDate: Date, custom?: { start: Date; end: Date }): { start: Date; end: Date } {
  if (view === 'custom' && custom) return { start: startOfDay(custom.start), end: endOfDay(custom.end) }
  if (view === 'day') return { start: startOfDay(anchorDate), end: endOfDay(anchorDate) }
  if (view === 'week') {
    const start = startOfDay(addDays(anchorDate, -anchorDate.getDay()))
    return { start, end: endOfDay(addDays(start, 6)) }
  }
  if (view === 'lookahead') return { start: startOfDay(anchorDate), end: endOfDay(addDays(anchorDate, 13)) }
  // month
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
  const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0)
  return { start: startOfDay(monthStart), end: endOfDay(monthEnd) }
}

// Full set of day-cells a month grid needs to render (padded to whole weeks,
// Sunday-start) — always a multiple of 7, typically 35 or 42 days.
export function monthGridDays(anchorDate: Date): Date[] {
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
  const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0)
  const gridStart = addDays(monthStart, -monthStart.getDay())
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay())
  const days: Date[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d)
  return days
}

// Plain list of every day between start/end inclusive — used by the
// day-section agenda layout (day/week/lookahead/custom views).
export function daysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = []
  let d = startOfDay(start)
  const last = startOfDay(end)
  while (d <= last) { days.push(d); d = addDays(d, 1) }
  return days
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function shiftAnchor(view: CalendarViewMode, anchorDate: Date, direction: 1 | -1): Date {
  if (view === 'day') return addDays(anchorDate, direction)
  if (view === 'week') return addDays(anchorDate, direction * 7)
  if (view === 'lookahead') return addDays(anchorDate, direction * 14)
  if (view === 'month') return new Date(anchorDate.getFullYear(), anchorDate.getMonth() + direction, 1)
  return anchorDate // custom — navigated via explicit date pickers, not prev/next
}
