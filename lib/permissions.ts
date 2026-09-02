import { prisma } from './prisma'
import { FAMILY_GENERIC_ID } from './medicationAdministrationActor'

type Session = {
  id: string
  role: string
  nurseProfileId?: string
  [key: string]: any
}

// Shared relationship check, reused by every function below.
// Admin: unconditional (platform authority). Nurse: active NursePatient link
// (authorized clinical/work relationship). Guardian: GuardianPatient row exists
// (no isActive field on that model — row presence is the signal; this is the
// patient's case-management relationship, not a work-authorization one).
export async function isLinkedToPatient(session: Session, patientId: string): Promise<boolean> {
  if (session.role === 'admin') return true
  if (session.role === 'nurse' && session.nurseProfileId) {
    const link = await prisma.nursePatient.findUnique({
      where: { nurseId_patientId: { nurseId: session.nurseProfileId, patientId } },
    })
    return !!link && link.isActive
  }
  if (session.role === 'guardian') {
    const link = await prisma.guardianPatient.findUnique({
      where: { userId_patientId: { userId: session.id, patientId } },
    })
    return !!link
  }
  return false
}

// Alias for use at route/layout boundaries (e.g. app/patient/[id]/layout.tsx)
// where "can this session access this patient at all" reads more clearly
// than the internal helper name.
export const canAccessPatient = isLinkedToPatient

export async function canViewSchedule(session: Session, patientId: string) {
  return isLinkedToPatient(session, patientId)
}
export async function canViewAppointment(session: Session, patientId: string) {
  return isLinkedToPatient(session, patientId)
}

// Originate a shift. Admin/guardian only (case-management authority) — a nurse
// should not be able to arbitrarily restructure the patient's schedule just
// because they have a NursePatient relationship.
export async function canCreateShift(session: Session, patientId: string): Promise<boolean> {
  if (session.role === 'admin') return true
  if (session.role === 'guardian') return isLinkedToPatient(session, patientId)
  return false
}

// Edit a shift's fields. Admin/guardian: always (linked). Nurse: only their own
// assigned shift (e.g. notes, marking complete) — not reassignment/rescheduling.
export async function canEditShift(session: Session, shift: { patientId: string; nurseId: string | null }): Promise<boolean> {
  if (session.role === 'admin') return true
  if (session.role === 'guardian') return isLinkedToPatient(session, shift.patientId)
  if (session.role === 'nurse') return shift.nurseId === session.nurseProfileId
  return false
}
export async function canCancelShift(session: Session, shift: { patientId: string; nurseId: string | null }) {
  return canEditShift(session, shift)
}

// Assign/reassign a specific nurse to a shift. Admin/guardian only — the route
// must separately verify the target nurseId has an active NursePatient link
// before assigning (an integrity check, not an authorization check).
export async function canAssignShift(session: Session, patientId: string): Promise<boolean> {
  if (session.role === 'admin') return true
  if (session.role === 'guardian') return isLinkedToPatient(session, patientId)
  return false
}

// A nurse volunteering to take an open/coverage-needed shift. Nurse-only — the
// one shift action that originates from the nurse side. Auto-assigns on claim
// (no pending-approval state) — guardian/admin can still reassign afterward.
export async function canClaimOpenShift(session: Session, shift: { patientId: string; nurseId: string | null; status: string }): Promise<boolean> {
  if (session.role !== 'nurse' || !session.nurseProfileId) return false
  if (shift.nurseId !== null || !['open', 'coverage_needed'].includes(shift.status)) return false
  const link = await prisma.nursePatient.findUnique({
    where: { nurseId_patientId: { nurseId: session.nurseProfileId, patientId: shift.patientId } },
  })
  return !!link && link.isActive
}

// An assigned nurse releasing a shift they can no longer work — returns it to
// coverage_needed. Also usable by admin/guardian to force-release a nurse from
// a shift without cancelling the shift outright.
export async function canReleaseShift(session: Session, shift: { patientId: string; nurseId: string | null }): Promise<boolean> {
  if (session.role === 'admin') return true
  if (session.role === 'guardian') return isLinkedToPatient(session, shift.patientId)
  if (session.role === 'nurse') return shift.nurseId === session.nurseProfileId
  return false
}

// Appointments — guardian has equal create/edit/cancel authority to nurse
// (families typically coordinate directly with physicians), not read-only.
export async function canCreateAppointment(session: Session, patientId: string) {
  return isLinkedToPatient(session, patientId)
}
export async function canEditAppointment(session: Session, patientId: string) {
  return isLinkedToPatient(session, patientId)
}
export async function canCancelAppointment(session: Session, patientId: string) {
  return isLinkedToPatient(session, patientId)
}

