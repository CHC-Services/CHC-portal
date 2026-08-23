import { prisma } from './prisma'

// Fully deletes a User account and everything attached to it. Reuses the
// exact dependency order already proven correct by
// app/api/admin/nurses/[id]/route.ts's DELETE handler: TimeEntry is the only
// NurseProfile relation that isn't onDelete: Cascade, so it must be deleted
// first; NurseProfile itself must be deleted before User (NurseProfile.user
// is Restrict-by-default). Every other NurseProfile relation (Claim, Invoice,
// NurseDocument, NursePatient, etc.) cascades automatically.
//
// Any role can now carry a NurseProfile row, not just nurses — the profile
// cards feature lazily creates one for admin/guardian/biller accounts on
// their first profile-page visit. So this checks for one regardless of role,
// rather than assuming only nurse/provider accounts have it.
//
// GuardianPatient rows cascade automatically when User is deleted (onDelete:
// Cascade), so no special handling is needed for the guardian role beyond
// the NurseProfile check every role gets.
//
// ProgressNote/ProgressNoteAddendum are the one exception to "let cascades
// handle it": those relations are onDelete: SetNull specifically so signed
// clinical records survive account deletion (they're real records — a
// nurse's own billing/PA documentation, a patient's chart history — not
// disposable like a session or a reminder). Before deleting the account,
// this: (1) deletes any of the user's own unsigned drafts, which have no
// record value yet, same as the existing self-serve Delete Draft action,
// and (2) freezes authorDisplayNameSnapshot onto any signed note/addendum
// that doesn't already have one (only possible for records signed before
// that snapshot existed) — the very last chance to capture the live name
// before the User row (and the name with it) is gone.
export async function deleteUserAccount(userId: string): Promise<void> {
  const [profile, user] = await Promise.all([
    (prisma.nurseProfile.findUnique as any)({ where: { userId }, select: { id: true, displayName: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ])

  await prisma.$transaction(async (tx) => {
    await tx.progressNote.deleteMany({ where: { authorUserId: userId, signedAt: null } })

    const nurseDisplayName = profile?.displayName as string | undefined
    const userName = user?.name

    await tx.progressNote.updateMany({
      where: { authorUserId: userId, signedAt: { not: null }, authorDisplayNameSnapshot: null, authorRole: 'nurse' },
      data: { authorDisplayNameSnapshot: nurseDisplayName || userName },
    })
    await tx.progressNote.updateMany({
      where: { authorUserId: userId, signedAt: { not: null }, authorDisplayNameSnapshot: null, authorRole: { not: 'nurse' } },
      data: { authorDisplayNameSnapshot: userName },
    })
    await tx.progressNoteAddendum.updateMany({
      where: { authorUserId: userId, authorDisplayNameSnapshot: null, authorRole: 'nurse' },
      data: { authorDisplayNameSnapshot: nurseDisplayName || userName },
    })
    await tx.progressNoteAddendum.updateMany({
      where: { authorUserId: userId, authorDisplayNameSnapshot: null, authorRole: { not: 'nurse' } },
      data: { authorDisplayNameSnapshot: userName },
    })

    if (profile) {
      await tx.timeEntry.deleteMany({ where: { nurseId: profile.id } })
      await tx.nurseProfile.delete({ where: { id: profile.id } })
    }
    await tx.user.delete({ where: { id: userId } })
  })
}
