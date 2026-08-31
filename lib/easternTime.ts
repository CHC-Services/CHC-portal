// Shared Eastern-time (America/New_York) date/time-of-day math. This agency
// operates out of Buffalo, NY — any calendar-day boundary or wall-clock
// time-of-day in this app means Eastern time, not the server's own timezone
// (UTC on Vercel) and not a naive fixed-offset assumption (DST shifts the
// offset twice a year). Originally built for the midnight-split logic in
// lib/pendingHours.ts; extracted here so every other time/date-based function
// (e.g. lib/shiftTemplates.ts's startTimeOfDay materialization) uses the same
// DST-safe math instead of re-deriving it. See CLAUDE.md's "Time/date-of-day
// logic" convention.

const NY_TZ = 'America/New_York'

/** DST-safe: tries both possible ET offsets and keeps whichever is self-consistent, rather than assuming a fixed offset. */
export function nyOffsetMinutesAt(instant: Date): number {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: NY_TZ, timeZoneName: 'shortOffset' })
    .formatToParts(instant)
    .find(p => p.type === 'timeZoneName')!.value // e.g. "GMT-4" or "GMT-5"
  const match = part.match(/GMT([+-]\d+)/)
  return match ? parseInt(match[1], 10) * 60 : -300
}

/** The YYYY-MM-DD Eastern calendar date containing the given instant. */
export function nyDateKeyOf(instant: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: NY_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(instant)
      .map(p => [p.type, p.value])
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** The UTC instant of Eastern midnight (00:00 ET) starting the given YYYY-MM-DD calendar date. */
export function easternMidnightUtc(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  for (const guessOffsetMin of [-300, -240]) { // EST, then EDT
    const candidate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - guessOffsetMin * 60_000)
    if (nyOffsetMinutesAt(candidate) === guessOffsetMin) return candidate
  }
  return new Date(Date.UTC(y, m - 1, d, 5, 0, 0)) // fallback: assume EST
}

/** The UTC instant of HH:MM Eastern time on the given YYYY-MM-DD calendar date. DST-safe the same way easternMidnightUtc is. */
export function easternTimeOfDayUtc(dateKey: string, hh: number, mm: number): Date {
  const midnight = easternMidnightUtc(dateKey)
  const candidate = new Date(midnight.getTime() + (hh * 60 + mm) * 60_000)
  // Re-verify: if the shift-change hour itself straddles a DST transition,
  // midnight's offset may not match the offset actually in effect at hh:mm.
  const midnightOffset = nyOffsetMinutesAt(midnight)
  const candidateOffset = nyOffsetMinutesAt(candidate)
  if (candidateOffset === midnightOffset) return candidate
  return new Date(candidate.getTime() + (midnightOffset - candidateOffset) * 60_000)
}

export function nextNyDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
}

export function previousNyDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const prev = new Date(Date.UTC(y, m - 1, d - 1))
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-${String(prev.getUTCDate()).padStart(2, '0')}`
}

/** Date-only fields in this codebase are stored as UTC-midnight of the intended calendar day (see lib/localDate.ts). */
export function dateKeyToUtcMidnight(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`)
}
