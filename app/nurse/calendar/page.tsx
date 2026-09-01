'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CalendarGrid from '../../components/calendar/CalendarGrid'
import CalendarViewSwitcher from '../../components/calendar/CalendarViewSwitcher'
import { CalendarFilterBar, CalendarFilterSection } from '../../components/calendar/CalendarFilterBar'
import AppointmentForm from '../../components/patient/AppointmentForm'
import ProgressNoteDocumentUploadModal from '../../components/patient/ProgressNoteDocumentUploadModal'
import { computeViewRange, type CalendarViewMode } from '../../../lib/calendarViewRange'
import type { CalendarItem as RawCalendarItem } from '../../../lib/calendarFeed'

type PatientOption = { id: string; firstName: string; lastName: string }

type CalendarItem = Omit<RawCalendarItem, 'date' | 'endDate'> & { date: Date; endDate?: Date }

const CATEGORY_LABEL: Record<string, string> = {
  shift: 'Shifts',
  appointment: 'Appointments',
  globalEvent: 'Announcements',
  personalReminder: 'My Reminders',
  medication: 'Medication Refills',
  priorAuth: 'Prior Auth Expirations',
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
  const [selectedPatientId, setSelectedPatientId] = useState('') // '' = all patients

  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  // "Cover a Portion" — reveals a sub-range picker inline in the same detail
  // modal instead of a separate one. claimResultMessage differs by whether
  // the patient has partialShiftClaimsRequireApproval on (see
  // app/api/nurse/shifts/[id]/claim-portion/route.ts's `pending` response).
  const [portionMode, setPortionMode] = useState(false)
  const [portionStart, setPortionStart] = useState('')
  const [portionEnd, setPortionEnd] = useState('')
  const [portionError, setPortionError] = useState('')
  const [claimResultMessage, setClaimResultMessage] = useState('')

  const [patients, setPatients] = useState<PatientOption[]>([])
  const [showAddAppt, setShowAddAppt] = useState(false)
  const [apptPatientId, setApptPatientId] = useState('')

  // Progress-note document upload — Day view only, patient picked up front
  // (unlike the per-patient calendar's version of this button, this
  // cross-patient calendar has no single patient already in scope).
  const [showUploadNote, setShowUploadNote] = useState(false)
  const [uploadPatientId, setUploadPatientId] = useState('')

  useEffect(() => {
    fetch('/api/nurse/patients', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.patients) setPatients(data.patients) })
      .catch(() => {})
  }, [])

  // Escape closes whatever's on top first (the Add Appointment modal, then
  // the event detail popup) and only falls through to "back to month" once
  // nothing else is open — so it never yanks you out of a popup unexpectedly.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (showUploadNote) { setShowUploadNote(false); setUploadPatientId(''); return }
      if (showAddAppt) { setShowAddAppt(false); setApptPatientId(''); return }
      if (selectedItem) { closeDetailModal(); setClaimResultMessage(''); return }
      if (view !== 'month') setView('month')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showUploadNote, showAddAppt, selectedItem, view])

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
    if (selectedPatientId && item.patientId !== selectedPatientId) return false
    if (notesFilter !== 'all' && item.source === 'shift') {
      const has = !!item.hasProgressNotes
      if (notesFilter === 'with' && !has) return false
      if (notesFilter === 'without' && has) return false
    }
    return true
  }

  const visibleItems = useMemo(() => items.filter(matchesFilters), [items, selectedTypes, selectedPatientId, notesFilter])

  const filtersActive = (selectedTypes !== null) || notesFilter !== 'all' || selectedPatientId !== ''

  function toggleType(cat: string) {
    setSelectedTypes(prev => {
      const base = prev ?? new Set(presentTypes)
      const next = new Set(base)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  function clearFilters() {
    setSelectedTypes(null)
    setNotesFilter('all')
    setSelectedPatientId('')
  }

  async function claimShift(id: string) {
    setActionBusy(true)
    const res = await fetch(`/api/nurse/shifts/${id}/claim`, { method: 'POST', credentials: 'include' })
    setActionBusy(false)
    if (res.ok) { closeDetailModal(); load() }
  }
  async function releaseShift(id: string) {
    setActionBusy(true)
    const res = await fetch(`/api/nurse/shifts/${id}/release`, { method: 'POST', credentials: 'include' })
    setActionBusy(false)
    if (res.ok) { closeDetailModal(); load() }
  }

  function closeDetailModal() {
    setSelectedItem(null)
    setPortionMode(false); setPortionStart(''); setPortionEnd(''); setPortionError('')
  }

  function openPortionPicker() {
    if (!selectedItem?.endDate) return
    setPortionMode(true)
    setPortionStart(toLocalInputValue(selectedItem.date))
    setPortionEnd(toLocalInputValue(selectedItem.endDate))
    setPortionError('')
  }

  async function submitPortionClaim() {
    if (!selectedItem || !portionStart || !portionEnd) return
    setPortionError('')
    setActionBusy(true)
    const res = await fetch(`/api/nurse/shifts/${selectedItem.id}/claim-portion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        start: new Date(portionStart).toISOString(),
        end: new Date(portionEnd).toISOString(),
      }),
    })
    const body = await res.json().catch(() => null)
    setActionBusy(false)
    if (!res.ok) { setPortionError(body?.error || 'Could not submit that claim.'); return }
    setPortionMode(false)
    setClaimResultMessage(
      body?.pending
        ? "Sent to the family for approval — you'll be notified once it's reviewed."
        : `You've picked up ${fmtTime(new Date(portionStart))} – ${fmtTime(new Date(portionEnd))}.`
    )
    load()
  }

  function toLocalInputValue(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setShowAddAppt(true)} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
              + Add Patient Appointment
            </button>
            <Link href="/nurse/profile" className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
              + Add Personal Reminder →
            </Link>
          </div>
        </div>

        {/* Filters */}
        {presentTypes.length > 0 && (
          <CalendarFilterBar
            trailing={filtersActive && (
              <button onClick={clearFilters} className="text-[11px] font-semibold text-[#7A8F79] hover:text-[#2F3E4E] underline">
                Clear Filters
              </button>
            )}
          >
            {patients.length > 0 && (
              <CalendarFilterSection label="Patient">
                <select
                  value={selectedPatientId}
                  onChange={e => setSelectedPatientId(e.target.value)}
                  className="h-[30px] border border-[#D9E1E8] rounded-lg px-2 text-xs text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                >
                  <option value="">All Patients</option>
                  {[...patients].sort((a, b) => a.lastName.localeCompare(b.lastName)).map(p => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              </CalendarFilterSection>
            )}
            <CalendarFilterSection label="Type">
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
            {presentTypes.includes('shift') && (
              <CalendarFilterSection label="Progress Notes">
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
              </CalendarFilterSection>
            )}
          </CalendarFilterBar>
        )}

        {/* View mode switcher + navigation */}
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

        {view === 'day' && (
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={() => setShowUploadNote(true)}
              className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition"
            >
              + Upload Progress Note
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-[#7A8F79] text-sm">Loading your calendar…</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <CalendarGrid
              items={visibleItems}
              view={view}
              anchorDate={anchorDate}
              customRange={customRange}
              onItemClick={(item) => { setSelectedItem(item as CalendarItem); setPortionMode(false); setPortionError(''); setClaimResultMessage('') }}
              onDayClick={(day) => { if (view === 'month') { setAnchorDate(day); setView('day') } }}
            />
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={closeDetailModal}>
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <p className="text-lg font-bold text-[#2F3E4E]">{selectedItem.title}</p>
            {selectedItem.patientName && <p className="text-sm text-[#2F3E4E] mt-1">{selectedItem.patientName}</p>}
            <p className="text-sm text-[#7A8F79] mt-1">
              {fmtDate(selectedItem.date)}{!selectedItem.allDay && ` · ${fmtTime(selectedItem.date)}`}
              {selectedItem.endDate && !selectedItem.allDay && ` – ${fmtTime(selectedItem.endDate)}`}
            </p>
            {selectedItem.description && <p className="text-sm text-[#7A8F79] mt-2">{selectedItem.description}</p>}
            {selectedItem.status && (
              <p className="text-[10px] uppercase tracking-wide font-semibold text-[#7A8F79] mt-2">{selectedItem.status.replace('_', ' ')}</p>
            )}

            {claimResultMessage && (
              <p className="text-xs font-semibold text-[#7A8F79] bg-[#F4F6F5] rounded-lg px-3 py-2 mt-3">{claimResultMessage}</p>
            )}

            {isClaimableShift && portionMode && (
              <div className="mt-4 space-y-2 bg-[#F4F6F5] rounded-xl p-3">
                {portionError && <p className="text-xs text-red-500 font-semibold">{portionError}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-bold text-[#7A8F79] mb-1">Start</label>
                    <input type="datetime-local" className="w-full border border-[#D9E1E8] p-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" value={portionStart} onChange={e => setPortionStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-bold text-[#7A8F79] mb-1">End</label>
                    <input type="datetime-local" className="w-full border border-[#D9E1E8] p-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" value={portionEnd} onChange={e => setPortionEnd(e.target.value)} />
                  </div>
                </div>
                <p className="text-[10px] text-[#7A8F79]">Must fall within the shift's own hours. Any leftover time stays open for another nurse.</p>
                <p className="text-[10px] font-semibold text-[#7A8F79]">
                  {selectedItem?.partialClaimRequiresApproval
                    ? "This patient requires family approval — you'll be assigned once it's reviewed, not immediately."
                    : "This will be assigned to you immediately once submitted."}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-5 flex-wrap">
              {isClaimableShift && !portionMode && (
                <>
                  <button onClick={() => claimShift(selectedItem.id)} disabled={actionBusy} className="bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#7A8F79] transition disabled:opacity-50">
                    {actionBusy ? 'Claiming…' : 'Cover Entire Shift'}
                  </button>
                  <button onClick={openPortionPicker} disabled={actionBusy} className="border border-[#2F3E4E] text-[#2F3E4E] text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#F4F6F5] transition disabled:opacity-50">
                    Cover a Portion
                  </button>
                </>
              )}
              {isClaimableShift && portionMode && (
                <>
                  <button onClick={submitPortionClaim} disabled={actionBusy} className="bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#7A8F79] transition disabled:opacity-50">
                    {actionBusy ? 'Submitting…' : 'Submit'}
                  </button>
                  <button onClick={() => { setPortionMode(false); setPortionError('') }} className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] px-4 py-2 transition">
                    Back
                  </button>
                </>
              )}
              {isMyAssignedShift && (
                <button onClick={() => releaseShift(selectedItem.id)} disabled={actionBusy} className="border border-amber-300 text-amber-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-amber-50 transition disabled:opacity-50">
                  {actionBusy ? 'Releasing…' : 'Release'}
                </button>
              )}
              {!portionMode && (
                <button onClick={closeDetailModal} className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] px-4 py-2 transition">
                  Close
                </button>
              )}
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

      {/* Upload Progress Note — patient-picker step, then hands off to the
          shared upload modal (not nested inside this one). */}
      {showUploadNote && !uploadPatientId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowUploadNote(false)}>
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-lg font-bold text-[#2F3E4E]">Upload Progress Note</p>
              <button onClick={() => setShowUploadNote(false)} className="text-[#7A8F79] hover:text-[#2F3E4E] text-sm font-semibold transition">Close</button>
            </div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Patient</label>
            <select
              className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              value={uploadPatientId}
              onChange={e => setUploadPatientId(e.target.value)}
            >
              <option value="">— Select a patient —</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </div>
        </div>
      )}

      {showUploadNote && uploadPatientId && (
        <ProgressNoteDocumentUploadModal
          patientId={uploadPatientId}
          serviceDate={view === 'day' ? anchorDate : new Date()}
          onClose={() => { setShowUploadNote(false); setUploadPatientId('') }}
          onUploaded={() => { setShowUploadNote(false); setUploadPatientId(''); load() }}
        />
      )}
    </div>
  )
}
