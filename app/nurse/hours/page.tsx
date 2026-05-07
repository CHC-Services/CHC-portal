'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DateInput, DateInputHandle } from '../../components/DateInput'

type TimeEntry = {
  id: string
  workDate: string
  hours: number
  notes: string | null
  billed: boolean
  claimRef: string | null
  createdAt: string
}

export default function MyHours() {
  const router = useRouter()
  const dateInputRef = useRef<DateInputHandle>(null)
  const [workDate, setWorkDate] = useState('')
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [effectiveTier, setEffectiveTier] = useState<'FREE' | 'BASIC' | 'PRO'>('FREE')
  const [sortKey, setSortKey] = useState<'date' | 'hours'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function loadEntries() {
    return fetch('/api/time-entry', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setEntries(data)
      })
      .finally(() => setLoadingHistory(false))
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    setDeleting(true)
    await fetch('/api/time-entry', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ids: [...selected] }),
    })
    setSelected(new Set())
    setDeleting(false)
    loadEntries()
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSort(key: 'date' | 'hours') {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function toggleAll() {
    const selectable = yearEntries.filter(e => !e.billed)
    setSelected(prev =>
      prev.size === selectable.length ? new Set() : new Set(selectable.map(e => e.id))
    )
  }

  useEffect(() => {
    fetch('/api/nurse/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(async data => {
        if (!data.profile?.portalAgreementSignedAt) {
          router.replace('/nurse/agreement')
          return
        }
        if (!data.onboardingComplete) {
          router.replace('/nurse/onboarding')
          return
        }
        const planRes = await fetch('/api/nurse/plan', { credentials: 'include' })
        const planData = planRes.ok ? await planRes.json() : {}
        const tier: 'FREE' | 'BASIC' | 'PRO' = planData.effectiveTier || 'FREE'
        setEffectiveTier(tier)
        loadEntries()
      })
  }, [router])

  async function submitTime(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/time-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ workDate, hours, notes }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage('Hours submitted successfully.')
      setWorkDate('')
      setHours('')
      setNotes('')
      loadEntries().finally(() => {
        requestAnimationFrame(() => dateInputRef.current?.focus())
      })
    } else {
      setMessage(data.error || 'Error submitting hours.')
    }
  }

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
  const priorMonth = thisMonth === 0 ? 11 : thisMonth - 1
  const priorMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear

  const yearOptions = Array.from(
    new Set([thisYear, ...entries.map(e => new Date(e.workDate).getFullYear())])
  ).sort((a, b) => b - a)

  const yearEntries = entries.filter(e => new Date(e.workDate).getFullYear() === selectedYear)

  const hoursThisMonth = yearEntries
    .filter(e => { const d = new Date(e.workDate); return d.getMonth() === thisMonth && d.getFullYear() === selectedYear })
    .reduce((sum, e) => sum + e.hours, 0)

  const hoursPriorMonth = yearEntries
    .filter(e => { const d = new Date(e.workDate); return d.getMonth() === priorMonth && d.getFullYear() === (priorMonth === 11 ? selectedYear - 1 : selectedYear) })
    .reduce((sum, e) => sum + e.hours, 0)

  const hoursYTD = yearEntries.reduce((sum, e) => sum + e.hours, 0)

  const hoursUnbilled = yearEntries
    .filter(e => !e.billed)
    .reduce((sum, e) => sum + e.hours, 0)

  const monthName = now.toLocaleString('default', { month: 'long' })
  const priorMonthName = new Date(priorMonthYear, priorMonth).toLocaleString('default', { month: 'long' })

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">

      <div className="mb-5">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">my</span>Hours
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">
          {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Year filter */}
      {effectiveTier !== 'FREE' && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79]">Year</span>
          {yearOptions.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
                selectedYear === y
                  ? 'bg-[#2F3E4E] text-white'
                  : 'bg-white text-[#2F3E4E] border border-[#D9E1E8] hover:bg-[#D9E1E8]'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {/* Hours Overview */}
      {effectiveTier === 'FREE' ? (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#2F3E4E]">🔒 Hours Summary</p>
            <p className="text-xs text-[#7A8F79] mt-1">Monthly and year-to-date totals available on the <strong>Basic plan</strong>.</p>
          </div>
          <span className="text-xs font-bold text-[#7A8F79] shrink-0 border border-[#D9E1E8] rounded-full px-3 py-1">Basic · $5/mo</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] mb-4">Hours Overview</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">{monthName}</p>
              <p className="text-2xl font-black text-[#2F3E4E]">{hoursThisMonth}</p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">{priorMonthName}</p>
              <p className="text-2xl font-black text-[#2F3E4E]">{hoursPriorMonth}</p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">{selectedYear} Total</p>
              <p className="text-2xl font-black text-[#2F3E4E]">{hoursYTD}</p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Waiting to be Billed</p>
              <p className="text-2xl font-black text-amber-600">{hoursUnbilled}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">

        {/* Submit Hours form */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-[#2F3E4E] mb-4 pb-2 border-b border-[#D9E1E8]">
            Submit Hours
          </h2>
          <form onSubmit={submitTime} className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const d = new Date(); d.setDate(d.getDate() - 1)
                  setWorkDate(d.toISOString().split('T')[0])
                }}
                className="flex-1 border border-[#D9E1E8] text-[#2F3E4E] text-xs font-semibold py-1.5 rounded-lg hover:bg-[#D9E1E8] transition"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setWorkDate(new Date().toISOString().split('T')[0])}
                className="flex-1 border border-[#7A8F79] text-[#7A8F79] text-xs font-semibold py-1.5 rounded-lg hover:bg-[#D9E1E8] transition"
              >
                Today
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Date Worked</label>
                <DateInput ref={dateInputRef} value={workDate} onChange={setWorkDate} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Hours Worked</label>
                <input
                  type="number" step="1" min="1" placeholder="e.g. 8"
                  value={hours} onChange={e => setHours(e.target.value)} required
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">
                Notes <span className="normal-case font-normal text-[#aab]">(optional)</span>
              </label>
              <textarea
                placeholder="Any clarification needed..."
                value={notes} rows={3} onChange={e => setNotes(e.target.value)}
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#2F3E4E] text-white py-2 rounded-lg hover:bg-[#7A8F79] transition font-semibold tracking-wide"
            >
              Submit
            </button>
          </form>

          {message && (
            <p className={`mt-4 text-sm text-center font-medium ${message.includes('Error') || message.includes('error') ? 'text-red-500' : 'text-[#7A8F79]'}`}>
              {message}
            </p>
          )}

          <div className="mt-5 pt-4 border-t border-[#D9E1E8] text-xs text-[#7A8F79] space-y-1">
            <p>• Select the exact date worked.</p>
            <p>• Submit whole hours only — no partial hours.</p>
            <p>• One submission per calendar day.</p>
          </div>
        </div>

        {/* Submission History */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-1 pb-2 border-b border-[#D9E1E8]">
            <h2 className="text-lg font-semibold text-[#2F3E4E]">Submission History</h2>
            {selected.size > 0 && (
              <button
                onClick={deleteSelected}
                disabled={deleting}
                className="text-xs font-semibold text-red-600 border border-red-300 px-3 py-1 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : `Delete ${selected.size} selected`}
              </button>
            )}
          </div>

          {effectiveTier === 'FREE' && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              <span className="text-amber-500 text-sm">🔒</span>
              <p className="text-xs text-amber-800">Free plan shows the last <strong>14 days</strong> only. Upgrade to <strong>Basic</strong> for full history.</p>
            </div>
          )}

          <p className="text-xs text-[#7A8F79] mb-3 italic">To delete an entry, check the box for that row.</p>

          {loadingHistory ? (
            <p className="text-sm text-[#7A8F79]">Loading…</p>
          ) : yearEntries.length === 0 ? (
            <p className="text-sm text-[#7A8F79] italic">No submissions for {selectedYear}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                    <th className="py-2 pr-2 w-6">
                      <input
                        type="checkbox"
                        checked={yearEntries.filter(e => !e.billed).length > 0 && selected.size === yearEntries.filter(e => !e.billed).length}
                        onChange={toggleAll}
                        className="accent-[#7A8F79]"
                      />
                    </th>
                    <th
                      className="text-left py-2 pr-4 cursor-pointer select-none hover:text-[#2F3E4E] transition"
                      onClick={() => handleSort('date')}
                    >
                      Date {sortKey === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">↕</span>}
                    </th>
                    <th
                      className="text-right py-2 pr-4 cursor-pointer select-none hover:text-[#2F3E4E] transition"
                      onClick={() => handleSort('hours')}
                    >
                      Hours {sortKey === 'hours' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">↕</span>}
                    </th>
                    <th className="text-left py-2 pr-4">Notes</th>
                    <th className="text-left py-2">Claim Ref #</th>
                  </tr>
                </thead>
                <tbody>
                  {[...yearEntries]
                    .sort((a, b) => {
                      const dir = sortDir === 'asc' ? 1 : -1
                      if (sortKey === 'hours') return (a.hours - b.hours) * dir
                      return (a.workDate > b.workDate ? 1 : -1) * dir
                    })
                    .map((entry, i) => (
                      <tr
                        key={entry.id}
                        className={`border-b border-[#D9E1E8] last:border-0 ${
                          entry.billed
                            ? 'bg-green-50'
                            : selected.has(entry.id)
                            ? 'bg-red-50'
                            : i % 2 === 0 ? '' : 'bg-[#F4F6F5]'
                        }`}
                      >
                        <td className="py-2 pr-2">
                          {entry.billed ? (
                            <span title="Locked — billed by admin" className="text-green-500 text-xs select-none">🔒</span>
                          ) : (
                            <input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggleSelect(entry.id)} className="accent-[#7A8F79]" />
                          )}
                        </td>
                        <td className="py-2 pr-4 text-[#2F3E4E] whitespace-nowrap">
                          {new Date(entry.workDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                        </td>
                        <td className="py-2 pr-4 text-right font-semibold text-[#2F3E4E]">{entry.hours}</td>
                        <td className="py-2 pr-4 text-[#7A8F79] italic text-xs">{entry.notes || '—'}</td>
                        <td className="py-2 text-xs font-mono text-[#2F3E4E]">
                          {entry.claimRef || <span className="text-[#7A8F79] not-italic">—</span>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
