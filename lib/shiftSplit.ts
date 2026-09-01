import { prisma } from './prisma'
import { generatePendingHoursForShift } from './pendingHours'

export type ShiftRange = { startTime: Date; endTime: Date }

export type ShiftSplitResult =
  | { error: string }
  | { leftoverBefore: { start: Date; end: Date } | null; leftoverAfter: { start: Date; end: Date } | null }

// Validates a claimed sub-range against the original open shift's bounds and
// figures out how many leftover "open" shifts (0, 1, or 2) the split leaves
// behind — none when the claimed range is flush with an original edge, since
// there's no gap left to represent.
export function computeShiftSplit(original: ShiftRange, claimedStart: Date, claimedEnd: Date): ShiftSplitResult {
  if (!(claimedStart < claimedEnd)) return { error: 'End time must be after start time.' }
  if (claimedStart < original.startTime || claimedEnd > original.endTime) {
    return { error: 'The selected hours must fall within the original shift.' }
  }
  return {
    leftoverBefore: claimedStart > original.startTime ? { start: original.startTime, end: claimedStart } : null,
    leftoverAfter: claimedEnd < original.endTime ? { start: claimedEnd, end: original.endTime } : null,
  }
}

type FinalizeResult =
  | { error: string }
  | { claimed: any; leftovers: any[] }

// Atomic, race-safe finalize shared by the immediate claim-portion path and
// (on approval) the approval path. Mutates the original Shift row in place
// into the claimed sub-range — safe because an open/unclaimed shift has no
// PendingHour/ProgressNote history yet to disturb — and creates new 'open'
// Shift rows for whatever's left uncovered, preserving templateId so
// leftovers stay part of the recurring series (same lineage the
// occurrence-scoped edit/delete routes already rely on).
export async function finalizeShiftClaim(
  shiftId: string,
  claimedStart: Date,
  claimedEnd: Date,
  nurseId: string
): Promise<FinalizeResult> {
  const original = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!original) return { error: 'Shift not found.' }

  const split = computeShiftSplit(original, claimedStart, claimedEnd)
  if ('error' in split) return split

  const guard = await prisma.shift.updateMany({
    where: { id: shiftId, status: { in: ['open', 'coverage_needed'] }, nurseId: null },
    data: { startTime: claimedStart, endTime: claimedEnd, nurseId, status: 'assigned' },
  })
  if (guard.count === 0) return { error: 'This shift is no longer available.' }

  const claimed = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!claimed) return { error: 'Shift not found.' }

  const leftovers: any[] = []
  for (const range of [split.leftoverBefore, split.leftoverAfter]) {
    if (!range) continue
    const leftover = await prisma.shift.create({
      data: {
        id: crypto.randomUUID(),
        patientId: original.patientId,
        nurseId: null,
        startTime: range.start,
        endTime: range.end,
        status: 'open',
        notes: original.notes,
        createdByUserId: original.createdByUserId,
        createdByRole: original.createdByRole,
        templateId: original.templateId,
      },
    })
    leftovers.push(leftover)
  }

  await generatePendingHoursForShift(claimed, nurseId)

  return { claimed, leftovers }
}
