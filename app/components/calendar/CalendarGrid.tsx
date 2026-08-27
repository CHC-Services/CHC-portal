'use client'

import type { CalendarItem } from '../../../lib/calendarFeed'
import { computeViewRange, monthGridDays, daysBetween, dateKey, type CalendarViewMode } from '../../../lib/calendarViewRange'

// Shared grid renderer for every "myCalendar"/adCalendar/patient-calendar
// surface — Month gets a real 7-column grid (padded to whole weeks); Day/
// Week/Look-Ahead/Custom all share one day-section agenda layout, varying
// only in how many day-sections are included. Deliberately not a true
// hour-by-hour scheduling grid with overlap layout — that's a much bigger
// UI problem than Phase 1 needs; each day's items are just a sorted list.

// Pastel-coded so repeat event types stand out at a glance (Alex's request —
// shift assignment state and reminder type should be readable from color
// alone without opening each item). Shift color depends on status, not just
// category, so it's handled separately in chipClass() below rather than here.
const CATEGORY_COLORS: Record<string, string> = {
  appointment: 'bg-purple-100 text-purple-800',
  globalEvent: 'bg-purple-600 text-white',
  medication: 'bg-orange-100 text-orange-800',
  // Prior Auth and Document expirations share a color — both are, from a
  // nurse's perspective, "a document on file is about to expire."
  priorAuth: 'bg-yellow-100 text-yellow-800',
  document: 'bg-yellow-100 text-yellow-800',
  progressNote: 'bg-[#7A8F79] text-white',
  personalReminder: 'bg-[#7A8F79] text-white',
}

function chipClass(item: CalendarItem): string {
  if (item.category === 'shift') {
    // 'assigned'/'completed' had a provider on it; 'open'/'coverage_needed'
    // (and the rare stray 'cancelled') did not.
    return item.status === 'assigned' || item.status === 'completed'
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800'
  }
  return CATEGORY_COLORS[item.category] || 'bg-[#7A8F79] text-white'
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function ItemChip({ item, onClick }: { item: CalendarItem; onClick?: (item: CalendarItem) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(item)}
      className={`w-full text-left text-[10px] leading-tight px-1.5 py-0.5 rounded truncate ${chipClass(item)} hover:opacity-80 transition`}
      title={`${fmtTime(item.date)} — ${item.title}${item.patientName ? ` (${item.patientName})` : ''}`}
    >
      {fmtTime(item.date)} {item.title}
    </button>
  )
}

// Medication refills and progress notes are dense, repeat-per-day event
// types that used to eat a full chip each — on a patient with several active
// scripts that alone could fill a day's cell. Both get pulled out of the
// normal chip list on month/week views and summarized as a single corner
// badge instead (see MedicationBadge/ProgressNoteBadge below); the Day view
// still lists them individually since that's the actual drill-down view
// someone lands on to see which script or which note.
const COMPACT_ONLY_CATEGORIES = new Set(['medication', 'progressNote'])

function medicationFlags(dayItems: CalendarItem[]): { show: boolean; overdue: boolean } {
  const meds = dayItems.filter(i => i.category === 'medication')
  return { show: meds.length > 0, overdue: meds.some(m => m.status === 'overdue') }
}

function progressNoteCount(dayItems: CalendarItem[]): number {
  return dayItems.filter(i => i.category === 'progressNote').length
}

// Overdue = the due date has arrived and nobody's marked it ordered/filled
// yet — animate-pulse gives it the "fading blink" nudge Alex asked for;
// a refill that's merely upcoming (badge visible, not yet due) stays static.
function MedicationBadge({ overdue, onClick }: { overdue: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={overdue ? 'Refill overdue — not yet ordered or filled' : 'Refill due this day'}
      className={`leading-none ${overdue ? 'animate-pulse' : ''}`}
    >
      💊
    </button>
  )
}

