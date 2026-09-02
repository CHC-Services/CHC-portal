'use client'

type Tab = { key: string; label: string }

export default function Tabs({
  tabs, active, onChange,
}: {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map(t => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition ${
            active === t.key
              ? 'bg-[#2F3E4E] text-white'
              : 'bg-white text-[#2F3E4E] border border-[#D9E1E8] hover:border-[#7A8F79] hover:text-[#7A8F79]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
