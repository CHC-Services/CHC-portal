// Today's calendar date in the *browser's* local timezone, as YYYY-MM-DD —
// not UTC. `new Date().toISOString().slice(0,10)` (a common shortcut) is a
// timezone bug waiting to happen: it reflects UTC's current date, which is
// already "tomorrow" for anyone in the US after ~7-8pm local time. Client
// code that needs "today" for a date-only field (e.g. a new Progress Note's
// service date) should call this instead.
export function todayLocalDateString(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
