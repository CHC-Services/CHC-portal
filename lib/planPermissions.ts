export type PlanTier = 'FREE' | 'BASIC' | 'PRO'

export function getEffectiveTier(planTier: string | null | undefined, trialExpiresAt: Date | string | null | undefined): PlanTier {
  const tier = (planTier || 'FREE') as PlanTier
  if (tier === 'BASIC' && trialExpiresAt && new Date() > new Date(trialExpiresAt)) {
    return 'FREE'
  }
  return tier
}

export function canAccessBasic(tier: PlanTier): boolean {
  return tier === 'BASIC' || tier === 'PRO'
}

export function canAccessPro(tier: PlanTier): boolean {
  return tier === 'PRO'
}
