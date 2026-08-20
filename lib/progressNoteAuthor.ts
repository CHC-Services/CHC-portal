// A nurse author's display name lives on NurseProfile.displayName; an admin
// author's lives on User.name — one helper instead of repeating this
// ternary in every route that returns a ProgressNote or ProgressNoteAddendum.
//
// Prefers the frozen authorDisplayNameSnapshot (captured at sign time) over
// a live lookup — this is what keeps a note fully attributable even after
// the author's User account is later deleted (authorUser becomes null via
// onDelete: SetNull). The live-lookup path only fires for not-yet-signed
// drafts, or notes signed before this snapshot existed.
export function authorDisplayName(note: {
  authorRole: string
  authorDisplayNameSnapshot?: string | null
  authorUser?: { name: string; nurseProfile: { displayName: string } | null } | null
}): string {
  if (note.authorDisplayNameSnapshot) return note.authorDisplayNameSnapshot
  if (note.authorUser) {
    return note.authorRole === 'nurse'
      ? (note.authorUser.nurseProfile?.displayName || note.authorUser.name)
      : note.authorUser.name
  }
  return 'Former Staff Member'
}
