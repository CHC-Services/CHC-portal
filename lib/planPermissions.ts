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

// True only for nurses on a real paid subscription — trial does NOT count.
// Use this to gate features you want to hold back as an upgrade incentive.
export function isPaidSubscriber(planTier: string | null | undefined, trialExpiresAt: Date | string | null | undefined): boolean {
  const tier = (planTier || 'FREE') as PlanTier
  if (tier === 'PRO') return true
  if (tier === 'BASIC' && !trialExpiresAt) return true
  return false
}

// 14-day trial start date for new accounts
export function trialEndDate(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d
}
