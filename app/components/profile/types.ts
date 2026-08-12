export const inp = 'w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'
export const lbl = 'block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1'

// Shape returned by every profile route (nurse/admin/family self-service,
// admin-viewing-any-account) — a subset of NurseProfile's columns, flattened
// and (for encrypted fields) decrypted/masked as appropriate for who's asking.
export type ProfileCardData = {
  displayName?: string | null
  firstName?: string | null
  middleInitial?: string | null
  lastName?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  dob?: string | null
  ssn?: string | null
  npiNumber?: string | null
  medicaidNumber?: string | null
  bankName?: string | null
  bankRoutingOnFile?: boolean
  bankAccountOnFile?: boolean
}
