import { prisma } from './prisma'
import { effectiveRefillStatus } from './medicationReminders'

/**
 * Resolves a typed-in pharmacy name/address/phone to a shared Pharmacy row,
 * creating one if no match exists. Reused by every medication create/edit
 * route so the pharmacy directory grows from real usage instead of each
 * patient carrying its own free-text copy.
 *
 * Matching is case-insensitive on name only. An existing match never has its
 * address/phone overwritten with different data — only empty fields get
 * filled in — so one sloppy entry can't corrupt a record other patients rely on.
 */
export async function resolvePharmacy(input: {
  name: string
  address?: string | null
  phone?: string | null
}): Promise<string | null> {
  const name = input.name?.trim()
  if (!name) return null

  const address = input.address?.trim() || null
  const phone = input.phone?.trim() || null

  const existing = await (prisma.pharmacy.findFirst as any)({
    where: { name: { equals: name, mode: 'insensitive' } },
  })

  if (existing) {
    const fillIn: Record<string, string> = {}
    if (!existing.address && address) fillIn.address = address
    if (!existing.phone && phone) fillIn.phone = phone
    if (Object.keys(fillIn).length > 0) {
      await (prisma.pharmacy.update as any)({ where: { id: existing.id }, data: fillIn })
    }
    return existing.id
  }

  const created = await (prisma.pharmacy.create as any)({
    data: { name, address, phone },
  })
  return created.id
}

/**
 * Flattens a PatientMedication's joined `pharmacy` relation into flat
 * pharmacyName/pharmacyAddress/pharmacyPhone fields and drops the nested
 * object, so every API response keeps the same flat shape MedicationList.tsx
 * expects regardless of the underlying relational structure.
 */
export function flattenMedication(med: any) {
  const { pharmacy, scheduleTimes, ...rest } = med
  return {
    ...rest,
    pharmacyId: pharmacy?.id ?? med.pharmacyId ?? null,
    pharmacyName: pharmacy?.name ?? null,
    pharmacyAddress: pharmacy?.address ?? null,
    pharmacyPhone: pharmacy?.phone ?? null,
    refillStatus: effectiveRefillStatus(med.refillOrderedAt, med.lastFillDate, med.daySupply, med.refillsRemaining, undefined, med.isOtc, med.isPrn),
    scheduleTimes: Array.isArray(scheduleTimes)
      ? [...scheduleTimes].sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((t: any) => t.timeOfDay)
      : [],
  }
}
