'use client'

export default function ToggleRow({
  label, desc, checked, onChange,
}: {
  label: string
  desc: string
  checked: boolean
  onChange?: (val: boolean) => void
}) {
  const editable = !!onChange
  return (
    <label className={`flex items-center justify-between gap-3 ${editable ? 'cursor-pointer' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#2F3E4E] leading-tight">{label}</p>
        <p className="text-xs text-[#7A8F79] mt-0.5 leading-snug">{desc}</p>
      </div>
      <div className={`relative flex-shrink-0 ${editable ? '' : 'opacity-50'}`}>
        <input type="checkbox" className="sr-only" checked={checked} disabled={!editable} onChange={e => onChange?.(e.target.checked)} />
        <div className={`w-11 h-6 rounded-full transition-colors ${checked ? 'bg-[#2F3E4E]' : 'bg-[#D9E1E8]'}`} />
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </label>
  )
}
