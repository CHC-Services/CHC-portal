'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CalendarGrid from '../../components/calendar/CalendarGrid'
import { computeViewRange, shiftAnchor, dateKey, type CalendarViewMode } from '../../../lib/calendarViewRange'
import type { CalendarItem as RawCalendarItem } from '../../../lib/calendarFeed'

type CalendarItem = Omit<RawCalendarItem, 'date' | 'endDate'> & { date: Date; endDate?: Date }

const VIEW_LABEL: Record<CalendarViewMode, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  lookahead: '14-Day',
  custom: 'Custom',
}

const CATEGORY_LABEL: Record<string, string> = {
  shift: 'Shifts',
  appointment: 'Appointments',
  globalEvent: 'Announcements',
  personalReminder: 'My Reminders',
  medication: 'Medication Refills',
  priorAuth: 'Prior Auth Expirations',
  claimReminder: 'Claim Reminders',
  document: 'Document Expirations',
  progressNote: 'Progress Notes',
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function NurseCalendarPage() {
  const router = useRouter()
  const [view, setView] = useState<CalendarViewMode>('month')
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedTypes, setSelectedTypes] = useState<Set<string> | null>(null) // null = all
  const [notesFilter, setNotesFilter] = useState<'all' | 'with' | 'without'>('all')

  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  const customRange = useMemo(() => {
    if (view !== 'custom' || !customStart || !customEnd) return undefined
    return { start: new Date(customStart), end: new Date(customEnd) }
  }, [view, customStart, customEnd])

  const range = useMemo(() => computeViewRange(view, anchorDate, customRange), [view, anchorDate, customRange])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ start: range.start.toISOString(), end: range.end.toISOString() })
    return fetch(`/api/nurse/calendar?${params}`, { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null }
        return r.json()
      })
      .then(data => {
        if (!data) return
        const parsed: CalendarItem[] = (data.items || []).map((i: RawCalendarItem) => ({
          ...i,
          date: new Date(i.date),
          endDate: i.endDate ? new Date(i.endDate) : undefined,
        }))
        setItems(parsed)
      })
      .finally(() => setLoading(false))
  }, [range.start, range.end, router])

  useEffect(() => { load() }, [load])

  const presentTypes = useMemo(() => {
    const s = new Set(items.map(i => i.category))
    return Array.from(s)
  }, [items])

  function matchesFilters(item: CalendarItem): boolean {
    if (selectedTypes && !selectedTypes.has(item.category)) return false
    if (notesFilter !== 'all' && item.source === 'shift') {
      const has = !!item.hasProgressNotes
      if (notesFilter === 'with' && !has) return false
      if (notesFilter === 'without' && has) return false
    }
    return true
  }

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const item of items) {
      const key = dateKey(item.date)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return map
  }, [items])

  const filtersActive = (selectedTypes !== null) || notesFilter !== 'all'
  function isGreyedOut(key: string) {
    if (!filtersActive) return false
    const dayItems = byDay.get(key)
    if (!dayItems || dayItems.length === 0) return false
    return !dayItems.some(matchesFilters)
  }

  function toggleType(cat: string) {
    setSelectedTypes(prev => {
      const base = prev ?? new Set(presentTypes)
      const next = new Set(base)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  async function claimShift(id: string) {
    setActionBusy(true)
    const res = await fetch(`/api/nurse/shifts/${id}/claim`, { method: 'POST', credentials: 'include' })
    setActionBusy(false)
    if (res.ok) { setSelectedItem(null); load() }
  }
  async function releaseShift(id: string) {
    setActionBusy(true)
    const res = await fetch(`/api/nurse/shifts/${id}/release`, { method: 'POST', credentials: 'include' })
    setActionBusy(false)
    if (res.ok) { setSelectedItem(null); load() }
  }

  const isClaimableShift = selectedItem?.source === 'shift' && (selectedItem.status === 'open' || selectedItem.status === 'coverage_needed')
  const isMyAssignedShift = selectedItem?.source === 'shift' && selectedItem.status === 'assigned' && selectedItem.editable

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="max-w-5xl mx-auto">

        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-[#2F3E4E]">
              <span className="text-[#7A8F79] italic">my</span>Calendar
            </h1>
            <p className="text-sm text-[#7A8F79] mt-1">
              Your shifts, appointments, and deadlines across every patient.
            </p>
          </div>
          <Link href="/nurse/profile" className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
            + Add Personal Reminder →
          </Link>
        </div>

        {/* View mode switcher + navigation */}
        <div className="bg-white rounded-xl shadow-sm p-3 mb-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1 flex-wrap">
            {(Object.keys(VIEW_LABEL) as CalendarViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
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
              <input type="date" className="border border-[#D9E1E8] p-1.5 rounded-lg text-xs" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span className="text-[#7A8F79]">to</span>
              <input type="date" className="border border-[#D9E1E8] p-1.5 rounded-lg text-xs" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setAnchorDate(d => shiftAnchor(view, d, -1))} className="w-7 h-7 rounded-full bg-[#F4F6F5] text-[#2F3E4E] hover:bg-[#D9E1E8] transition text-sm font-bold">‹</button>
              <button onClick={() => setAnchorDate(new Date())} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition px-2">Today</button>
              <button onClick={() => setAnchorDate(d => shiftAnchor(view, d, 1))} className="w-7 h-7 rounded-full bg-[#F4F6F5] text-[#2F3E4E] hover:bg-[#D9E1E8] transition text-sm font-bold">›</button>
              <span className="text-sm font-semibold text-[#2F3E4E] ml-1">
                {view === 'month'
                  ? anchorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  : `${range.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${range.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </span>
            </div>
          )}
        </div>

        {/* Filters */}
        {presentTypes.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-3 mb-4 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase tracking-wide font-bold text-[#7A8F79] mr-1">Type</span>
              {presentTypes.map(cat => {
                const active = selectedTypes === null || selectedTypes.has(cat)
                return (
                  <button
                    key={cat}
                    onClick={() => toggleType(cat)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition border ${
                      active ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] opacity-60'
                    }`}
                  >
                    {CATEGORY_LABEL[cat] || cat}
                  </button>
                )
              })}
              {selectedTypes !== null && (
                <button onClick={() => setSelectedTypes(null)} className="text-[11px] text-[#7A8F79] hover:text-[#2F3E4E] underline ml-1">Reset</button>
              )}
            </div>
            {presentTypes.includes('shift') && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wide font-bold text-[#7A8F79] mr-1">Progress Notes</span>
                {(['all', 'with', 'without'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setNotesFilter(f)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                      notesFilter === f ? 'bg-[#7A8F79] text-white' : 'bg-[#F4F6F5] text-[#7A8F79] hover:bg-[#D9E1E8]'
                    }`}
                  >
                    {f === 'all' ? 'All Shifts' : f === 'with' ? 'Has Notes' : 'No Notes'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <p className="text-[#7A8F79] text-sm">Loading your calendar…</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <CalendarGrid
              items={items}
              view={view}
              anchorDate={anchorDate}
              customRange={customRange}
              isGreyedOut={isGreyedOut}
              onItemClick={(item) => setSelectedItem(item as CalendarItem)}
              onDayClick={(day) => { if (view === 'month') { setAnchorDate(day); setView('day') } }}
            />
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setSelectedItem(null)}>
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <p className="text-lg font-bold text-[#2F3E4E]">{selectedItem.title}</p>
            {selectedItem.patientName && <p className="text-sm text-[#2F3E4E] mt-1">{selectedItem.patientName}</p>}
            <p className="text-sm text-[#7A8F79] mt-1">
              {fmtDate(selectedItem.date)} · {fmtTime(selectedItem.date)}
              {selectedItem.endDate && ` – ${fmtTime(selectedItem.endDate)}`}
            </p>
            {selectedItem.description && <p className="text-sm text-[#7A8F79] mt-2">{selectedItem.description}</p>}
            {selectedItem.status && (
              <p className="text-[10px] uppercase tracking-wide font-semibold text-[#7A8F79] mt-2">{selectedItem.status.replace('_', ' ')}</p>
            )}

            <div className="flex items-center justify-end gap-2 mt-5">
              {isClaimableShift && (
                <button onClick={() => claimShift(selectedItem.id)} disabled={actionBusy} className="bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#7A8F79] transition disabled:opacity-50">
                  {actionBusy ? 'Claiming…' : 'Claim Shift'}
                </button>
              )}
              {isMyAssignedShift && (
                <button onClick={() => releaseShift(selectedItem.id)} disabled={actionBusy} className="border border-amber-300 text-amber-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-amber-50 transition disabled:opacity-50">
                  {actionBusy ? 'Releasing…' : 'Release'}
                </button>
              )}
              <button onClick={() => setSelectedItem(null)} className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] px-4 py-2 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
