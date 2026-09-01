'use client'

import { useState, useEffect, useCallback, useMemo, use } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import CalendarGrid from '../../../components/calendar/CalendarGrid'
import CalendarViewSwitcher from '../../../components/calendar/CalendarViewSwitcher'
import { CalendarFilterBar, CalendarFilterSection } from '../../../components/calendar/CalendarFilterBar'
import ProgressNoteDocumentUploadModal from '../../../components/patient/ProgressNoteDocumentUploadModal'
import { computeViewRange, dateKey, type CalendarViewMode } from '../../../../lib/calendarViewRange'
import type { CalendarItem as RawCalendarItem } from '../../../../lib/calendarFeed'

type CalendarItem = Omit<RawCalendarItem, 'date' | 'endDate'> & { date: Date; endDate?: Date }

const CATEGORY_LABEL: Record<string, string> = {
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
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

const VALID_VIEWS: CalendarViewMode[] = ['day', 'week', 'month', 'lookahead', 'custom']

export default function PatientCalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = use(params)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const initialView = (VALID_VIEWS.includes(searchParams.get('view') as CalendarViewMode) ? searchParams.get('view') : 'month') as CalendarViewMode
  const initialAnchor = searchParams.get('anchor') ? new Date(searchParams.get('anchor')!) : new Date()

  const [view, setView] = useState<CalendarViewMode>(initialView)
  const [anchorDate, setAnchorDate] = useState(initialAnchor)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedTypes, setSelectedTypes] = useState<Set<string> | null>(null)
  const [selectedNurse, setSelectedNurse] = useState<string | null>(null) // null = all
  const [notesFilter, setNotesFilter] = useState<'all' | 'with' | 'without'>('all')

  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)

  // Progress-note document upload — nurse/provider only, offered from Day
  // view (see app/components/patient/ProgressNoteDocumentUploadModal.tsx).
  // This page has no server-side role prop (fully client-rendered), so role
  // is looked up the same way app/family/patients/[id]/page.tsx already does.
  const [role, setRole] = useState<string | null>(null)
  const [showUploadNote, setShowUploadNote] = useState(false)

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.role) setRole(data.role) })
      .catch(() => {})
  }, [])

  // Keep the URL in sync with view/anchor so a "Manage" link out to
  // /patient/[id]/schedule|appointment can carry a ?from= back here to the
  // exact view/date the user came from.
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('view', view)
    params.set('anchor', dateKey(anchorDate))
    router.replace(`${pathname}?${params.toString()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchorDate])

  // Escape closes the event detail popup first, and only falls through to
  // "back to month" once nothing else is open — so it never yanks you out
  // of a popup unexpectedly.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (showUploadNote) { setShowUploadNote(false); return }
      if (selectedItem) { setSelectedItem(null); return }
      if (view !== 'month') setView('month')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showUploadNote, selectedItem, view])

  const fromParam = useMemo(() => encodeURIComponent(`${pathname}?${searchParams.toString()}`), [pathname, searchParams])

  const customRange = useMemo(() => {
    if (view !== 'custom' || !customStart || !customEnd) return undefined
    return { start: new Date(customStart), end: new Date(customEnd) }
  }, [view, customStart, customEnd])

  const range = useMemo(() => computeViewRange(view, anchorDate, customRange), [view, anchorDate, customRange])

  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams({ start: range.start.toISOString(), end: range.end.toISOString() })
    return fetch(`/api/patient/${patientId}/calendar?${p}`, { credentials: 'include' })
      .then(r => (r.status === 401 || r.status === 404) ? null : r.json())
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
  }, [patientId, range.start, range.end])

  useEffect(() => { load() }, [load])

  const presentTypes = useMemo(() => Array.from(new Set(items.map(i => i.category))), [items])
  const presentNurses = useMemo(() => Array.from(new Set(items.filter(i => i.source === 'shift' && i.nurseName).map(i => i.nurseName as string))), [items])

  function matchesFilters(item: CalendarItem): boolean {
    if (selectedTypes && !selectedTypes.has(item.category)) return false
    if (selectedNurse && item.source === 'shift' && item.nurseName !== selectedNurse) return false
    if (notesFilter !== 'all' && item.source === 'shift') {
      const has = !!item.hasProgressNotes
      if (notesFilter === 'with' && !has) return false
      if (notesFilter === 'without' && has) return false
    }
    return true
  }

  const visibleItems = useMemo(() => items.filter(matchesFilters), [items, selectedTypes, selectedNurse, notesFilter])

  const filtersActive = (selectedTypes !== null) || selectedNurse !== null || notesFilter !== 'all'
  function clearFilters() {
    setSelectedTypes(null)
    setSelectedNurse(null)
    setNotesFilter('all')
  }

  function toggleType(cat: string) {
    setSelectedTypes(prev => {
      const base = prev ?? new Set(presentTypes)
      const next = new Set(base)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  const manageHref = selectedItem?.source === 'shift' ? `/patient/${patientId}/schedule?from=${fromParam}`
    : selectedItem?.source === 'appointment' ? `/patient/${patientId}/appointment?from=${fromParam}`
    : null

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-[#7A8F79]">This patient’s shifts, appointments, and upcoming deadlines.</p>
        <div className="flex gap-3">
          <Link href={`/patient/${patientId}/schedule`} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">Manage Schedule →</Link>
          <Link href={`/patient/${patientId}/appointment`} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">Manage Appointments →</Link>
        </div>
      </div>

      {presentTypes.length > 0 && (
        <CalendarFilterBar
          trailing={filtersActive && (
            <button onClick={clearFilters} className="text-[11px] font-semibold text-[#7A8F79] hover:text-[#2F3E4E] underline">
              Clear Filters
            </button>
          )}
        >
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
          {presentNurses.length > 1 && (
            <CalendarFilterSection label="Nurse">
              <button
                onClick={() => setSelectedNurse(null)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${selectedNurse === null ? 'bg-[#7A8F79] text-white' : 'bg-[#F4F6F5] text-[#7A8F79] hover:bg-[#D9E1E8]'}`}
              >
                All
              </button>
              {presentNurses.map(n => (
                <button
                  key={n}
                  onClick={() => setSelectedNurse(n)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${selectedNurse === n ? 'bg-[#7A8F79] text-white' : 'bg-[#F4F6F5] text-[#7A8F79] hover:bg-[#D9E1E8]'}`}
                >
                  {n}
                </button>
              ))}
            </CalendarFilterSection>
          )}
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

      {role === 'nurse' && view === 'day' && (
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
        <p className="text-[#7A8F79] text-sm">Loading calendar…</p>
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

      {selectedItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setSelectedItem(null)}>
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <p className="text-lg font-bold text-[#2F3E4E]">{selectedItem.title}</p>
            {selectedItem.nurseName && <p className="text-sm text-[#2F3E4E] mt-1">{selectedItem.nurseName}</p>}
            <p className="text-sm text-[#7A8F79] mt-1">
              {fmtDate(selectedItem.date)}{!selectedItem.allDay && ` · ${fmtTime(selectedItem.date)}`}
              {selectedItem.endDate && !selectedItem.allDay && ` – ${fmtTime(selectedItem.endDate)}`}
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

      {showUploadNote && (
        <ProgressNoteDocumentUploadModal
          patientId={patientId}
          serviceDate={anchorDate}
          onClose={() => setShowUploadNote(false)}
          onUploaded={() => { setShowUploadNote(false); load() }}
        />
      )}
    </div>
  )
}
