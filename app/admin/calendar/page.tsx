'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DateInput from '../../components/DateInput'
import CalendarGrid from '../../components/calendar/CalendarGrid'
import CalendarViewSwitcher from '../../components/calendar/CalendarViewSwitcher'
import { computeViewRange, dateKey, type CalendarViewMode } from '../../../lib/calendarViewRange'
import { EVENT_AUDIENCES, audienceLabelForRoles } from '../../../lib/eventAudience'
import type { CalendarItem as RawCalendarItem } from '../../../lib/calendarFeed'

type CalendarItem = Omit<RawCalendarItem, 'date' | 'endDate'> & { date: Date; endDate?: Date }

const CATEGORIES = [
  { value: 'tax',        label: '🧾 Tax Deadline' },
  { value: 'renewal',   label: '📄 Renewal' },
  { value: 'compliance',label: '✅ Compliance' },
  { value: 'general',   label: '📅 General' },
]
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// Repurposed "adCalendar" — same CalendarGrid/view-switcher every role's
// myCalendar uses, but as a management view: this GET (/api/admin/calendar
// with no ?patientId=) returns every GlobalEvent regardless of audience,
// since the admin authoring them needs to see & manage all four layers, not
// just the ones targeted at their own role. Creating an event now picks an
// Audience (lib/eventAudience.ts) instead of raw role checkboxes — same
// targetRoles field underneath, just a friendlier mapping.
export default function AdminCalendarPage() {
  const router = useRouter()
  const [view, setView] = useState<CalendarViewMode>('month')
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedTypes, setSelectedTypes] = useState<Set<string> | null>(null)
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', eventDate: '', category: 'general',
    audienceIndex: 3, // 'All Users'
    recurrence: '',
  })

  const customRange = useMemo(() => {
    if (view !== 'custom' || !customStart || !customEnd) return undefined
    return { start: new Date(customStart), end: new Date(customEnd) }
  }, [view, customStart, customEnd])

  const range = useMemo(() => computeViewRange(view, anchorDate, customRange), [view, anchorDate, customRange])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ start: range.start.toISOString(), end: range.end.toISOString() })
    return fetch(`/api/admin/calendar?${params}`, { credentials: 'include' })
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

  const presentTypes = useMemo(() => Array.from(new Set(items.map(i => i.category))), [items])

  function matchesFilters(item: CalendarItem): boolean {
    if (selectedTypes && !selectedTypes.has(item.category)) return false
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

  const filtersActive = selectedTypes !== null
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        eventDate: form.eventDate,
        category: form.category,
        targetRoles: EVENT_AUDIENCES[form.audienceIndex].targetRoles,
        recurrence: form.recurrence || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setForm({ title: '', description: '', eventDate: '', category: 'general', audienceIndex: 3, recurrence: '' })
      setShowForm(false)
      load()
    }
  }

  async function deleteEvent(id: string) {
    setDeleting(true)
    await fetch(`/api/admin/events/${id}`, { method: 'DELETE', credentials: 'include' })
    setDeleting(false)
    setSelectedItem(null)
    load()
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <Link href="/admin" className="text-[#7A8F79] hover:text-[#2F3E4E] text-sm">← Admin</Link>
          <div>
            <h1 className="text-3xl font-bold text-[#2F3E4E]"><span className="text-[#7A8F79] italic">ad</span>Calendar</h1>
            <p className="text-xs text-[#7A8F79] mt-0.5">Every event you’ve created, across every audience.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="ml-auto bg-[#2F3E4E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition"
          >
            {showForm ? 'Cancel' : '+ Add Event'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 mb-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79]">New Event</h2>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Title</label>
              <input
                type="text" required value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Q2 Estimated Tax Payment Due"
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Date</label>
                <DateInput
                  required value={form.eventDate}
                  onChange={e => setForm({ ...form, eventDate: e.target.value })}
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Description (optional)</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-2">Audience</label>
              <div className="flex flex-wrap gap-2">
                {EVENT_AUDIENCES.map((a, i) => (
                  <button
                    key={a.label} type="button"
                    onClick={() => setForm({ ...form, audienceIndex: i })}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      form.audienceIndex === i
                        ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]'
                        : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Recurrence</label>
              <select
                value={form.recurrence}
                onChange={e => setForm({ ...form, recurrence: e.target.value })}
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              >
                <option value="">One-time</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>

            <button
              type="submit" disabled={saving}
              className="w-full bg-[#7A8F79] text-white py-2 rounded-lg font-semibold text-sm hover:bg-[#657a64] transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Event'}
            </button>
          </form>
        )}

        <CalendarViewSwitcher
          view={view}
          onViewChange={setView}
          anchorDate={anchorDate}
          onAnchorChange={setAnchorDate}
          customStart={customStart}
          customEnd={customEnd}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
          rangeLabel={
            view === 'month'
              ? anchorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              : `${range.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${range.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          }
        />

        {presentTypes.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-3 mb-4 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide font-bold text-[#7A8F79] mr-1">Category</span>
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
        )}

        {loading ? (
          <p className="text-[#7A8F79] text-sm">Loading…</p>
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

      {selectedItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setSelectedItem(null)}>
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <p className="text-lg font-bold text-[#2F3E4E]">{selectedItem.title}</p>
            <p className="text-sm text-[#7A8F79] mt-1">{fmtDate(selectedItem.date)} · {fmtTime(selectedItem.date)}</p>
            {selectedItem.description && <p className="text-sm text-[#7A8F79] mt-2">{selectedItem.description}</p>}
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[#7A8F79] mt-2">
              Audience: {audienceLabelForRoles(selectedItem.targetRoles || [])}
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => deleteEvent(selectedItem.id)} disabled={deleting} className="border border-red-300 text-red-500 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-red-50 transition disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
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
