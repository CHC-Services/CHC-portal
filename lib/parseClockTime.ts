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

/** "60 mL" → { qty: 60, unit: "mL", unitKey: "ml" }. Returns null for
 * anything that doesn't start with a number — never guesses at a quantity
 * that isn't there. `unitKey` (lowercased) is for comparing two units
 * case-insensitively; `unit` keeps its original casing for display. */
function parseAmount(raw: string | null): { qty: number; unit: string; unitKey: string } | null {
  if (!raw) return null
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
  if (!m) return null
  const qty = parseFloat(m[1])
  if (isNaN(qty)) return null
  const unit = m[2].trim()
  return { qty, unit, unitKey: unit.toLowerCase() }
}

function formatAmount(qty: number, unit: string): string {
  const q = Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 100) / 100)
  return unit ? `${q} ${unit}` : q
}

/** Collapses Intake/Output rows that share the same charted time, intake
 * type, and route into one row with the intake amounts added together —
 * e.g. three separate "water, G-Tube" entries all charted at 23:50 become
 * one 23:50 row with the total volume, instead of three near-identical
 * lines. Only sums when the units match (both "mL", say) — different or
 * unparseable units are left as separate rows rather than guessed at. Any
 * output fields (urine/BM/emesis) on a row that gets folded into an earlier
 * one are carried forward if the kept row doesn't already have them, so
 * nothing on the discarded row is silently lost. Rows with no time or no
 * intake type pass through untouched — this only ever merges genuine
 * same-timeframe repeats of the same input. */
export function collapseSameTimeIntake<T extends {
  time: string | null
  intakeType: string | null
  intakeAmt: string | null
  intakeRoute: string | null
  outputUrine?: string | null
  outputBM?: string | null
  outputEmesis?: string | null
}>(rows: T[]): T[] {
  const result: T[] = []
  const groupIndex = new Map<string, number>()

  for (const row of rows) {
    const type = row.intakeType?.trim().toLowerCase()
    const route = row.intakeRoute?.trim().toLowerCase() || ''
    if (!row.time || !type) { result.push(row); continue }

    const key = `${row.time}|${type}|${route}`
    const existingIdx = groupIndex.get(key)
    if (existingIdx === undefined) {
      groupIndex.set(key, result.length)
      result.push(row)
      continue
    }

    const existing = result[existingIdx]
    const a = parseAmount(existing.intakeAmt)
    const b = parseAmount(row.intakeAmt)
    if (a && b && a.unitKey === b.unitKey) {
      result[existingIdx] = {
        ...existing,
        intakeAmt: formatAmount(a.qty + b.qty, a.unit),
        outputUrine: existing.outputUrine || row.outputUrine,
        outputBM: existing.outputBM || row.outputBM,
        outputEmesis: existing.outputEmesis || row.outputEmesis,
      }
    } else {
      // Units don't match (or one side can't be parsed) — don't guess at a
      // combined total, keep both rows as-is.
      result.push(row)
    }
  }
  return result
}