// Progress Notes — the first real "authored clinical record" in this app.
// Any linked nurse (not just the author), linked guardian, or admin can read
// notes for a patient — clinical history should be visible to the whole care
// team, not just whoever wrote each entry.
export async function canViewProgressNote(session: Session, patientId: string) {
  return isLinkedToPatient(session, patientId)
}

// Nurse (actively linked) OR admin (unconditional — matches isLinkedToPatient's
// own admin branch, and the standing "admin never hits a real wall" principle)
// may start a note.
export async function canCreateProgressNote(session: Session, patientId: string): Promise<boolean> {
  if (session.role === 'admin') return true
  if (session.role !== 'nurse' || !session.nurseProfileId) return false
  return isLinkedToPatient(session, patientId)
}

// Edit (including sign, delete-while-draft) is author-only, and only while
// still a draft — symmetric for nurse or admin authors. Nobody, including
// admin, can reopen someone else's note; corrections to a signed note go
// through an addendum instead (see canAddAddendum).
export async function canEditProgressNote(session: Session, note: { authorUserId: string | null; signedAt: Date | null }): Promise<boolean> {
  return note.authorUserId === session.id && !note.signedAt
}

// Admin-only escape hatch for genuine errors — marks a signed note voided
// without altering its content, mirroring Claim's voidedAt convention.
export async function canVoidProgressNote(session: Session): Promise<boolean> {
  return session.role === 'admin'
}

// Appending a signed addendum to an already-signed, non-voided note. Admin
// always; the original author may also add a late addendum to their own
// note (standard EMR "late entry" pattern) — never anyone else, never before
// signing (that's just editing), never on a voided note.
export async function canAddAddendum(session: Session, note: { authorUserId: string | null; signedAt: Date | null; voidedAt: Date | null }): Promise<boolean> {
  if (!note.signedAt || note.voidedAt) return false
  if (session.role === 'admin') return true
  return note.authorUserId === session.id
}

// Replace/delete a document-based note's attached file (lib/progressNoteDocument.ts).
// A document-based note is signed the instant it's created, so the usual
// "edit only while unsigned" rule (canEditProgressNote) doesn't apply — this
// is the narrow carve-out that lets a nurse fix "I picked the wrong file"
// without reopening the note itself. Callers must additionally confirm
// note.documentStorageKey is set before checking this.
export async function canManageProgressNoteDocument(session: Session, note: { authorUserId: string | null }): Promise<boolean> {
  if (session.role === 'admin') return true
  return session.role === 'nurse' && note.authorUserId === session.id
}

// Medication Administration Record (MAR) — whole care team can see the log,
// same as clinical notes.
export async function canViewMedicationAdministration(session: Session, patientId: string): Promise<boolean> {
  return isLinkedToPatient(session, patientId)
}

// Document a dose administration. Self-attesting your own dose is always
// allowed for any linked role. Attributing it to someone *else* is nurse/
// admin only — the explicit point of this feature: a nurse can log that a
// family member gave a dose, even outside her own shift, because families
// often don't fill out their own paperwork; a guardian can only log their
// own. The target must actually be a nurse or guardian linked to this
// patient, verified here, never just trusted from the request body.
export async function canDocumentMedicationAdministration(
  session: Session,
  patientId: string,
  administeredByUserId: string | null
): Promise<boolean> {
  if (!(await isLinkedToPatient(session, patientId))) return false
  if (!administeredByUserId || administeredByUserId === session.id) return true
  if (session.role !== 'nurse' && session.role !== 'admin') return false
  // "Some family member gave it" without naming a specific linked guardian —
  // nurse/admin only (same restriction as attributing to a specific named
  // person), but there's no real user to verify against.
  if (administeredByUserId === FAMILY_GENERIC_ID) return true

  const [nurseLink, guardianLink] = await Promise.all([
    prisma.nurseProfile.findFirst({
      where: { userId: administeredByUserId, nursePatients: { some: { patientId, isActive: true } } },
      select: { id: true },
    }),
    prisma.guardianPatient.findUnique({
      where: { userId_patientId: { userId: administeredByUserId, patientId } },
    }),
  ])
  return !!nurseLink || !!guardianLink
}

// Edit/delete an existing MAR entry — whoever entered it (so a nurse can fix
// her own back-filled entries), or admin.
export async function canEditMedicationAdministration(
  session: Session,
  entry: { documentedByUserId: string }
): Promise<boolean> {
  if (session.role === 'admin') return true
  return entry.documentedByUserId === session.id
}
