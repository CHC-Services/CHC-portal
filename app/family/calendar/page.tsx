'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CalendarGrid from '../../components/calendar/CalendarGrid'
import CalendarViewSwitcher from '../../components/calendar/CalendarViewSwitcher'
import AppointmentForm from '../../components/patient/AppointmentForm'
import { computeViewRange, dateKey, type CalendarViewMode } from '../../../lib/calendarViewRange'
import type { CalendarItem as RawCalendarItem } from '../../../lib/calendarFeed'

type PatientOption = { id: string; firstName: string; lastName: string }

type CalendarItem = Omit<RawCalendarItem, 'date' | 'endDate'> & { date: Date; endDate?: Date }

const CATEGORY_LABEL: Record<string, string> = {
  shift: 'Shifts',
  appointment: 'Appointments',
  globalEvent: 'Announcements',
  medication: 'Medication Refills',
  priorAuth: 'Prior Auth Expirations',
  document: 'Document Expirations',
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function FamilyCalendarPage() {
  const router = useRouter()
  const [view, setView] = useState<CalendarViewMode>('month')
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedTypes, setSelectedTypes] = useState<Set<string> | null>(null)
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)

  const [patients, setPatients] = useState<PatientOption[]>([])
  const [showAddAppt, setShowAddAppt] = useState(false)
  const [apptPatientId, setApptPatientId] = useState('')

  useEffect(() => {
    fetch('/api/family/patients', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.patients) setPatients(data.patients) })
      .catch(() => {})
  }, [])

  const customRange = useMemo(() => {
    if (view !== 'custom' || !customStart || !customEnd) return undefined
    return { start: new Date(customStart), end: new Date(customEnd) }
  }, [view, customStart, customEnd])

  const range = useMemo(() => computeViewRange(view, anchorDate, customRange), [view, anchorDate, customRange])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ start: range.start.toISOString(), end: range.end.toISOString() })
    return fetch(`/api/family/calendar?${params}`, { credentials: 'include' })
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

  const manageHref = selectedItem?.patientId && selectedItem.source === 'shift' ? `/patient/${selectedItem.patientId}/schedule`
    : selectedItem?.patientId && selectedItem.source === 'appointment' ? `/patient/${selectedItem.patientId}/appointment`
    : null

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
      <div className="max-w-5xl">

        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-[#2F3E4E]">
              <span className="text-[#7A8F79] italic">my</span>Calendar
            </h1>
            <p className="text-sm text-[#7A8F79] mt-1">
              Shifts, appointments, and deadlines across every patient you care for.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setShowAddAppt(true)} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
              + Add Appointment
            </button>
            <Link href="/family/reminders" className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
              + Add Reminder →
            </Link>
          </div>
        </div>

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
              {manageHref && (
                <Link href={manageHref} className="bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#7A8F79] transition">
                  Manage →
                </Link>
              )}
              <button onClick={() => setSelectedItem(null)} className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] px-4 py-2 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-patient Add Appointment modal */}
      {showAddAppt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => { setShowAddAppt(false); setApptPatientId('') }}>
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-lg w-full my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-lg font-bold text-[#2F3E4E]">Add Appointment</p>
              <button onClick={() => { setShowAddAppt(false); setApptPatientId('') }} className="text-[#7A8F79] hover:text-[#2F3E4E] text-sm font-semibold transition">Close</button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Patient</label>
              <select
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                value={apptPatientId}
                onChange={e => setApptPatientId(e.target.value)}
              >
                <option value="">— Select a patient —</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </select>
            </div>
            {apptPatientId && (
              <AppointmentForm
                patientId={apptPatientId}
                onCreated={() => { setShowAddAppt(false); setApptPatientId(''); load() }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
