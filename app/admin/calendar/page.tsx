'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DateInput from '../../components/DateInput'
import CalendarGrid from '../../components/calendar/CalendarGrid'
import CalendarViewSwitcher from '../../components/calendar/CalendarViewSwitcher'
import { CalendarFilterBar, CalendarFilterSection } from '../../components/calendar/CalendarFilterBar'
import { computeViewRange, type CalendarViewMode } from '../../../lib/calendarViewRange'
import { EVENT_AUDIENCES, audienceLabelForRoles } from '../../../lib/eventAudience'
import type { CalendarItem as RawCalendarItem } from '../../../lib/calendarFeed'

type CalendarItem = Omit<RawCalendarItem, 'date' | 'endDate'> & { date: Date; endDate?: Date }
type PatientOption = { id: string; firstName: string; lastName: string; accountNumber?: string | null }
type AdminCalendarViewMode = 'global' | 'patient'

const CATEGORIES = [
  { value: 'tax',        label: '🧾 Tax Deadline' },
  { value: 'renewal',   label: '📄 Renewal' },
  { value: 'compliance',label: '✅ Compliance' },
  { value: 'general',   label: '📅 General' },
]
// Global View categories (admin-authored broadcasts) plus every category a
// patient-scoped feed can carry — merged so whichever mode is active, the
// Category filter pills render a friendly label instead of a raw key.
const CATEGORY_LABEL: Record<string, string> = {
  ...Object.fromEntries(CATEGORIES.map(c => [c.value, c.label])),
  shift: 'Shifts',
  appointment: 'Appointments',
  medication: 'Medication Refills',
  priorAuth: 'Prior Auth Expirations',
  document: 'Document Expirations',
  progressNote: 'Progress Notes',
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// Repurposed "adCalendar" — same CalendarGrid/view-switcher every role's
// myCalendar uses. Two modes now, picked via the dropdown below:
// - Global View (default, unchanged): the management view this page always
//   was — GET /api/admin/calendar with no ?patientId= returns every
//   GlobalEvent regardless of audience, since the admin authoring them
//   needs to see & manage all four layers, not just their own role's.
// - Patient View: the exact same GET but with ?patientId= set, which
//   returns that one patient's real calendar feed (shifts, appointments,
//   meds, etc.) via getPatientCalendarFeed — the same data any nurse/family
//   member linked to that patient would see. Meant as a troubleshooting
//   lens (support tickets, "why isn't my appointment showing") rather than
//   a full second operational calendar — it's read-only here; editing still
//   happens through the patient's own Schedule/Appointment pages.
export default function AdminCalendarPage() {
  const router = useRouter()
  const [view, setView] = useState<CalendarViewMode>('month')
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [calendarViewMode, setCalendarViewMode] = useState<AdminCalendarViewMode>('global')
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState('')

  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedTypes, setSelectedTypes] = useState<Set<string> | null>(null)
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', eventDate: '', allDay: true, eventTime: '',
    category: 'general',
    audienceIndex: 3, // 'All Users'
    recurrence: '',
  })

  function openNewEventForm() {
    setEditingId(null)
    setForm({ title: '', description: '', eventDate: '', allDay: true, eventTime: '', category: 'general', audienceIndex: 3, recurrence: '' })
    setShowForm(true)
  }

  // Reads back a stored eventDate using the browser's own local getters —
  // correct because eventDate is always stored as an Eastern-anchored
  // instant (easternMidnightUtc/easternTimeOfDayUtc) and this app assumes
  // an Eastern-local viewer, same as every other date/time convention here.
  function openEditEventForm(item: CalendarItem) {
    const d = item.date
    const dateKeyStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    const audienceIndex = EVENT_AUDIENCES.findIndex(a =>
      a.targetRoles.length === (item.targetRoles || []).length &&
      a.targetRoles.every(r => (item.targetRoles || []).includes(r))
    )
    setEditingId(item.id)
    setForm({
      title: item.title,
      description: item.description || '',
      eventDate: dateKeyStr,
      allDay: item.allDay !== false,
      eventTime: timeStr,
      category: item.category,
      audienceIndex: audienceIndex >= 0 ? audienceIndex : 3,
      recurrence: item.recurrence || '',
    })
    setSelectedItem(null)
    setShowForm(true)
  }

  // Patient list is only needed once admin actually switches to Patient
  // View — no reason to pull every patient on a page load that's staying
  // in Global View, the common case.
  useEffect(() => {
    if (calendarViewMode !== 'patient' || patients.length > 0) return
    fetch('/api/admin/patients', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data?.patients)) setPatients(data.patients) })
      .catch(() => {})
  }, [calendarViewMode, patients.length])

  // Escape closes whatever's on top first (the Add Event form, then the
  // event detail popup) and only falls through to "back to month" once
  // nothing else is open — so it never yanks you out of a popup unexpectedly.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (showForm) { setShowForm(false); return }
      if (selectedItem) { setSelectedItem(null); return }
      if (view !== 'month') setView('month')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showForm, selectedItem, view])

  const customRange = useMemo(() => {
    if (view !== 'custom' || !customStart || !customEnd) return undefined
    return { start: new Date(customStart), end: new Date(customEnd) }
  }, [view, customStart, customEnd])

  const range = useMemo(() => computeViewRange(view, anchorDate, customRange), [view, anchorDate, customRange])

  const load = useCallback(() => {
    // Patient View with nothing picked yet has nothing to fetch — show the
    // picker prompt instead of hitting the API with a meaningless request.
    if (calendarViewMode === 'patient' && !selectedPatientId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ start: range.start.toISOString(), end: range.end.toISOString() })
    if (calendarViewMode === 'patient' && selectedPatientId) params.set('patientId', selectedPatientId)
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
  }, [range.start, range.end, router, calendarViewMode, selectedPatientId])

  useEffect(() => { load() }, [load])

  const presentTypes = useMemo(() => Array.from(new Set(items.map(i => i.category))), [items])

  function matchesFilters(item: CalendarItem): boolean {
    if (selectedTypes && !selectedTypes.has(item.category)) return false
    return true
  }

  const visibleItems = useMemo(() => items.filter(matchesFilters), [items, selectedTypes])

  const filtersActive = selectedTypes !== null

  function clearFilters() {
    setSelectedTypes(null)
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
    const url = editingId ? `/api/admin/events/${editingId}` : '/api/admin/events'
    const res = await fetch(url, {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        eventDate: form.eventDate,
        allDay: form.allDay,
        eventTime: form.eventTime,
        category: form.category,
        targetRoles: EVENT_AUDIENCES[form.audienceIndex].targetRoles,
        recurrence: form.recurrence || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setEditingId(null)
      setForm({ title: '', description: '', eventDate: '', allDay: true, eventTime: '', category: 'general', audienceIndex: 3, recurrence: '' })
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
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <Link href="/admin" className="text-[#7A8F79] hover:text-[#2F3E4E] text-sm">← Admin</Link>
          <div>
            <h1 className="text-3xl font-bold text-[#2F3E4E]"><span className="text-[#7A8F79] italic">ad</span>Calendar</h1>
            <p className="text-xs text-[#7A8F79] mt-0.5">
              {calendarViewMode === 'global'
                ? 'Every event you’ve created, across every audience.'
                : 'What a nurse or family member linked to this patient actually sees — for troubleshooting only.'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <select
              value={calendarViewMode}
              onChange={e => {
                const mode = e.target.value as AdminCalendarViewMode
                setCalendarViewMode(mode)
                setShowForm(false)
                setSelectedItem(null)
              }}
              className="h-[34px] border border-[#D9E1E8] rounded-lg px-2 text-sm font-semibold text-[#2F3E4E] bg-white focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            >
              <option value="global">Global View</option>
              <option value="patient">Patient View</option>
            </select>
            {calendarViewMode === 'global' && (
              <button
                onClick={() => { if (showForm) { setShowForm(false) } else { openNewEventForm() } }}
                className="bg-[#2F3E4E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition"
              >
                {showForm ? 'Cancel' : '+ Add Event'}
              </button>
            )}
          </div>
        </div>

        {calendarViewMode === 'global' && showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 mb-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79]">{editingId ? 'Edit Event' : 'New Event'}</h2>

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
                <label className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#2F3E4E]">
                  <input
                    type="checkbox"
                    checked={form.allDay}
                    onChange={e => setForm({ ...form, allDay: e.target.checked })}
                    className="rounded border-[#D9E1E8]"
                  />
                  All day event
                </label>
                {!form.allDay && (
                  <div className="mt-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Time</label>
                    <input
                      type="time" required={!form.allDay} value={form.eventTime}
                      onChange={e => setForm({ ...form, eventTime: e.target.value })}
                      className="w-full h-[34px] border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                    />
                  </div>
                )}
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
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Event'}
            </button>
          </form>
        )}

        {(calendarViewMode === 'patient' || presentTypes.length > 0) && (
          <CalendarFilterBar
            trailing={filtersActive && (
              <button onClick={clearFilters} className="text-[11px] font-semibold text-[#7A8F79] hover:text-[#2F3E4E] underline">
                Clear Filters
              </button>
            )}
          >
            {calendarViewMode === 'patient' && (
              <CalendarFilterSection label="Patient">
                <select
                  value={selectedPatientId}
                  onChange={e => setSelectedPatientId(e.target.value)}
                  className="h-[30px] w-64 border border-[#D9E1E8] rounded-lg px-2 text-xs text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                >
                  <option value="">— Select a patient —</option>
                  {[...patients].sort((a, b) => a.lastName.localeCompare(b.lastName)).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}{p.accountNumber ? ` · ${p.accountNumber}` : ''}
                    </option>
                  ))}
                </select>
              </CalendarFilterSection>
            )}
            {presentTypes.length > 0 && (
              <CalendarFilterSection label="Category">
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
              </CalendarFilterSection>
            )}
          </CalendarFilterBar>
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

        {calendarViewMode === 'patient' && !selectedPatientId ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-sm text-[#7A8F79]">Select a patient above to see what their nurse/family calendar looks like.</p>
          </div>
        ) : loading ? (
          <p className="text-[#7A8F79] text-sm">Loading…</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <CalendarGrid
              items={visibleItems}
              view={view}
              anchorDate={anchorDate}
              customRange={customRange}
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
            {selectedItem.patientName && <p className="text-sm text-[#2F3E4E] mt-1">{selectedItem.patientName}</p>}
            <p className="text-sm text-[#7A8F79] mt-1">
              {fmtDate(selectedItem.date)}{!selectedItem.allDay && ` · ${fmtTime(selectedItem.date)}`}
              {selectedItem.endDate && !selectedItem.allDay && ` – ${fmtTime(selectedItem.endDate)}`}
            </p>
            {selectedItem.description && <p className="text-sm text-[#7A8F79] mt-2">{selectedItem.description}</p>}
            {selectedItem.source === 'globalEvent' && (
              <p className="text-[10px] uppercase tracking-wide font-semibold text-[#7A8F79] mt-2">
                Audience: {audienceLabelForRoles(selectedItem.targetRoles || [])}
              </p>
            )}
            {selectedItem.status && (
              <p className="text-[10px] uppercase tracking-wide font-semibold text-[#7A8F79] mt-2">{selectedItem.status.replace('_', ' ')}</p>
            )}
            <div className="flex items-center justify-end gap-2 mt-5">
              {selectedItem.source === 'globalEvent' && (
                <button onClick={() => openEditEventForm(selectedItem)} className="border border-[#D9E1E8] text-[#2F3E4E] text-sm font-semibold px-4 py-2 rounded-xl hover:border-[#7A8F79] transition">
                  Edit
                </button>
              )}
              {selectedItem.source === 'globalEvent' && (
                <button onClick={() => deleteEvent(selectedItem.id)} disabled={deleting} className="border border-red-300 text-red-500 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-red-50 transition disabled:opacity-50">
                  {deleting ? 'Deleting…' : 'Delete'}
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
