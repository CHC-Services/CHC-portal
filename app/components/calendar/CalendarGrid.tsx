'use client'

import { useEffect, useRef, useState } from 'react'
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

// "11:00 PM" -> "11PM" (no ":00", no space) when the shift starts on the
// hour — an on-the-hour time is the common case and doesn't need the extra
// characters; a non-zero minute still gets the normal spaced format.
function fmtTimeCompact(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

// Same idea as fmtTimeCompact but a single-letter suffix and no space at
// all, for the claimed-shift "7p-7a: Alex" range label — a tighter format
// than fmtTimeCompact's "7PM" since two of these appear back to back.
function fmtTimeTiny(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'p' : 'a'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, '0')}${period}`
}

// Claimed shifts ('assigned'/'completed') read as a start-stop time range
// plus the covering nurse's first name ("7p-7a: Alex") instead of a generic
// "Shift" label — nurseName is only populated on feeds that show multiple
// nurses' shifts (admin/family/patient-scoped calendars); the nurse's own
// calendar never sets it, so this falls back to just the range there, which
// is correct since every shift on that view is already known to be hers.
// Open/coverage-needed shifts keep their category label, just with a
// compact time prefix instead of the old "11:00 PM Open Shift".
function shiftChipLabel(item: CalendarItem): string {
  const isClaimed = item.status === 'assigned' || item.status === 'completed'
  if (isClaimed) {
    const start = fmtTimeTiny(item.date)
    const range = item.endDate ? `${start}-${fmtTimeTiny(item.endDate)}` : start
    const firstName = item.nurseName?.split(' ')[0]
    return firstName ? `${range}: ${firstName}` : range
  }
  return `${fmtTimeCompact(item.date)} ${item.title}`
}

function isOpenShift(item: CalendarItem): boolean {
  return item.category === 'shift' && item.status !== 'assigned' && item.status !== 'completed'
}

// Flat mode's text-only color — same red/green semantic split chipClass
// uses for shift backgrounds, just without the pill behind it.
function chipTextColorClass(item: CalendarItem): string {
  if (item.category === 'shift') {
    return item.status === 'assigned' || item.status === 'completed' ? 'text-green-700' : 'text-red-700'
  }
  return 'text-[#2F3E4E]'
}

// flat=true drops the solid colored pill and just renders colored text —
// used on the month view for open/coverage-needed shifts (Alex's request:
// only genuinely all-day items should get a solid background block there).
function ItemChip({ item, onClick, flat }: { item: CalendarItem; onClick?: (item: CalendarItem) => void; flat?: boolean }) {
  const label = item.category === 'shift' ? shiftChipLabel(item) : `${item.allDay ? '' : `${fmtTime(item.date)} `}${item.title}`
  const tooltip = `${item.allDay ? '' : `${fmtTime(item.date)} — `}${item.title}${item.patientName ? ` (${item.patientName})` : ''}`
  if (flat) {
    return (
      <button
        type="button"
        onClick={() => onClick?.(item)}
        className={`w-full text-left text-[10px] leading-tight px-0.5 py-0.5 truncate font-semibold ${chipTextColorClass(item)} hover:opacity-70 transition`}
        title={tooltip}
      >
        {label}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onClick?.(item)}
      className={`w-full text-left text-[10px] leading-tight px-1.5 py-0.5 rounded truncate ${chipClass(item)} hover:opacity-80 transition`}
      title={tooltip}
    >
      {label}
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

// All-day items (single-day ones — the multi-day spanning kind never reach
// this list, see isSpanningAllDay below) lead each day's event-line list,
// ahead of timed items. Doesn't apply to medication/progressNote items —
// COMPACT_ONLY_CATEGORIES already pulls those out into a corner badge before
// this ever runs, so they're never in the event-line list to begin with.
// Stable sort, so same-allDay-ness items keep their existing relative order.
function sortAllDayFirst(items: CalendarItem[]): CalendarItem[] {
  return [...items].sort((a, b) => (a.allDay ? 0 : 1) - (b.allDay ? 0 : 1))
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

// Hourly Day view (an opt-in toggle alongside the default Summary agenda
// list — see the `dayLayout` state below). A real hour-by-hour timeline: 60
// timed-event minimum, so a short item is still clickable), and overlapping
// events share width side-by-side rather than stacking on top of each other.
const HOUR_PX = 48
const MIN_EVENT_PX = 20

function timedItemsForHourly(dayItems: CalendarItem[]): CalendarItem[] {
  return dayItems.filter(i => !i.allDay)
}

// Greedy column assignment within connected clusters of mutually-overlapping
// events — two events in different, non-overlapping clusters elsewhere in
// the day don't force each other's width down, only genuinely concurrent
// events do.
function assignOverlapColumns(items: CalendarItem[]): Map<string, { col: number; cols: number }> {
  const sorted = [...items].sort((a, b) => a.date.getTime() - b.date.getTime())
  const result = new Map<string, { col: number; cols: number }>()

  let clusterItems: CalendarItem[] = []
  let clusterEnd = -Infinity

  function flushCluster() {
    if (clusterItems.length === 0) return
    const colEnds: number[] = [] // end time (ms) currently occupied in each column
    const colOf = new Map<string, number>()
    for (const item of clusterItems) {
      const start = item.date.getTime()
      const end = (item.endDate ?? new Date(item.date.getTime() + 30 * 60_000)).getTime()
      let placed = false
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= start) { colEnds[c] = end; colOf.set(item.id, c); placed = true; break }
      }
      if (!placed) { colEnds.push(end); colOf.set(item.id, colEnds.length - 1) }
    }
    const cols = colEnds.length
    for (const item of clusterItems) result.set(item.id, { col: colOf.get(item.id)!, cols })
    clusterItems = []
  }

  for (const item of sorted) {
    const start = item.date.getTime()
    const end = (item.endDate ?? new Date(item.date.getTime() + 30 * 60_000)).getTime()
    if (clusterItems.length > 0 && start >= clusterEnd) flushCluster()
    clusterItems.push(item)
    clusterEnd = clusterItems.length === 1 ? end : Math.max(clusterEnd, end)
  }
  flushCluster()

  return result
}

function HourlyDay({ day, dayItems, onItemClick, onDayClick }: {
  day: Date
  dayItems: CalendarItem[]
  onItemClick?: (item: CalendarItem) => void
  onDayClick?: (day: Date) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000)

  const allDayItems = dayItems.filter(i => i.allDay)
  const timed = timedItemsForHourly(dayItems)
  const columns = assignOverlapColumns(timed)

  // Land somewhere useful instead of at midnight — the earliest event's hour
  // (clamped to a sensible morning start) if there is one, else 6 AM.
  useEffect(() => {
    if (!scrollRef.current) return
    const earliestHour = timed.length
      ? Math.max(0, Math.min(...timed.map(i => i.date.getHours())) - 1)
      : 6
    scrollRef.current.scrollTop = earliestHour * HOUR_PX
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey(day)])

  return (
    <div className="border border-[#D9E1E8] rounded-xl overflow-hidden">
      {/* All-day section — its own strip, connected directly above the
          hourly grid (just above the 12:00 AM row), not part of the scroll. */}
      <div className="bg-[#F4F6F5] border-b border-[#D9E1E8] p-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] mb-1">All Day</p>
        {allDayItems.length === 0 ? (
          <p className="text-[11px] text-[#7A8F79] italic">Nothing all-day.</p>
        ) : (
          <div className="space-y-0.5">
            {allDayItems.map(item => <ItemChip key={item.id} item={item} onClick={onItemClick} />)}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="relative overflow-y-auto" style={{ maxHeight: HOUR_PX * 14 }}>
        <div className="relative" style={{ height: HOUR_PX * 24 }}>
          {Array.from({ length: 24 }).map((_, h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-[#F0F2F1] flex"
              style={{ top: h * HOUR_PX, height: HOUR_PX }}
            >
              <span className="w-12 shrink-0 text-right pr-2 text-[10px] text-[#7A8F79] -translate-y-1/2 mt-0">
                {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
              </span>
              <button
                type="button"
                onClick={() => onDayClick?.(day)}
                className="flex-1 h-full hover:bg-[#F4F6F5]/60 transition"
              />
            </div>
          ))}
          <div className="absolute left-12 right-0 top-0 bottom-0">
            {timed.map(item => {
              const start = item.date < dayStart ? dayStart : item.date
              const rawEnd = item.endDate ?? new Date(item.date.getTime() + 30 * 60_000)
              const end = rawEnd > dayEnd ? dayEnd : rawEnd
              const top = ((start.getTime() - dayStart.getTime()) / 3_600_000) * HOUR_PX
              const height = Math.max(((end.getTime() - start.getTime()) / 3_600_000) * HOUR_PX, MIN_EVENT_PX)
              const placement = columns.get(item.id) || { col: 0, cols: 1 }
              const widthPct = 100 / placement.cols
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onItemClick?.(item)}
                  title={`${fmtTime(item.date)} — ${item.title}${item.patientName ? ` (${item.patientName})` : ''}`}
                  className={`absolute text-left text-[10px] leading-tight px-1.5 py-0.5 rounded truncate ${chipClass(item)} hover:opacity-80 transition border border-white/60`}
                  style={{
                    top, height,
                    left: `calc(${placement.col * widthPct}% + 2px)`,
                    width: `calc(${widthPct}% - 4px)`,
                  }}
                >
                  {item.category === 'shift' ? shiftChipLabel(item) : `${fmtTime(item.date)} ${item.title}`}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function DayLayoutToggle({ dayLayout, onChange }: { dayLayout: 'summary' | 'hourly'; onChange: (v: 'summary' | 'hourly') => void }) {
  return (
    <div className="flex gap-1.5">
      {(['summary', 'hourly'] as const).map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize transition ${
            dayLayout === v ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

export default function CalendarGrid({
  items,
  view,
  anchorDate,
  customRange,
  onItemClick,
  onDayClick,
}: {
  items: CalendarItem[]
  view: CalendarViewMode
  anchorDate: Date
  customRange?: { start: Date; end: Date }
  onItemClick?: (item: CalendarItem) => void
  onDayClick?: (day: Date) => void
}) {
  const byDay = groupByDay(items)
  const today = dateKey(new Date())
  // Day-view-only toggle between the default Summary agenda list and a real
  // hour-by-hour timeline — internal to this component since no page needs
  // to know or control which one's showing.
  const [dayLayout, setDayLayout] = useState<'summary' | 'hourly'>('summary')

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
                {week.map(day => {
                  const key = dateKey(day)
                  const dayItems = (byDay.get(key) || []).filter(item => !isSpanningAllDay(item))
                  const visibleItems = sortAllDayFirst(dayItems.filter(item => !COMPACT_ONLY_CATEGORIES.has(item.category)))
                  const meds = medicationFlags(dayItems)
                  const noteCount = progressNoteCount(dayItems)
                  const inMonth = day.getMonth() === thisMonth
                  // Past days get a light fade instead of a strikethrough —
                  // a quieter, cell-level way to separate past from present.
                  const isPast = key < today
                  const isToday = key === today
                  return (
                    <div
                      key={key}
                      className={`relative min-h-[90px] border-2 rounded-lg p-1 space-y-0.5 transition ${
                        isToday ? 'border-[#D4AF37]' : 'border-[#D9E1E8]'
                      } ${isPast ? 'opacity-60' : ''} ${inMonth ? 'bg-white' : 'bg-[#F4F6F5]'}`}
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
                      <button
                        type="button"
                        onClick={() => onDayClick?.(day)}
                        className={`text-[11px] font-semibold ${inMonth ? 'text-[#2F3E4E]' : 'text-[#7A8F79]'} hover:underline`}
                      >
                        {day.getDate()}
                      </button>
                      <div className="space-y-0.5">
                        {visibleItems.slice(0, 3).map(item => <ItemChip key={item.id} item={item} onClick={onItemClick} flat={isOpenShift(item)} />)}
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

  if (view === 'day' && dayLayout === 'hourly') {
    const day = days[0]
    const dayItems = byDay.get(dateKey(day)) || []
    return (
      <div className="space-y-3">
        <DayLayoutToggle dayLayout={dayLayout} onChange={setDayLayout} />
        <HourlyDay day={day} dayItems={dayItems} onItemClick={onItemClick} onDayClick={onDayClick} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {view === 'day' && <DayLayoutToggle dayLayout={dayLayout} onChange={setDayLayout} />}
      {days.map(day => {
        const key = dateKey(day)
        const dayItems = (byDay.get(key) || []).sort((a, b) => a.date.getTime() - b.date.getTime())
        const visibleItems = sortAllDayFirst(isCompact ? dayItems.filter(item => !COMPACT_ONLY_CATEGORIES.has(item.category)) : dayItems)
        const meds = isCompact ? medicationFlags(dayItems) : { show: false, overdue: false }
        const noteCount = isCompact ? progressNoteCount(dayItems) : 0
        return (
          <div key={key} className={`border border-[#D9E1E8] rounded-xl p-3 transition ${key === today ? 'ring-2 ring-[#7A8F79]' : ''}`}>
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
