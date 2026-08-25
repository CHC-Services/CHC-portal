// Friendly labels for GlobalEvent.targetRoles, used by the admin "+ Add
// Event" Audience dropdown. The underlying field already means "empty =
// everyone; otherwise only these roles" (see prisma/schema.prisma) — this is
// just a readable mapping on top of that, not new storage.
export const EVENT_AUDIENCES: { label: string; targetRoles: string[] }[] = [
  { label: 'Personal (admin only)', targetRoles: ['admin'] },
  { label: 'Providers (all medical professionals)', targetRoles: ['nurse', 'provider'] },
  { label: 'Family/Caregivers (non-medical users)', targetRoles: ['guardian'] },
  { label: 'All Users', targetRoles: [] },
]

// Reverse lookup for displaying an existing event's audience label from its
// stored targetRoles array. Falls back to a raw role list if it doesn't
// exactly match one of the four standard options (e.g. legacy data).
export function audienceLabelForRoles(targetRoles: string[]): string {
  const sorted = [...targetRoles].sort()
  const match = EVENT_AUDIENCES.find(a => {
    const aSorted = [...a.targetRoles].sort()
    return aSorted.length === sorted.length && aSorted.every((r, i) => r === sorted[i])
  })
  return match ? match.label : (targetRoles.length ? targetRoles.join(', ') : 'All Users')
}
