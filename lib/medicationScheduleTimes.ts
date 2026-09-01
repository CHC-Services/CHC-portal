import { prisma } from './prisma'

// Shared by the three role-scoped medication CRUD routes (nurse/family/admin)
// so the "replace all scheduled times on save" logic isn't tripled.

/** Nested-create shape for PatientMedication.create's `data.scheduleTimes`. */
export function scheduleTimesCreateData(scheduleTimes: string[] | undefined) {
  const valid = (scheduleTimes || []).filter(Boolean)
  if (valid.length === 0) return undefined
  return { create: valid.map((timeOfDay, sortOrder) => ({ timeOfDay, sortOrder })) }
}

/** Delete-and-recreate — same pattern ProgressNote's vitals/IO PATCH uses to
 * sync a client-edited, ordered list back to rows with a sortOrder. */
export async function replaceScheduleTimes(medicationId: string, scheduleTimes: string[]): Promise<void> {
  await (prisma.medicationScheduleTime.deleteMany as any)({ where: { medicationId } })
  const valid = scheduleTimes.filter(Boolean)
  if (valid.length > 0) {
    await (prisma.medicationScheduleTime.createMany as any)({
      data: valid.map((timeOfDay, sortOrder) => ({ medicationId, timeOfDay, sortOrder })),
    })
  }
}
