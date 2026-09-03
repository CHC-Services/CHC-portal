import { prisma } from './prisma'
import { getPresignedDownloadUrl } from './s3'

// Batch-resolves a set of user ids' saved e-initial image to a short-lived
// presigned URL, for MAR/TAR grid cells. Nurses store theirs on
// NurseProfile.initialsImageKey, admins on User.initialsImageKey (same
// admin-only asymmetry as signatureImageKey) — guardians have no e-initial
// capture UI yet, so they simply never appear in the returned map, and
// callers fall back to computed text initials for them. One query per
// table, not one per entry, so a week/month grid full of the same one or
// two people's dose marks doesn't refetch the same image repeatedly.
export async function resolveInitialsImages(userIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds)].filter((id): id is string => !!id)
  if (uniqueIds.length === 0) return new Map()

  const [nurseProfiles, users] = await Promise.all([
    prisma.nurseProfile.findMany({
      where: { userId: { in: uniqueIds }, initialsImageKey: { not: null } },
      select: { userId: true, initialsImageKey: true },
    }),
    prisma.user.findMany({
      where: { id: { in: uniqueIds }, initialsImageKey: { not: null } },
      select: { id: true, initialsImageKey: true },
    }),
  ])

  const keyByUserId = new Map<string, string>()
  for (const p of nurseProfiles) if (p.initialsImageKey) keyByUserId.set(p.userId, p.initialsImageKey)
  for (const u of users) if (u.initialsImageKey) keyByUserId.set(u.id, u.initialsImageKey)

  const entries = await Promise.all(
    [...keyByUserId.entries()].map(async ([userId, key]) =>
      [userId, await getPresignedDownloadUrl(key, 900, { inline: true, contentType: 'image/png' })] as const
    )
  )
  return new Map(entries)
}
