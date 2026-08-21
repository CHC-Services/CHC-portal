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

// Displays a date-only value (a Progress Note's service date, stored as
// UTC-midnight of the intended calendar day) as "Aug 21, 2026". Deliberately
// reads UTC components (timeZone: 'UTC') rather than the viewer's local
// timezone — for anyone in a US timezone, converting UTC-midnight to local
// time rolls it back to the *previous* calendar day, showing a date one day
// earlier than what's actually stored. Since this is a calendar day, not an
// instant, formatting must read it back the same way it was written.
export function formatServiceDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
