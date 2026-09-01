import { prisma } from './prisma'

export type TimeRange = { start: Date; end: Date }

// General interval subtraction: what's left of `range` after removing every
// overlapping piece of `coveredRanges` — handles any number of (possibly
// non-contiguous, possibly overlapping each other) covering ranges, not just
// one. Sort-merge-walk: clip covered ranges to `range`, merge the ones that
// touch/overlap, then the gaps between merged pieces (plus before the first
// and after the last) are what remains.
export function subtractCoveredRanges(range: TimeRange, coveredRanges: TimeRange[]): TimeRange[] {
  const clipped = coveredRanges
    .map(c => ({
      start: c.start > range.start ? c.start : range.start,
      end: c.end < range.end ? c.end : range.end,
    }))
    .filter(c => c.start < c.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const merged: TimeRange[] = []
  for (const c of clipped) {
    const last = merged[merged.length - 1]
    if (last && c.start <= last.end) {
      if (c.end > last.end) last.end = c.end
    } else {
      merged.push({ ...c })
    }
  }

  const result: TimeRange[] = []
  let cursor = range.start
  for (const c of merged) {
    if (c.start > cursor) result.push({ start: cursor, end: c.start })
    if (c.end > cursor) cursor = c.end
  }
  if (cursor < range.end) result.push({ start: cursor, end: range.end })
  return result
}

type ShiftRow = {
  id: string
  patientId: string
  nurseId: string | null
  startTime: Date
  endTime: Date
  templateId: string | null
  notes: string | null
  createdByUserId: string
  createdByRole: string
}

// Replaces `original`'s own range with `pieces[0]` (or cancels it outright
// if there are no pieces left), and creates a new open Shift row for each
// additional piece — same lineage-preserving pattern lib/shiftSplit.ts's
// finalizeShiftClaim already established (clone templateId/notes/createdBy).
// Open shifts never carry PendingHours, so no PendingHours hook is needed
// here even when cancelling one outright.
async function applyPieces(original: ShiftRow, pieces: TimeRange[]): Promise<void> {
  if (pieces.length === 0) {
    await (prisma.shift.update as any)({ where: { id: original.id }, data: { status: 'cancelled' } })
    return
  }
  await (prisma.shift.update as any)({
    where: { id: original.id },
    data: { startTime: pieces[0].start, endTime: pieces[0].end },
  })
  for (const piece of pieces.slice(1)) {
    await (prisma.shift.create as any)({
      data: {
        id: crypto.randomUUID(),
        patientId: original.patientId,
        nurseId: null,
        startTime: piece.start,
        endTime: piece.end,
        status: 'open',
        notes: original.notes,
        createdByUserId: original.createdByUserId,
        createdByRole: original.createdByRole,
        templateId: original.templateId,
      },
    })
  }
}

// Bidirectional reconciliation — call right after any Shift row is created,
// or transitions to/from assigned (reassignment, claim, release). Makes
// materialization order-independent: whichever of an open/assigned pair for
// the same patient/overlapping-range shows up second, this carves the
// overlap out of the open side, regardless of which one that is.
export async function reconcileNewShift(shift: ShiftRow): Promise<void> {
  if (shift.nurseId) {
    // New shift is assigned — shrink/split/cancel whatever open shifts on
    // this patient it overlaps.
    const overlapping = await prisma.shift.findMany({
      where: {
        patientId: shift.patientId,
        id: { not: shift.id },
        status: { in: ['open', 'coverage_needed'] },
        startTime: { lt: shift.endTime },
        endTime: { gt: shift.startTime },
      },
    })
    for (const open of overlapping) {
      const pieces = subtractCoveredRanges(
        { start: open.startTime, end: open.endTime },
        [{ start: shift.startTime, end: shift.endTime }]
      )
      await applyPieces(open as any, pieces)
    }
  } else {
    // New shift is open (freshly materialized, or just released back to
    // open) — trim it against whatever's already assigned on this patient.
    // Several separate assigned shifts can each poke their own hole into
    // one open window, so this collects all of them at once.
    const covering = await prisma.shift.findMany({
      where: {
        patientId: shift.patientId,
        id: { not: shift.id },
        nurseId: { not: null },
        status: { in: ['assigned', 'completed'] },
        startTime: { lt: shift.endTime },
        endTime: { gt: shift.startTime },
      },
    })
    if (covering.length === 0) return
    const pieces = subtractCoveredRanges(
      { start: shift.startTime, end: shift.endTime },
      covering.map(c => ({ start: c.startTime, end: c.endTime }))
    )
    await applyPieces(shift, pieces)
  }
}
