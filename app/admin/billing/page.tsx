'use client'

import { useState, useEffect } from 'react'
import AdminNav from '../../components/AdminNav'

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
    accountNumber: string | null
  }
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export default function AdminBillingPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unbilled' | 'billed'>('unbilled')
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)
  const [claimRefs, setClaimRefs] = useState<Record<string, string>>({})

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

  async function toggleBilled(entry: TimeEntry) {
    setToggling(entry.id)
    await fetch('/api/admin/time-entries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id: entry.id, billed: !entry.billed })
    })
    setEntries(prev =>
      prev.map(e => e.id === entry.id ? { ...e, billed: !e.billed } : e)
    )
    setToggling(null)
  }

  const filtered = entries.filter(e => {
    const matchSearch = search === '' ||
      e.nurse.displayName.toLowerCase().includes(search.toLowerCase()) ||
      (e.nurse.accountNumber ?? '').toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ? true :
      filter === 'billed' ? e.billed :
      !e.billed
    return matchSearch && matchFilter
  })

  const totalHours = filtered.reduce((s, e) => s + e.hours, 0)
  const billedHours = filtered.filter(e => e.billed).reduce((s, e) => s + e.hours, 0)
  const unbilledHours = filtered.filter(e => !e.billed).reduce((s, e) => s + e.hours, 0)

  // Group by nurse for summary strip
  const nurseMap: Record<string, { displayName: string; hours: number; billed: number }> = {}
  for (const e of filtered) {
    const key = e.nurse.displayName
    if (!nurseMap[key]) nurseMap[key] = { displayName: e.nurse.displayName, hours: 0, billed: 0 }
    nurseMap[key].hours += e.hours
    if (e.billed) nurseMap[key].billed += e.hours
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <AdminNav />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">my</span>Billing Summary
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">Review submitted hours and lock entries once billed.</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 border-t-4 border-[#7A8F79]">
          <span className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Total Hours (view)</span>
          <span className="text-3xl font-bold text-[#2F3E4E]">{totalHours}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 border-t-4 border-[#2F3E4E]">
          <span className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Unbilled Hours</span>
          <span className="text-3xl font-bold text-[#2F3E4E]">{unbilledHours}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 border-t-4 border-green-500">
          <span className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Billed Hours</span>
          <span className="text-3xl font-bold text-green-600">{billedHours}</span>
        </div>
      </div>

      {/* Nurse summary cards */}
      {Object.values(nurseMap).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-[#2F3E4E] mb-3 uppercase tracking-wide">By Nurse</h2>
          <div className="flex flex-wrap gap-3">
            {Object.values(nurseMap).map(n => (
              <div key={n.displayName} className="border border-[#D9E1E8] rounded-lg px-4 py-2 text-sm">
                <p className="font-semibold text-[#2F3E4E]">{n.displayName}</p>
                <p className="text-[#7A8F79] text-xs">
                  {n.hours} hrs total &bull; {n.billed} billed &bull; {n.hours - n.billed} unbilled
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
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
        <h2 className="text-lg font-semibold text-[#2F3E4E] mb-4 pb-2 border-b border-[#D9E1E8]">
          Time Entry Log
        </h2>

        {loading ? (
          <p className="text-sm text-[#7A8F79]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[#7A8F79] italic">No entries match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                  <th className="text-left py-2 pr-4">Nurse</th>
                  <th className="text-left py-2 pr-4">Account</th>
                  <th className="text-left py-2 pr-4">Date Worked</th>
                  <th className="text-right py-2 pr-4">Hours</th>
                  <th className="text-left py-2 pr-4">Notes</th>
                  <th className="text-left py-2 pr-4">Claim Ref #</th>
                  <th className="text-center py-2">Billed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => (
                  <tr
                    key={entry.id}
                    className={`border-b border-[#D9E1E8] last:border-0 ${
                      entry.billed
                        ? 'bg-green-50'
                        : i % 2 === 0 ? 'bg-white' : 'bg-[#F4F6F5]'
                    }`}
                  >
                    <td className={`py-2 pr-4 font-semibold whitespace-nowrap ${entry.billed ? 'text-[#7A8F79]' : 'text-[#2F3E4E]'}`}>
                      {entry.nurse.displayName}
                    </td>
                    <td className={`py-2 pr-4 text-xs whitespace-nowrap ${entry.billed ? 'text-[#7A8F79]' : 'text-[#7A8F79]'}`}>
                      {entry.nurse.accountNumber ?? '—'}
                    </td>
                    <td className={`py-2 pr-4 whitespace-nowrap ${entry.billed ? 'text-[#7A8F79]' : 'text-[#2F3E4E]'}`}>
                      {fmt(entry.workDate)}
                    </td>
                    <td className={`py-2 pr-4 text-right font-semibold ${entry.billed ? 'text-[#7A8F79]' : 'text-[#2F3E4E]'}`}>
                      {entry.hours}
                    </td>
                    <td className="py-2 pr-4 text-xs italic text-[#7A8F79]">
                      {entry.notes || '—'}
                    </td>
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
