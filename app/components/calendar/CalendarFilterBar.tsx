'use client'

// Shared filter-bar shell for every myCalendar page (nurse/family/admin/
// patient-scoped) — each filter section gets its header on its own line,
// left-aligned above its options, with a vertical divider between sections.
// Filtering itself works by actually excluding non-matching items from what
// gets passed to CalendarGrid (see each page's `visibleItems`), not by
// greying out days that still show every item regardless of the filter.
export function CalendarFilterBar({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-3 mb-4 flex items-start gap-4 flex-wrap">
      {children}
      {trailing && <div className="ml-auto pt-4">{trailing}</div>}
    </div>
  )
}

export function CalendarFilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1.5 pr-4 border-r border-[#D9E1E8] last:border-r-0 last:pr-0">
      <span className="text-[10px] uppercase tracking-wide font-bold text-[#7A8F79]">{label}</span>
      <div className="flex items-center gap-1.5 flex-wrap">{children}</div>
    </div>
  )
}