function ProgressNoteBadge({ count, onClick }: { count: number; onClick?: () => void }) {
  const marks = Math.min(count, 2)
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${count} progress note${count > 1 ? 's' : ''} filed`}
      className="leading-none text-green-600 font-bold"
    >
      {'✓'.repeat(marks)}
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
          {['Sat', 'Fri', 'Thu', 'Wed', 'Tue', 'Mon', 'Sun'].map(d => (
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
                        // Columns are mirrored for display (6 - col) since the
                        // day cells below render right-to-left.
                        style={{ gridColumnStart: (6 - endCol) + 1, gridColumnEnd: (6 - startCol) + 2 }}
                        className={`text-left text-[10px] leading-tight px-1.5 py-0.5 rounded truncate ${chipClass(item)} hover:opacity-80 transition`}
                        title={`${item.title}${item.patientName ? ` (${item.patientName})` : ''}`}
                      >
                        {item.title}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-7 gap-1">
                {[...week].reverse().map(day => {
                  const key = dateKey(day)
                  const dayItems = (byDay.get(key) || []).filter(item => !isSpanningAllDay(item))
                  const visibleItems = dayItems.filter(item => !COMPACT_ONLY_CATEGORIES.has(item.category))
                  const meds = medicationFlags(dayItems)
                  const noteCount = progressNoteCount(dayItems)
                  const greyed = isGreyedOut?.(key) ?? false
                  const inMonth = day.getMonth() === thisMonth
                  // Rather than tracking a separate muted color for every
                  // "this already happened" event status, a passed day just
                  // gets its date number struck through once.
                  const isPast = key < today
                  return (
                    <div
                      key={key}
                      className={`relative min-h-[80px] border border-[#D9E1E8] rounded-lg p-1 space-y-0.5 transition ${
                        greyed ? 'opacity-30' : ''
                      } ${inMonth ? 'bg-white' : 'bg-[#F4F6F5]'} ${key === today ? 'ring-2 ring-[#7A8F79]' : ''}`}
                    >
                      {meds.show && (
                        <span className="absolute top-0.5 right-0.5 text-xs">
                          <MedicationBadge overdue={meds.overdue} onClick={() => onDayClick?.(day)} />
                        </span>
                      )}
                      {noteCount > 0 && (
                        <span className="absolute bottom-0.5 right-0.5 text-[10px]">
                          <ProgressNoteBadge count={noteCount} onClick={() => onDayClick?.(day)} />
                        </span>
                      )}
                      <span className="relative inline-block">
                        <button
                          type="button"
                          onClick={() => onDayClick?.(day)}
                          className={`text-[11px] font-semibold ${inMonth ? 'text-[#2F3E4E]' : 'text-[#7A8F79]'} hover:underline`}
                        >
                          {day.getDate()}
                        </button>
                        {isPast && (
                          <span
                            className="absolute -inset-0.5 pointer-events-none"
                            style={{
                              backgroundImage: 'linear-gradient(to bottom left, transparent calc(50% - 0.5px), rgba(220,38,38,0.75) calc(50% - 0.5px), rgba(220,38,38,0.75) calc(50% + 0.5px), transparent calc(50% + 0.5px))',
                            }}
                          />
                        )}
                      </span>
                      <div className="space-y-0.5">
                        {visibleItems.slice(0, 3).map(item => <ItemChip key={item.id} item={item} onClick={onItemClick} />)}
                        {visibleItems.length > 3 && (
                          <button type="button" onClick={() => onDayClick?.(day)} className="text-[10px] text-[#7A8F79] hover:underline">
                            +{visibleItems.length - 3} more
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

  // Day / Week / Look-Ahead / Custom — shared day-section agenda layout.
  // Week view gets the same compact medication/progress-note badge treatment
  // as Month (Alex asked for both); Day view keeps the full itemized list
  // since that's the actual drill-down someone lands on (via onDayClick) to
  // see which script or which note.
  const { start, end } = computeViewRange(view, anchorDate, customRange)
  const days = daysBetween(start, end)
  const isCompact = view === 'week'

  return (
    <div className="space-y-3">
      {days.map(day => {
        const key = dateKey(day)
        const dayItems = (byDay.get(key) || []).sort((a, b) => a.date.getTime() - b.date.getTime())
        const visibleItems = isCompact ? dayItems.filter(item => !COMPACT_ONLY_CATEGORIES.has(item.category)) : dayItems
        const meds = isCompact ? medicationFlags(dayItems) : { show: false, overdue: false }
        const noteCount = isCompact ? progressNoteCount(dayItems) : 0
        const greyed = isGreyedOut?.(key) ?? false
        return (
          <div key={key} className={`border border-[#D9E1E8] rounded-xl p-3 transition ${greyed ? 'opacity-30' : ''} ${key === today ? 'ring-2 ring-[#7A8F79]' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-[#2F3E4E]">
                {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
              {(meds.show || noteCount > 0) && (
                <div className="flex items-center gap-2 text-sm">
                  {meds.show && <MedicationBadge overdue={meds.overdue} onClick={() => onDayClick?.(day)} />}
                  {noteCount > 0 && <span className="text-[11px]"><ProgressNoteBadge count={noteCount} onClick={() => onDayClick?.(day)} /></span>}
                </div>
              )}
            </div>
            {dayItems.length === 0 ? (
              <p className="text-xs text-[#7A8F79] italic">Nothing scheduled.</p>
            ) : visibleItems.length > 0 ? (
              <div className="space-y-1">
                {visibleItems.map(item => <ItemChip key={item.id} item={item} onClick={onItemClick} />)}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
