'use client'

// dotColor is optional — a plain "bg-{color}-{shade}" Tailwind class. When a
// caller supplies it (see PatientTabs.tsx), a small colored dot renders next
// to the label as a category indicator, visible in both the active and
// inactive states. Callers that don't pass it (e.g. app/admin/page.tsx,
// app/family/profile/page.tsx) render exactly as before.
type Tab = { key: string; label: string; dotColor?: string }

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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition ${
            active === t.key
              ? 'bg-[#2F3E4E] text-white'
              : 'bg-white text-[#2F3E4E] border border-[#D9E1E8] hover:border-[#7A8F79] hover:text-[#7A8F79]'
          }`}
        >
          {t.dotColor && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.dotColor}`} />}
          {t.label}
        </button>
      ))}
    </div>
  )
}
