// Site-wide read-only field/section display for pages that show already-filled-out
// data (profile pages, patient records, etc). Pair with a local `editing` boolean and
// an "Edit" button in the page — render this when !editing, swap to the real form
// inputs when editing. Keeps filled-out pages compact instead of showing open inputs
// for data that's already been entered.

export function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-sm py-1">
      <span className="text-[#7A8F79] w-32 shrink-0">{label}</span>
      <span className="text-[#2F3E4E] font-medium">{value}</span>
    </div>
  )
}

export function SectionHeader({
  title, editing, onEdit,
}: {
  title: string
  editing: boolean
  onEdit: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-3 pb-1 border-b border-[#D9E1E8]">
      <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E]">{title}</p>
      {!editing && (
        <button onClick={onEdit} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
          Edit
        </button>
      )}
    </div>
  )
}
