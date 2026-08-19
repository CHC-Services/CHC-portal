// A nurse author's display name lives on NurseProfile.displayName; an admin
// author's lives on User.name — one helper instead of repeating this
// ternary in every route that returns a ProgressNote or ProgressNoteAddendum.
export function authorDisplayName(note: {
  authorRole: string
  authorUser: { name: string; nurseProfile: { displayName: string } | null }
}): string {
  return note.authorRole === 'nurse'
    ? (note.authorUser.nurseProfile?.displayName || note.authorUser.name)
    : note.authorUser.name
}
