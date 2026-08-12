import { prisma } from './prisma'

// Single source of truth for the profile "cards" every role's profile page can
// show. Visibility per role is admin-configurable at runtime via
// ProfileCardConfig (app/admin/system/profile-cards) — no deploy needed to
// add/remove a card from a role. All card data lives on NurseProfile
// regardless of the owning account's role; see prisma/schema.prisma's
// ProfileCardConfig model comment for why.
export const PROFILE_CARD_KEYS = ['demographics', 'billing_info', 'banking'] as const
export type ProfileCardKey = typeof PROFILE_CARD_KEYS[number]

export const PROFILE_CARD_LABELS: Record<ProfileCardKey, string> = {
  demographics: 'Demographics',
  billing_info: 'Billing Info',
  banking: 'Banking',
}

export async function getVisibleCards(role: string): Promise<ProfileCardKey[]> {
  const rows = await (prisma.profileCardConfig.findMany as any)({
    where: { role, enabled: true },
    select: { cardKey: true },
  })
  const enabled = new Set(rows.map((r: any) => r.cardKey))
  return PROFILE_CARD_KEYS.filter(k => enabled.has(k))
}
