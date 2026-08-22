// Best-effort parsing of a free-text clock time string (Vitals/Intake-Output
// "Time" fields have always been plain text — nurses can type anything) into
// minutes since midnight, so Micro-Charting's extracted rows can merge into
// an existing table in roughly chronological order. This can't be
// exhaustive; callers should treat a null result as "position unknown,"
// never guess.
export function parseClockTimeToMinutes(raw: string | null | undefined): number | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()

  // 24-hour military, e.g. "1730", "17:30"
  let m = s.match(/^(\d{1,2}):?(\d{2})$/)
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

/** Merges newly-extracted rows into an existing table's rows, sorted
 * chronologically where the time can be confidently parsed. Rows whose time
 * can't be parsed (from either list) are kept, just pushed to the end in
 * their original relative order rather than guessed at. */
export function mergeRowsByTime<T extends { time: string | null }>(existing: T[], toAdd: T[]): T[] {
  const tagged = [...existing, ...toAdd].map((row, i) => ({ row, i, mins: parseClockTimeToMinutes(row.time) }))
  tagged.sort((a, b) => {
    if (a.mins == null && b.mins == null) return a.i - b.i
    if (a.mins == null) return 1
    if (b.mins == null) return -1
    return a.mins - b.mins
  })
  return tagged.map(t => t.row)
}
