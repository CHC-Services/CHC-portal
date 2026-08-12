import { prisma } from './prisma'

// Fully deletes a User account and everything attached to it. Reuses the
// exact dependency order already proven correct by
// app/api/admin/nurses/[id]/route.ts's DELETE handler: TimeEntry is the only
// NurseProfile relation that isn't onDelete: Cascade, so it must be deleted
// first; NurseProfile itself must be deleted before User (NurseProfile.user
// is Restrict-by-default). Every other NurseProfile relation (Claim, Invoice,
// NurseDocument, MedicaidClaim, NursePatient, etc.) cascades automatically.
//
// Any role can now carry a NurseProfile row, not just nurses — the profile
// cards feature lazily creates one for admin/guardian/biller accounts on
// their first profile-page visit. So this checks for one regardless of role,
// rather than assuming only nurse/provider accounts have it.
//
// GuardianPatient rows cascade automatically when User is deleted (onDelete:
// Cascade), so no special handling is needed for the guardian role beyond
// the NurseProfile check every role gets.
export async function deleteUserAccount(userId: string): Promise<void> {
  const profile = await (prisma.nurseProfile.findUnique as any)({
    where: { userId },
    select: { id: true },
  })

  if (profile) {
    await prisma.$transaction([
      prisma.timeEntry.deleteMany({ where: { nurseId: profile.id } }),
      prisma.nurseProfile.delete({ where: { id: profile.id } }),
      prisma.user.delete({ where: { id: userId } }),
    ])
  } else {
    await prisma.user.delete({ where: { id: userId } })
  }
}
