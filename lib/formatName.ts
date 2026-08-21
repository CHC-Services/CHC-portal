export function formalName(
  nurse: { firstName?: string | null; lastName?: string | null; displayName?: string | null },
  tight = false
): string {
  if (nurse.lastName && nurse.firstName) return tight ? nurse.lastName : `${nurse.lastName}, ${nurse.firstName}`
  if (nurse.lastName) return nurse.lastName
  return nurse.displayName || ''
}

// Natural-reading "First Last, Credentials" — for signed/attributed clinical
// records (Progress Note authorship), where the casual displayName a nurse
// picks for herself elsewhere in the app isn't a strong enough identifier.
// Falls back to displayName if formal first/last name was never filled out.
export function signedName(
  nurse: { firstName?: string | null; lastName?: string | null; displayName?: string | null; credentials?: string | null }
): string {
  if (nurse.firstName && nurse.lastName) {
    return `${nurse.firstName} ${nurse.lastName}${nurse.credentials ? `, ${nurse.credentials}` : ''}`
  }
  return nurse.displayName || ''
}
