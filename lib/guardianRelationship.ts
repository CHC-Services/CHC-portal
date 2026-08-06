export const GUARDIAN_RELATIONSHIPS = ['Parent', 'Guardian', 'Caregiver (Non-Family)'] as const
export type GuardianRelationship = typeof GUARDIAN_RELATIONSHIPS[number]
