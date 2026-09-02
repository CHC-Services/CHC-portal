import { prisma } from './prisma'
import { signedName } from './formatName'

// Shared by the MAR routes to resolve "who" for a MedicationAdministration
// row — both administeredBy (may be a proxy, e.g. a guardian a nurse is
// documenting for) and documentedBy (always the caller). Snapshots the
// resolved display name at write time, same as ProgressNote.authorDisplayNameSnapshot,
// so a later name change or account deletion never rewrites history.

type Session = { id: string; role: string; name?: string; displayName?: string; firstName?: string; lastName?: string }

// Sentinel administeredByUserId meaning "some family member gave it, not
// tied to a specific linked guardian account" — e.g. a relative who isn't a
// registered portal user. Never a real user id, never persisted as-is (the
// route resolving it stores administeredByUserId: null instead, with role
// 'guardian' and this display name) — server-only modules import this
// constant; PatientMedicationMAR.tsx (a client component) can't import from
// here since this file pulls in prisma, so it duplicates the literal string
// with a comment tying it back to this constant. Keep both in sync.
export const FAMILY_GENERIC_ID = 'family'
export const FAMILY_GENERIC_DISPLAY_NAME = 'Family/Caregiver'

/** Display name for the calling session itself — used for documentedBy*. */
export function sessionDisplayName(session: Session): string {
  if (session.role === 'nurse') {
    return signedName({ firstName: session.firstName, lastName: session.lastName, displayName: session.displayName }) || session.name || ''
  }
  return session.name || session.displayName || ''
}

/**
 * Resolves role + display name for an administeredByUserId that may belong
 * to someone other than the caller (self-attesting skips this — the session
 * already has what's needed). Only looks at nurse/guardian identities linked
 * to this patient, mirroring canDocumentMedicationAdministration's own check.
 */
export async function resolveAdministeredByActor(
  userId: string,
  patientId: string
): Promise<{ role: string; displayName: string } | null> {
  const nurse = await (prisma.nurseProfile.findFirst as any)({
    where: { userId, nursePatients: { some: { patientId, isActive: true } } },
    select: { firstName: true, lastName: true, displayName: true, credentials: true },
  })
  if (nurse) return { role: 'nurse', displayName: signedName(nurse) }

  const guardianLink = await (prisma.guardianPatient.findUnique as any)({
    where: { userId_patientId: { userId, patientId } },
    include: { user: { select: { name: true } } },
  })
  if (guardianLink) return { role: 'guardian', displayName: guardianLink.user.name }

  return null
}
