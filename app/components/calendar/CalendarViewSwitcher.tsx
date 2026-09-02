'use client'

import { useRef } from 'react'
import { shiftAnchor, type CalendarViewMode } from '../../../lib/calendarViewRange'
import DateInput from '../DateInput'

// View-mode tabs + prev/today/next navigation (or a custom date-range picker
// when view === 'custom'), shared by every "myCalendar"-style page (nurse's
// personal agenda, the per-patient calendar, and eventually family/admin).

const VIEW_LABEL: Record<CalendarViewMode, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  lookahead: '14-Day',
  custom: 'Custom',
}

export default function CalendarViewSwitcher({
  view, onViewChange, anchorDate, onAnchorChange, customStart, customEnd, onCustomStartChange, onCustomEndChange, rangeLabel,
}: {
  view: CalendarViewMode
  onViewChange: (v: CalendarViewMode) => void
  anchorDate: Date
  onAnchorChange: (d: Date) => void
  customStart: string
  customEnd: string
  onCustomStartChange: (v: string) => void
  onCustomEndChange: (v: string) => void
  rangeLabel: string
}) {
  const customEndRef = useRef<HTMLInputElement>(null)
  return (
    <div className="bg-white rounded-xl shadow-sm p-3 mb-4 flex items-center justify-between flex-wrap gap-3">
      <div className="flex gap-1 flex-wrap">
        {(Object.keys(VIEW_LABEL) as CalendarViewMode[]).map(v => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              view === v ? 'bg-[#2F3E4E] text-white' : 'bg-[#F4F6F5] text-[#7A8F79] hover:bg-[#D9E1E8]'
            }`}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>

      {view === 'custom' ? (
        <div className="flex items-center gap-2 text-sm">
          <DateInput className="border border-[#D9E1E8] p-1.5 rounded-lg text-xs" value={customStart} onChange={e => onCustomStartChange(e.target.value)} nextRef={customEndRef} />
          <span className="text-[#7A8F79]">to</span>
          <DateInput ref={customEndRef} className="border border-[#D9E1E8] p-1.5 rounded-lg text-xs" value={customEnd} onChange={e => onCustomEndChange(e.target.value)} />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={() => onAnchorChange(shiftAnchor(view, anchorDate, -1))} className="w-7 h-7 rounded-full bg-[#F4F6F5] text-[#2F3E4E] hover:bg-[#D9E1E8] transition text-sm font-bold">‹</button>
          <button onClick={() => onAnchorChange(new Date())} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition px-2">Today</button>
          <button onClick={() => onAnchorChange(shiftAnchor(view, anchorDate, 1))} className="w-7 h-7 rounded-full bg-[#F4F6F5] text-[#2F3E4E] hover:bg-[#D9E1E8] transition text-sm font-bold">›</button>
          <span className="text-sm font-semibold text-[#2F3E4E] ml-1">{rangeLabel}</span>
        </div>
      )}
    </div>
  )
}
