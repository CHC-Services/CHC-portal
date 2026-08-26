'use client'

import type { CalendarItem } from '../../../lib/calendarFeed'
import { computeViewRange, monthGridDays, daysBetween, dateKey, type CalendarViewMode } from '../../../lib/calendarViewRange'

// Shared grid renderer for every "myCalendar"/adCalendar/patient-calendar
// surface — Month gets a real 7-column grid (padded to whole weeks); Day/
// Week/Look-Ahead/Custom all share one day-section agenda layout, varying
// only in how many day-sections are included. Deliberately not a true
// hour-by-hour scheduling grid with overlap layout — that's a much bigger
// UI problem than Phase 1 needs; each day's items are just a sorted list.

const CATEGORY_COLORS: Record<string, string> = {
  shift: 'bg-[#2F3E4E] text-white',
  appointment: 'bg-sky-600 text-white',
  globalEvent: 'bg-purple-600 text-white',
  medication: 'bg-amber-500 text-white',
  priorAuth: 'bg-amber-500 text-white',
  claim: 'bg-red-500 text-white',
  document: 'bg-red-500 text-white',
  progressNote: 'bg-[#7A8F79] text-white',
  personalReminder: 'bg-[#7A8F79] text-white',
}

function chipClass(category: string): string {
  return CATEGORY_COLORS[category] || 'bg-[#7A8F79] text-white'
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function ItemChip({ item, onClick }: { item: CalendarItem; onClick?: (item: CalendarItem) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(item)}
      className={`w-full text-left text-[10px] leading-tight px-1.5 py-0.5 rounded truncate ${chipClass(item.category)} hover:opacity-80 transition`}
      title={`${fmtTime(item.date)} — ${item.title}${item.patientName ? ` (${item.patientName})` : ''}`}
    >
      {fmtTime(item.date)} {item.title}
    </button>
  )
}

function groupByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>()
  for (const item of items) {
    const key = dateKey(item.date)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return map
}

// A genuinely multi-day all-day item (e.g. a 3-day appointment) renders as
// its own spanning bar in the month view's banner lane instead of a normal
// per-day chip — a single-day all-day item still just renders as a chip.
function isSpanningAllDay(item: CalendarItem): boolean {
  return !!item.allDay && !!item.endDate && dateKey(item.endDate) !== dateKey(item.date)
}

type SpanningBar = { item: CalendarItem; startCol: number; endCol: number }

// One bar per spanning item that overlaps this week, clamped to that week's
// own 7 columns — this is what makes a Sat→Sun span draw as two separate
// bars (one per week-row, each showing its own title) instead of one
// continuous bar, since a month grid is laid out week-row by week-row.
function weekSpanningBars(week: Date[], items: CalendarItem[]): SpanningBar[] {
  const weekStartKey = dateKey(week[0])
  const weekEndKey = dateKey(week[6])
  const bars: SpanningBar[] = []
  for (const item of items) {
    if (!isSpanningAllDay(item)) continue
    const itemStartKey = dateKey(item.date)
    const itemEndKey = dateKey(item.endDate!)
    if (itemStartKey > weekEndKey || itemEndKey < weekStartKey) continue
    const startCol = itemStartKey <= weekStartKey ? 0 : week.findIndex(d => dateKey(d) === itemStartKey)
    const endCol = itemEndKey >= weekEndKey ? 6 : week.findIndex(d => dateKey(d) === itemEndKey)
    bars.push({ item, startCol, endCol })
  }
  return bars
}

export default function CalendarGrid({
  items,
  view,
  anchorDate,
  customRange,
  onItemClick,
  onDayClick,
  isGreyedOut,
}: {
  items: CalendarItem[]
  view: CalendarViewMode
  anchorDate: Date
  customRange?: { start: Date; end: Date }
  onItemClick?: (item: CalendarItem) => void
  onDayClick?: (day: Date) => void
  isGreyedOut?: (key: string) => boolean
}) {
  const byDay = groupByDay(items)
  const today = dateKey(new Date())

  if (view === 'month') {
    const days = monthGridDays(anchorDate)
    const thisMonth = anchorDate.getMonth()
    const weeks: Date[][] = []
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

    return (
      <div className="space-y-1">
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <p key={d} className="text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] text-center pb-1">{d}</p>
          ))}
        </div>
        {weeks.map(week => {
          const bars = weekSpanningBars(week, items)
          return (
            <div key={dateKey(week[0])} className="space-y-0.5">
              {bars.length > 0 && (
                <div className="space-y-0.5">
                  {bars.map(({ item, startCol, endCol }) => (
                    <div key={item.id} className="grid grid-cols-7 gap-1">
                      <button
                        type="button"
                        onClick={() => onItemClick?.(item)}
                        style={{ gridColumnStart: startCol + 1, gridColumnEnd: endCol + 2 }}
                        className={`text-left text-[10px] leading-tight px-1.5 py-0.5 rounded truncate ${chipClass(item.category)} hover:opacity-80 transition`}
                        title={`${item.title}${item.patientName ? ` (${item.patientName})` : ''}`}
                      >
                        {item.title}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-7 gap-1">
                {week.map(day => {
                  const key = dateKey(day)
                  const dayItems = (byDay.get(key) || []).filter(item => !isSpanningAllDay(item))
                  const greyed = isGreyedOut?.(key) ?? false
                  const inMonth = day.getMonth() === thisMonth
                  return (
                    <div
                      key={key}
                      className={`min-h-[80px] border border-[#D9E1E8] rounded-lg p-1 space-y-0.5 transition ${
                        greyed ? 'opacity-30' : ''
                      } ${inMonth ? 'bg-white' : 'bg-[#F4F6F5]'} ${key === today ? 'ring-2 ring-[#7A8F79]' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => onDayClick?.(day)}
                        className={`text-[11px] font-semibold ${inMonth ? 'text-[#2F3E4E]' : 'text-[#7A8F79]'} hover:underline`}
                      >
                        {day.getDate()}
                      </button>
                      <div className="space-y-0.5">
                        {dayItems.slice(0, 3).map(item => <ItemChip key={item.id} item={item} onClick={onItemClick} />)}
                        {dayItems.length > 3 && (
                          <button type="button" onClick={() => onDayClick?.(day)} className="text-[10px] text-[#7A8F79] hover:underline">
                            +{dayItems.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Day / Week / Look-Ahead / Custom — shared day-section agenda layout
  const { start, end } = computeViewRange(view, anchorDate, customRange)
  const days = daysBetween(start, end)

  return (
    <div className="space-y-3">
      {days.map(day => {
        const key = dateKey(day)
        const dayItems = (byDay.get(key) || []).sort((a, b) => a.date.getTime() - b.date.getTime())
        const greyed = isGreyedOut?.(key) ?? false
        return (
          <div key={key} className={`border border-[#D9E1E8] rounded-xl p-3 transition ${greyed ? 'opacity-30' : ''} ${key === today ? 'ring-2 ring-[#7A8F79]' : ''}`}>
            <p className="text-xs font-bold text-[#2F3E4E] mb-2">
              {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
            {dayItems.length === 0 ? (
              <p className="text-xs text-[#7A8F79] italic">Nothing scheduled.</p>
            ) : (
              <div className="space-y-1">
                {dayItems.map(item => <ItemChip key={item.id} item={item} onClick={onItemClick} />)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
