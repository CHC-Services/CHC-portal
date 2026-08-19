import { prisma } from './prisma'

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
async function isLinkedToPatient(session: Session, patientId: string): Promise<boolean> {
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
