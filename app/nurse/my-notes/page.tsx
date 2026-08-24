'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { todayLocalDateString, formatServiceDate } from '../../../lib/localDate'
import MicroChargingDevices from '../../components/nurse/MicroChargingDevices'
import MicroChargingTimeSaved from '../../components/nurse/MicroChargingTimeSaved'

// Same UTC-read approach as formatServiceDate (see lib/localDate.ts) — the
// stored value is a calendar day, not an instant, so weekday must be read
// from UTC components too or it can roll back a day for US-timezone viewers.
function formatServiceDateWithDay(value: string): string {
  const d = new Date(value)
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  return `${weekday}, ${formatServiceDate(value)}`
}

type MyNote = {
  id: string
  serviceDate: string
  signedAt: string | null
  voidedAt: string | null
  patientId: string
  patientName: string
  patientAccountNumber: string
  activeCase: boolean
  shiftNotes: string | null
  arrivalFindings: string | null
}

type PickerPatient = {
  patientId: string
  name: string
  accountNumber: string
}

type SortCol = 'default' | 'patient' | 'date' | 'account' | 'status'
type StatusFilter = 'all' | 'draft' | 'signed' | 'voided'

// Draft = 0, Signed = 1, Voided = 2 — a voided note was signed first, so it
// still counts as "completed" alongside signed notes, just flagged after.
function statusRank(n: MyNote) {
  if (!n.signedAt) return 0
  return n.voidedAt ? 2 : 1
}

function statusOf(n: MyNote): Exclude<StatusFilter, 'all'> {
  if (n.voidedAt) return 'voided'
  if (n.signedAt) return 'signed'
  return 'draft'
}

function statusBadge(note: MyNote) {
  if (note.voidedAt) return <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Voided</span>
  if (note.signedAt) return <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Signed</span>
  return <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Draft</span>
}

