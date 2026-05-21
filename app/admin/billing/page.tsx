'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import AdminNav from '../../components/AdminNav'
import { formalName } from '../../../lib/formatName'
import { campaignRuleLabel, campaignWindowLabel } from '../../../lib/campaignDiscount'

type Tab = 'hours' | 'invoices' | 'campaigns'

// ── Hours ────────────────────────────────────────────────────────────────────

type TimeEntry = {
  id: string
  workDate: string
  hours: number
  notes: string | null
  billed: boolean
  claimRef: string | null
  createdAt: string
  nurse: {
    displayName: string
    firstName?: string
    lastName?: string
    accountNumber: string | null
  }
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

type NurseOption = {
  id: string
  displayName: string
  firstName?: string
  lastName?: string
  accountNumber?: string
}

type PatientOption = {
  id: string
  firstName: string
  lastName: string
  accountNumber?: string
}

function QuickEntryForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [nurses, setNurses] = useState<NurseOption[]>([])
  const [nurseId, setNurseId] = useState('')
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [patientId, setPatientId] = useState('')
  const [dateParts, setDateParts] = useState({ mm: '', dd: '', yyyy: '' })
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const mmRef = useRef<HTMLInputElement>(null)
  const ddRef = useRef<HTMLInputElement>(null)
  const yyyyRef = useRef<HTMLInputElement>(null)
  const hoursRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/nurses', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setNurses(data.filter((n: any) => !n.isDemo))
        }
      })
  }, [])

  useEffect(() => {
    setPatients([])
    setPatientId('')
    if (!nurseId) return
    fetch(`/api/admin/patients?nurseId=${nurseId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.patients)) setPatients(data.patients)
      })
  }, [nurseId])

  function handleDatePart(field: 'mm' | 'dd' | 'yyyy', val: string) {
    const digits = val.replace(/\D/g, '')
    setDateParts(prev => ({ ...prev, [field]: digits }))
    if (field === 'mm' && digits.length === 2) ddRef.current?.focus()
    if (field === 'dd' && digits.length === 2) yyyyRef.current?.focus()
    if (field === 'yyyy' && digits.length === 4) hoursRef.current?.focus()
  }

  function reset() {
    setNurseId(''); setPatients([]); setPatientId('')
    setDateParts({ mm: '', dd: '', yyyy: '' }); setHours(''); setNotes('')
    setError(''); setSuccess('')
  }

  async function submit() {
    setError(''); setSuccess('')
    if (!nurseId) { setError('Select a nurse.'); return }
    const { mm, dd, yyyy } = dateParts
    if (!mm || !dd || !yyyy || yyyy.length < 4) { setError('Enter a complete date.'); return }
    const workDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    const h = parseInt(hours, 10)
    if (!h || h < 1 || h > 99) { setError('Hours must be 1–99.'); return }
    if (patients.length === 0) { setError('No patients linked to this nurse — link a patient first.'); return }
    if (!patientId) { setError('Select a patient.'); return }

    setSaving(true)
    const res = await fetch('/api/admin/time-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nurseId, workDate, hours: h, notes: notes || null, patientId: patientId || null }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Failed to save.'); return }
    setSuccess('Entry added!')
    setTimeout(() => setSuccess(''), 2500)
    reset()
    onAdded()
    mmRef.current?.focus()
  }

  const nurseLabel = (n: NurseOption) => formalName(n) || n.displayName

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-[#F4F6F5] transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">⚡</span>
          <span className="text-sm font-bold text-[#2F3E4E] uppercase tracking-wide">Quick Hour Entry</span>
          {success && <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">{success}</span>}
        </div>
        <span className="text-[#7A8F79] text-xs font-semibold">{open ? '▲ collapse' : '▼ expand'}</span>
      </button>

      {open && (
        <div className="border-t border-[#D9E1E8] px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">

            {/* Nurse */}
            <div className="lg:col-span-1 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">Nurse *</label>
              <select
                value={nurseId}
                onChange={e => setNurseId(e.target.value)}
                className="w-full border border-[#D9E1E8] rounded-lg px-2 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              >
                <option value="">— Select —</option>
                {[...nurses].sort((a, b) => nurseLabel(a).localeCompare(nurseLabel(b))).map(n => (
                  <option key={n.id} value={n.id}>
                    {nurseLabel(n)}{n.accountNumber ? ` (${n.accountNumber})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Patient */}
            <div className="lg:col-span-1 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">Patient <span className="text-red-400">*</span></label>
              {nurseId && patients.length === 0 ? (
                <div className="border border-dashed border-[#D9E1E8] rounded-lg px-2 py-2 text-[11px] text-[#7A8F79] italic">
                  No patients linked to this nurse
                </div>
              ) : (
                <select
                  value={patientId}
                  onChange={e => setPatientId(e.target.value)}
                  disabled={!nurseId}
                  className="w-full border border-[#D9E1E8] rounded-lg px-2 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] disabled:opacity-40"
                >
                  <option value="">— Select patient —</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}{p.accountNumber ? ` · ${p.accountNumber}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Date — segmented MM / DD / YYYY */}
            <div className="lg:col-span-1 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">Date Worked *</label>
              <div className="flex items-center border border-[#D9E1E8] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#7A8F79] bg-white">
                <input
                  ref={mmRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="MM"
                  value={dateParts.mm}
                  onChange={e => handleDatePart('mm', e.target.value)}
                  className="w-10 text-center text-sm text-[#2F3E4E] py-2 focus:outline-none bg-transparent"
                />
                <span className="text-[#D9E1E8] font-bold select-none">/</span>
                <input
                  ref={ddRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="DD"
                  value={dateParts.dd}
                  onChange={e => handleDatePart('dd', e.target.value)}
                  className="w-10 text-center text-sm text-[#2F3E4E] py-2 focus:outline-none bg-transparent"
                />
                <span className="text-[#D9E1E8] font-bold select-none">/</span>
                <input
                  ref={yyyyRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="YYYY"
                  value={dateParts.yyyy}
                  onChange={e => handleDatePart('yyyy', e.target.value)}
                  className="w-16 text-center text-sm text-[#2F3E4E] py-2 focus:outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Hours */}
            <div className="lg:col-span-1 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">Hours *</label>
              <input
                ref={hoursRef}
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="e.g. 8"
                value={hours}
                onChange={e => setHours(e.target.value.replace(/\D/g, '').slice(0, 2))}
                className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] text-center font-bold focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
            </div>

            {/* Notes + Submit */}
            <div className="lg:col-span-1 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">Notes</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Optional"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submit() }}
                  className="flex-1 border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
                <button
                  onClick={submit}
                  disabled={saving}
                  className="px-4 py-2 bg-[#2F3E4E] text-white rounded-lg text-sm font-bold hover:bg-[#7A8F79] transition disabled:opacity-50 whitespace-nowrap"
                >
                  {saving ? '…' : '+ Add'}
                </button>
              </div>
            </div>

          </div>

          {error && (
            <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}

function HoursTab() {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unbilled' | 'billed'>('unbilled')
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [claimRefs, setClaimRefs] = useState<Record<string, string>>({})
  const [sortCol, setSortCol] = useState<'claimRef' | 'nurse' | 'account' | 'date' | 'hours' | 'notes' | 'billed'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: typeof sortCol }) {
    if (sortCol !== col) return <span className="ml-1 opacity-20">↕</span>
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function load() {
    fetch('/api/admin/time-entries', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEntries(data)
          const refs: Record<string, string> = {}
          data.forEach((e: TimeEntry) => { if (e.claimRef) refs[e.id] = e.claimRef })
          setClaimRefs(refs)
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function saveClaimRef(id: string, value: string) {
    await fetch(`/api/admin/time-entry/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ claimRef: value }),
    })
    setEntries(prev => prev.map(e => e.id === id ? { ...e, claimRef: value || null } : e))
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this time entry? This cannot be undone.')) return
    setDeleting(id)
    await fetch(`/api/admin/time-entry/${id}`, { method: 'DELETE', credentials: 'include' })
    setEntries(prev => prev.filter(e => e.id !== id))
    setDeleting(null)
  }

  async function toggleBilled(entry: TimeEntry) {
    setToggling(entry.id)
    await fetch('/api/admin/time-entries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id: entry.id, billed: !entry.billed }),
    })
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, billed: !e.billed } : e))
    setToggling(null)
  }

  const filtered = entries
    .filter(e => {
      const nurseName = formalName(e.nurse) || e.nurse.displayName
      const matchSearch = search === '' ||
        nurseName.toLowerCase().includes(search.toLowerCase()) ||
        (e.nurse.accountNumber ?? '').toLowerCase().includes(search.toLowerCase())
      const matchFilter =
        filter === 'all' ? true :
        filter === 'billed' ? e.billed :
        !e.billed
      return matchSearch && matchFilter
    })
    .sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'claimRef':  cmp = (a.claimRef ?? '').localeCompare(b.claimRef ?? ''); break
        case 'nurse':     cmp = (formalName(a.nurse) || a.nurse.displayName).localeCompare(formalName(b.nurse) || b.nurse.displayName); break
        case 'account':   cmp = (a.nurse.accountNumber ?? '').localeCompare(b.nurse.accountNumber ?? ''); break
        case 'date':      cmp = new Date(a.workDate).getTime() - new Date(b.workDate).getTime(); break
        case 'hours':     cmp = a.hours - b.hours; break
        case 'notes':     cmp = (a.notes ?? '').localeCompare(b.notes ?? ''); break
        case 'billed':    cmp = Number(a.billed) - Number(b.billed); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

  const totalHours    = filtered.reduce((s, e) => s + e.hours, 0)
  const billedHours   = filtered.filter(e => e.billed).reduce((s, e) => s + e.hours, 0)
  const unbilledHours = filtered.filter(e => !e.billed).reduce((s, e) => s + e.hours, 0)

  const currentYear      = new Date().getFullYear()
  const yearEntries      = entries.filter(e => new Date(e.workDate).getUTCFullYear() === currentYear)
  const totalHoursYear   = yearEntries.reduce((s, e) => s + e.hours, 0)
  const billedHoursYear  = yearEntries.filter(e => e.billed).reduce((s, e) => s + e.hours, 0)

  const nurseMap: Record<string, { label: string; hours: number; billed: number }> = {}
  for (const e of filtered) {
    const label = formalName(e.nurse) || e.nurse.displayName
    if (!nurseMap[label]) nurseMap[label] = { label, hours: 0, billed: 0 }
    nurseMap[label].hours += e.hours
    if (e.billed) nurseMap[label].billed += e.hours
  }

  return (
    <div className="space-y-6">
      <QuickEntryForm onAdded={load} />

      {/* Stats strip */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-white rounded-xl shadow-sm px-4 py-4 flex flex-col gap-1 border-t-4 border-[#7A8F79]">
          <span className="text-[10px] uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Total Hours (view)</span>
          <span className="text-2xl font-bold text-[#2F3E4E]">{totalHours}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm px-4 py-4 flex flex-col gap-1 border-t-4 border-[#2F3E4E]">
          <span className="text-[10px] uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Unbilled Hours</span>
          <span className="text-2xl font-bold text-[#2F3E4E]">{unbilledHours}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm px-4 py-4 flex flex-col gap-1 border-t-4 border-green-500">
          <span className="text-[10px] uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Billed Hours (view)</span>
          <span className="text-2xl font-bold text-green-600">{billedHours}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm px-4 py-4 flex flex-col gap-1 border-t-4 border-blue-400">
          <span className="text-[10px] uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Total Hours {currentYear}</span>
          <span className="text-2xl font-bold text-blue-600">{totalHoursYear}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm px-4 py-4 flex flex-col gap-1 border-t-4 border-purple-400">
          <span className="text-[10px] uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Billed Hours {currentYear}</span>
          <span className="text-2xl font-bold text-purple-600">{billedHoursYear}</span>
        </div>
      </div>

      {/* By nurse */}
      {Object.values(nurseMap).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-[#2F3E4E] mb-3 uppercase tracking-wide">By Nurse</h2>
          <div className="flex flex-wrap gap-3">
            {Object.values(nurseMap).map(n => (
              <div key={n.label} className="border border-[#D9E1E8] rounded-lg px-4 py-2 text-sm">
                <p className="font-semibold text-[#2F3E4E]">{n.label}</p>
                <p className="text-[#7A8F79] text-xs">
                  {n.hours} hrs total &bull; {n.billed} billed &bull; {n.hours - n.billed} unbilled
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search nurse name or account…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] flex-1 min-w-[200px]"
          />
          <div className="flex gap-2">
            {(['unbilled', 'all', 'billed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition ${
                  filter === f
                    ? 'bg-[#2F3E4E] text-white'
                    : 'bg-[#D9E1E8] text-[#2F3E4E] hover:bg-[#c8d4dd]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Entries table */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-[#2F3E4E] mb-4 pb-2 border-b border-[#D9E1E8]">Time Entry Log</h2>
        {loading ? (
          <p className="text-sm text-[#7A8F79]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[#7A8F79] italic">No entries match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                  {([ ['claimRef','Claim Ref #','left'], ['nurse','Nurse','left'], ['account','Account','left'], ['date','Date Worked','left'], ['hours','Hours','right'], ['notes','Notes','left'], ['billed','Billed','center'] ] as [typeof sortCol, string, string][]).map(([col, label, align]) => (
                    <th key={col} className={`py-2 pr-4 text-${align} cursor-pointer select-none hover:text-[#2F3E4E] transition whitespace-nowrap`} onClick={() => handleSort(col)}>
                      {label}<SortIcon col={col} />
                    </th>
                  ))}
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => (
                  <tr
                    key={entry.id}
                    className={`border-b border-[#D9E1E8] last:border-0 ${
                      entry.billed ? 'bg-green-50' : i % 2 === 0 ? 'bg-white' : 'bg-[#F4F6F5]'
                    }`}
                  >
                    <td className="py-2 pr-4">
                      <input
                        type="text"
                        value={claimRefs[entry.id] ?? entry.claimRef ?? ''}
                        onChange={e => setClaimRefs(prev => ({ ...prev, [entry.id]: e.target.value }))}
                        onBlur={e => saveClaimRef(entry.id, e.target.value)}
                        placeholder="e.g. CLM-001"
                        className="border border-[#D9E1E8] rounded px-2 py-1 text-xs text-[#2F3E4E] w-28 focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                      />
                    </td>
                    <td className={`py-2 pr-4 font-semibold whitespace-nowrap ${entry.billed ? 'text-[#7A8F79]' : 'text-[#2F3E4E]'}`}>
                      {formalName(entry.nurse) || entry.nurse.displayName}
                    </td>
                    <td className="py-2 pr-4 text-xs whitespace-nowrap text-[#7A8F79]">
                      {entry.nurse.accountNumber ?? '—'}
                    </td>
                    <td className={`py-2 pr-4 whitespace-nowrap ${entry.billed ? 'text-[#7A8F79]' : 'text-[#2F3E4E]'}`}>
                      {fmtDate(entry.workDate)}
                    </td>
                    <td className={`py-2 pr-4 text-right font-semibold ${entry.billed ? 'text-[#7A8F79]' : 'text-[#2F3E4E]'}`}>
                      {entry.hours}
                    </td>
                    <td className="py-2 pr-4 text-xs italic text-[#7A8F79]">{entry.notes || '—'}</td>
                    <td className="py-2 text-center">
                      <button
                        onClick={() => toggleBilled(entry)}
                        disabled={toggling === entry.id}
                        title={entry.billed ? 'Marked as billed — click to undo' : 'Mark as billed'}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition ${
                          entry.billed
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-[#D9E1E8] hover:border-[#7A8F79]'
                        } ${toggling === entry.id ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                      >
                        {entry.billed && (
                          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    </td>
                    <td className="py-2 pl-2">
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        disabled={deleting === entry.id}
                        title="Delete entry"
                        className="text-red-300 hover:text-red-500 transition disabled:opacity-40"
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                          <path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-[#7A8F79] mt-4 italic">
          Checking a row marks it as billed and locks it — the nurse will no longer be able to delete that entry.
        </p>
      </div>
    </div>
  )
}

// ── Invoices ─────────────────────────────────────────────────────────────────

function InvoicesTab() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[#D9E1E8] flex items-center justify-center text-2xl">📄</div>
        <div>
          <h2 className="text-lg font-bold text-[#2F3E4E]">Invoicing Dashboard</h2>
          <p className="text-sm text-[#7A8F79] mt-1 max-w-sm">
            Create and manage provider invoices, record payments, and track income.
          </p>
        </div>
        <Link
          href="/admin/invoicing"
          className="bg-[#2F3E4E] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition"
        >
          Open Invoicing Dashboard →
        </Link>
      </div>
    </div>
  )
}

// ── Campaigns ────────────────────────────────────────────────────────────────

type Campaign = {
  id: string
  name: string
  description?: string
  type: string
  flatAmtPerDos?: number
  weeklyMaxAmt?: number
  percentOff?: number
  startDate?: string
  weekCount?: number
  promoSlug?: string
  active: boolean
  _count?: { enrollments: number }
}

const TYPE_LABELS: Record<string, string> = {
  flat_per_dos: '$X per date of service (weekly cap)',
  percent_off:  '% off invoice total',
}

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formMsg, setFormMsg] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('flat_per_dos')
  const [flatAmtPerDos, setFlatAmtPerDos] = useState('')
  const [weeklyMaxAmt, setWeeklyMaxAmt] = useState('')
  const [percentOff, setPercentOff] = useState('')
  const [startDate, setStartDate] = useState('')
  const [weekCount, setWeekCount] = useState('')
  const [promoSlug, setPromoSlug] = useState('')

  async function fetchCampaigns() {
    const res = await fetch('/api/admin/campaigns', { credentials: 'include' })
    if (res.ok) setCampaigns(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchCampaigns() }, [])

  function resetForm() {
    setName(''); setDescription(''); setType('flat_per_dos')
    setFlatAmtPerDos(''); setWeeklyMaxAmt(''); setPercentOff('')
    setStartDate(''); setWeekCount(''); setPromoSlug('')
    setFormMsg(''); setEditingId(null)
  }

  function openEdit(c: Campaign) {
    setEditingId(c.id)
    setName(c.name)
    setDescription(c.description || '')
    setType(c.type)
    setFlatAmtPerDos(c.flatAmtPerDos?.toString() || '')
    setWeeklyMaxAmt(c.weeklyMaxAmt?.toString() || '')
    setPercentOff(c.percentOff?.toString() || '')
    setStartDate(c.startDate ? c.startDate.slice(0, 10) : '')
    setWeekCount(c.weekCount?.toString() || '')
    setPromoSlug(c.promoSlug || '')
    setFormMsg('')
    setShowForm(true)
  }

  async function save() {
    if (!name.trim()) { setFormMsg('Name is required.'); return }
    setSaving(true)
    setFormMsg('')

    const body = {
      name: name.trim(),
      description: description.trim() || null,
      type,
      flatAmtPerDos: type === 'flat_per_dos' ? parseFloat(flatAmtPerDos) || null : null,
      weeklyMaxAmt:  type === 'flat_per_dos' ? parseFloat(weeklyMaxAmt)  || null : null,
      percentOff:    type === 'percent_off'  ? parseFloat(percentOff)    || null : null,
      startDate: startDate || null,
      weekCount: weekCount ? parseInt(weekCount) : null,
      promoSlug: promoSlug.trim() || null,
    }

    const url    = editingId ? `/api/admin/campaigns/${editingId}` : '/api/admin/campaigns'
    const method = editingId ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setSaving(false)
    if (res.ok) {
      resetForm()
      setShowForm(false)
      fetchCampaigns()
    } else {
      const d = await res.json()
      setFormMsg(d.error || 'Failed to save.')
    }
  }

  async function toggleActive(c: Campaign) {
    await fetch(`/api/admin/campaigns/${c.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    })
    fetchCampaigns()
  }

  async function deleteCampaign(c: Campaign) {
    if (!confirm(`Delete campaign "${c.name}"? This cannot be undone.`)) return
    await fetch(`/api/admin/campaigns/${c.id}`, { method: 'DELETE', credentials: 'include' })
    fetchCampaigns()
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#7A8F79]">Create and manage discount campaigns for providers.</p>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="bg-[#2F3E4E] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition"
        >
          + New Campaign
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#7A8F79] border-b border-[#D9E1E8] pb-3">
            {editingId ? 'Edit Campaign' : 'New Campaign'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Campaign Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FB Spring 2026"
                className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Discount Type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]">
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Description <span className="normal-case font-normal">(optional)</span></label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Internal notes about this campaign"
              className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
          </div>

          {type === 'flat_per_dos' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">$ per Date of Service</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8F79] text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={flatAmtPerDos} onChange={e => setFlatAmtPerDos(e.target.value)}
                    placeholder="3.00"
                    className="w-full border border-[#D9E1E8] rounded-lg pl-6 pr-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Weekly Max <span className="normal-case font-normal">(Mon–Sun, optional)</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8F79] text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={weeklyMaxAmt} onChange={e => setWeeklyMaxAmt(e.target.value)}
                    placeholder="10.00"
                    className="w-full border border-[#D9E1E8] rounded-lg pl-6 pr-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                </div>
              </div>
            </div>
          )}

          {type === 'percent_off' && (
            <div className="space-y-1 max-w-xs">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Percent Off</label>
              <div className="relative">
                <input type="number" min="0" max="100" step="0.1" value={percentOff} onChange={e => setPercentOff(e.target.value)}
                  placeholder="25"
                  className="w-full border border-[#D9E1E8] rounded-lg pl-3 pr-8 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A8F79] text-sm">%</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Start Date <span className="normal-case font-normal">(optional)</span></label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Week Count <span className="normal-case font-normal">(optional)</span></label>
              <input type="number" min="1" step="1" value={weekCount} onChange={e => setWeekCount(e.target.value)}
                placeholder="e.g. 4"
                className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Promo Slug <span className="normal-case font-normal">(for future link)</span></label>
              <input value={promoSlug} onChange={e => setPromoSlug(e.target.value.toUpperCase().replace(/\s+/g, '-'))}
                placeholder="FB-SPRING26"
                className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] font-mono focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
              {promoSlug && (
                <p className="text-[10px] text-[#7A8F79] mt-0.5">Future link: /join?ref={promoSlug}</p>
              )}
            </div>
          </div>

          {formMsg && <p className="text-xs font-semibold text-red-500">{formMsg}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={() => { resetForm(); setShowForm(false) }}
              className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-xl text-sm font-semibold hover:bg-[#f4f6f8] transition">
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Campaign'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#7A8F79]">Loading…</p>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <p className="text-[#7A8F79] text-sm">No campaigns yet. Create one to start offering discounts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className={`bg-white rounded-2xl shadow-sm p-5 border-l-4 ${c.active ? 'border-[#7A8F79]' : 'border-[#D9E1E8]'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-[#2F3E4E]">{c.name}</p>
                    {!c.active && (
                      <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wide">Inactive</span>
                    )}
                    {c.promoSlug && (
                      <span className="text-[10px] font-mono bg-[#f4f6f8] text-[#7A8F79] px-2 py-0.5 rounded">/join?ref={c.promoSlug}</span>
                    )}
                  </div>
                  <p className="text-xs text-[#7A8F79] mt-0.5">
                    {campaignRuleLabel(c as any)} · {campaignWindowLabel(c as any)}
                  </p>
                  {c.description && <p className="text-xs text-[#4a5a6a] mt-1">{c.description}</p>}
                  <p className="text-[10px] text-[#7A8F79] mt-1.5">
                    {c._count?.enrollments ?? 0} active enrollment{c._count?.enrollments !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(c)}
                    className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] font-semibold transition">Edit</button>
                  <button onClick={() => toggleActive(c)}
                    className={`text-xs font-semibold transition ${c.active ? 'text-amber-500 hover:text-amber-700' : 'text-green-600 hover:text-green-800'}`}>
                    {c.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => deleteCampaign(c)}
                    className="text-xs text-red-400 hover:text-red-600 font-semibold transition">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'hours',     label: 'Hours' },
  { id: 'invoices',  label: 'Invoices' },
  { id: 'campaigns', label: 'Campaigns' },
]

export default function BillingPage() {
  const [tab, setTab] = useState<Tab>('hours')

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <AdminNav />
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">ad</span>Billing
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">Hours submitted → claims billed → invoices sent.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {TABS.filter(t => t.id !== 'invoices').map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === t.id
                ? 'bg-[#2F3E4E] text-white'
                : 'bg-white text-[#2F3E4E] border border-[#D9E1E8] hover:border-[#7A8F79] hover:text-[#7A8F79]'
            }`}
          >
            {t.label}
          </button>
        ))}
        <a
          href="/admin/invoicing"
          className="px-4 py-2 rounded-lg text-sm font-semibold transition bg-white text-[#2F3E4E] border border-[#D9E1E8] hover:border-[#7A8F79] hover:text-[#7A8F79]"
        >
          Invoices
        </a>
      </div>

      {tab === 'hours'     && <HoursTab />}
      {tab === 'invoices'  && <InvoicesTab />}
      {tab === 'campaigns' && <CampaignsTab />}
    </div>
  )
}
