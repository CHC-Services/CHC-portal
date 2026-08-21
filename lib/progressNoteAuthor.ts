import { signedName } from './formatName'

// A nurse author's name for a signed clinical record is "First Last,
// Credentials" (lib/formatName.ts's signedName()) — not NurseProfile.displayName,
// which is a casual name a nurse picks for herself elsewhere in the app and
// isn't a strong enough identifier on a document like this. An admin
// author's is just User.name. One helper instead of repeating this in every
// route that returns a ProgressNote or ProgressNoteAddendum.
//
// Prefers the frozen authorDisplayNameSnapshot (captured at sign time) over
// a live lookup — this is what keeps a note fully attributable even after
// the author's User account is later deleted (authorUser becomes null via
// onDelete: SetNull). The live-lookup path only fires for not-yet-signed
// drafts, or notes signed before this snapshot existed.
export function authorDisplayName(note: {
  authorRole: string
  authorDisplayNameSnapshot?: string | null
  authorUser?: {
    name: string
    nurseProfile: { firstName: string | null; lastName: string | null; displayName: string; credentials: string | null } | null
  } | null
}): string {
  if (note.authorDisplayNameSnapshot) return note.authorDisplayNameSnapshot
  if (note.authorUser) {
    return note.authorRole === 'nurse'
      ? (note.authorUser.nurseProfile ? signedName(note.authorUser.nurseProfile) : note.authorUser.name)
      : note.authorUser.name
  }
  return 'Former Staff Member'
}