// Every note this nurse has ever authored, across every patient — reachable
// even after she's no longer linked to a case, since the notes themselves
// still exist and she may need them for her own billing/record purposes.
// Does not grant browsing access to a patient's other notes or full chart —
// see app/api/nurse/my-notes/route.ts.
export default function MyNotesPage() {
  const router = useRouter()
  const [notes, setNotes] = useState<MyNote[]>([])
  const [loading, setLoading] = useState(true)

  // Search/filter — client-side over the already-fetched list (this is one
  // nurse's own archive, not worth server-side search complexity at this
  // scale). Search checks note content (shiftNotes/arrivalFindings); patient
  // and status are exact-match dropdowns, kept separate per Alex's request.
  const [searchText, setSearchText] = useState('')
  const [patientFilter, setPatientFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const patientOptions = useMemo(
    () => [...new Set(notes.map(n => n.patientName))].sort((a, b) => a.localeCompare(b)),
    [notes],
  )

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    return notes.filter(n => {
      if (patientFilter && n.patientName !== patientFilter) return false
      if (statusFilter !== 'all' && statusOf(n) !== statusFilter) return false
      if (q) {
        const haystack = `${n.shiftNotes || ''} ${n.arrivalFindings || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [notes, searchText, patientFilter, statusFilter])

  // Default view: drafts on top, then everything else newest-to-oldest by
  // service date. Clicking a column header switches to a plain sort by that
  // column instead — see handleSort/sorted below.
  const [sortCol, setSortCol] = useState<SortCol>('default')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sortCol === 'default') {
      const rankA = statusRank(a) === 0 ? 0 : 1
      const rankB = statusRank(b) === 0 ? 0 : 1
      if (rankA !== rankB) return rankA - rankB
      return b.serviceDate.localeCompare(a.serviceDate)
    }
    let cmp = 0
    if (sortCol === 'patient') cmp = a.patientName.localeCompare(b.patientName)
    else if (sortCol === 'date') cmp = a.serviceDate.localeCompare(b.serviceDate)
    else if (sortCol === 'account') cmp = a.patientAccountNumber.localeCompare(b.patientAccountNumber, undefined, { numeric: true })
    else if (sortCol === 'status') cmp = statusRank(a) - statusRank(b)
    return sortDir === 'asc' ? cmp : -cmp
  })

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <span className="ml-1 opacity-30">↕</span>
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const [pickerOpen, setPickerOpen] = useState(false)
  const [patients, setPatients] = useState<PickerPatient[]>([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  const [pickerError, setPickerError] = useState('')

  useEffect(() => {
    fetch('/api/nurse/my-notes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setNotes(d.notes || []); setLoading(false) })
  }, [])

  function openPicker() {
    setPickerOpen(true)
    setPickerError('')
    setPatientsLoading(true)
    fetch('/api/nurse/patients', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const list: PickerPatient[] = (d.patients || []).map((p: {
          patientId: string
          merged?: { firstName?: string; lastName?: string; accountNumber?: string }
        }) => ({
          patientId: p.patientId,
          name: `${p.merged?.firstName || ''} ${p.merged?.lastName || ''}`.trim(),
          accountNumber: p.merged?.accountNumber || '—',
        }))
        setPatients(list)
        setPatientsLoading(false)
      })
      .catch(() => { setPickerError('Failed to load your patients.'); setPatientsLoading(false) })
  }

  async function createNoteFor(patientId: string) {
    setCreatingFor(patientId)
    setPickerError('')
    const res = await fetch('/api/nurse/progress-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ patientId, serviceDate: todayLocalDateString() }),
    })
    if (res.ok) {
      const { note } = await res.json()
      router.push(`/nurse/patients/${patientId}/progress-notes/${note.id}`)
    } else {
      setCreatingFor(null)
      setPickerError('Failed to start a new note. Please try again.')
    }
  }

  const selectClass = 'w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
      <div className="max-w-6xl">
        <h1 className="text-2xl font-bold text-[#2F3E4E] mb-1">
          <span className="text-[#7A8F79] italic">my</span>Notes
        </h1>
        <p className="text-sm text-[#7A8F79] mb-5">Every Progress Note you&apos;ve authored, including patients you&apos;re no longer actively assigned to.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          <div className="order-3 lg:order-1 bg-white rounded-2xl shadow-sm p-6 space-y-3">
            <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Search &amp; Filter</p>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Search Note Content</label>
              <input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="e.g. &quot;fell&quot;, &quot;emesis&quot;…"
                className={selectClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Patient</label>
                <select value={patientFilter} onChange={e => setPatientFilter(e.target.value)} className={selectClass}>
                  <option value="">All Patients</option>
                  {patientOptions.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Status</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className={selectClass}>
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="signed">Signed</option>
                  <option value="voided">Voided</option>
                </select>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <MicroChargingDevices />
          </div>

          <div className="order-2 lg:order-3">
            <MicroChargingTimeSaved />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Progress Notes</p>
            <button
              type="button"
              onClick={openPicker}
              className="bg-[#2F3E4E] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#7A8F79] transition shadow-sm"
            >
              + New Note
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-[#7A8F79]">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-[#7A8F79] italic">You haven&apos;t authored any progress notes yet.</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-[#7A8F79] italic">No notes match your search/filters.</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                    {([
                      { col: 'patient', label: 'Patient' },
                      { col: 'date', label: 'Service Date' },
                      { col: 'account', label: 'Account #' },
                      { col: 'status', label: 'Status' },
                    ] as const).map(({ col, label }) => (
                      <th
                        key={col}
                        onClick={() => handleSort(col)}
                        className="py-2 px-6 text-left cursor-pointer select-none hover:text-[#2F3E4E] transition whitespace-nowrap"
                      >
                        {label}<SortIcon col={col} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((n, i) => (
                    <tr
                      key={n.id}
                      onClick={() => router.push(`/nurse/patients/${n.patientId}/progress-notes/${n.id}?from=archive`)}
                      className={`border-b border-[#D9E1E8] last:border-0 cursor-pointer hover:bg-[#D9E1E8] transition ${i % 2 === 1 ? 'bg-[#F4F6F5]' : ''}`}
                    >
                      <td className="py-2 px-6 font-semibold text-[#2F3E4E] whitespace-nowrap">
                        {n.patientName}
                        {!n.activeCase && <span className="ml-1.5 text-[10px] font-normal italic text-[#7A8F79]">(no longer active)</span>}
                      </td>
                      <td className="py-2 px-6 text-[#7A8F79] whitespace-nowrap">{formatServiceDateWithDay(n.serviceDate)}</td>
                      <td className="py-2 px-6 text-[#7A8F79] whitespace-nowrap">{n.patientAccountNumber}</td>
                      <td className="py-2 px-6 whitespace-nowrap">{statusBadge(n)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#D9E1E8]">
              <h2 className="text-lg font-bold text-[#2F3E4E]">Select a Patient</h2>
              <button onClick={() => setPickerOpen(false)} className="text-[#7A8F79] hover:text-[#2F3E4E] transition text-xl leading-none">✕</button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-[#7A8F79]">Choose which patient this new progress note is for.</p>
              {pickerError && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{pickerError}</p>}

              {patientsLoading ? (
                <p className="text-sm text-[#7A8F79]">Loading your patients…</p>
              ) : patients.length === 0 ? (
                <p className="text-sm text-[#7A8F79] italic">You have no actively assigned patients.</p>
              ) : (
                <div className="space-y-1.5">
                  {patients.map(p => (
                    <button
                      key={p.patientId}
                      type="button"
                      disabled={creatingFor !== null}
                      onClick={() => createNoteFor(p.patientId)}
                      className="w-full flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2 hover:bg-[#D9E1E8] transition text-left disabled:opacity-50"
                    >
                      <div>
                        <p className="text-sm text-[#2F3E4E] font-semibold">{p.name}</p>
                        <p className="text-xs text-[#7A8F79]">{p.accountNumber}</p>
                      </div>
                      {creatingFor === p.patientId && <span className="text-xs text-[#7A8F79]">Starting…</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
