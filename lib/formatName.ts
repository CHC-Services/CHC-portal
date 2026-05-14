export function formalName(
  nurse: { firstName?: string | null; lastName?: string | null; displayName?: string | null },
  tight = false
): string {
  if (nurse.lastName && nurse.firstName) return tight ? nurse.lastName : `${nurse.lastName}, ${nurse.firstName}`
  if (nurse.lastName) return nurse.lastName
  return nurse.displayName || ''
}
