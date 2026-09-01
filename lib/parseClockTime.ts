// Best-effort parsing of a free-text clock time string (Vitals/Intake-Output
// "Time" fields have always been plain text — nurses can type anything) into
// minutes since midnight, so Micro-Charting's extracted rows can merge into
// an existing table in roughly chronological order. This can't be
// exhaustive; callers should treat a null result as "position unknown,"
// never guess.
export function parseClockTimeToMinutes(raw: string | null | undefined): number | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()

  // 24-hour military, e.g. "1730", "17:30", "17 30"
  let m = s.match(/^(\d{1,2})[:\s]?(\d{2})$/)
  if (m) {
    const h = parseInt(m[1], 10)
    const min = parseInt(m[2], 10)
    if (h <= 23 && min <= 59) return h * 60 + min
  }

  // 12-hour, e.g. "5:30 pm", "5:30pm", "5:30p", "5pm"
  m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?$/)
  if (m) {
    let h = parseInt(m[1], 10)
    const min = m[2] ? parseInt(m[2], 10) : 0
    const isPM = m[3] === 'p'
    if (h === 12) h = 0
    if (isPM) h += 12
    if (h <= 23 && min <= 59) return h * 60 + min
  }

  return null
}

/** Total Hours, computed from free-text Shift Start/End using the same
 * flexible parsing as above (12-hour, 24-hour/military, with or without a
 * colon/space separator — "8:00a", "0800", "8A", "08 00", "8AM" all parse).
 * Returns null if either time can't be read, so the field can show a "—"
 * rather than a wrong number. A shift crossing midnight (end time
 * numerically earlier than start) is treated as ending the next day. */
export function computeShiftHours(startRaw: string | null | undefined, endRaw: string | null | undefined): number | null {
  const startMin = parseClockTimeToMinutes(startRaw)
  const endMinRaw = parseClockTimeToMinutes(endRaw)
  if (startMin == null || endMinRaw == null) return null
  const endMin = endMinRaw <= startMin ? endMinRaw + 24 * 60 : endMinRaw
  return Math.round(((endMin - startMin) / 60) * 100) / 100
}

/** Merges newly-extracted rows into an existing table's rows, sorted
 * chronologically where the time can be confidently parsed. Rows whose time
 * can't be parsed (from either list) are kept, just pushed to the end in
 * their original relative order rather than guessed at.
 *
 * `shiftStartRaw`, when parseable, anchors the sort to elapsed-time-since-
 * shift-start rather than raw time-of-day — same wrap rule as
 * computeShiftHours above — so an overnight shift's 00:00–06:00 entries sort
 * *after* its 19:00–23:59 entries instead of before them. Without a
 * parseable shift start, falls back to plain time-of-day order (today's
 * prior behavior), which is only wrong for shifts that actually cross
 * midnight. */
export function mergeRowsByTime<T extends { time: string | null }>(
  existing: T[],
  toAdd: T[],
  shiftStartRaw?: string | null
): T[] {
  const shiftStartMin = parseClockTimeToMinutes(shiftStartRaw)
  const tagged = [...existing, ...toAdd].map((row, i) => {
    const mins = parseClockTimeToMinutes(row.time)
    const ordered = mins != null && shiftStartMin != null && mins < shiftStartMin ? mins + 24 * 60 : mins
    return { row, i, mins: ordered }
  })
  tagged.sort((a, b) => {
    if (a.mins == null && b.mins == null) return a.i - b.i
    if (a.mins == null) return 1
    if (b.mins == null) return -1
    return a.mins - b.mins
  })
  return tagged.map(t => t.row)
}
