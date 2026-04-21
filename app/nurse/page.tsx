'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import PortalMessages from '../components/PortalMessages'
import { DateInput, DateInputHandle } from '../components/DateInput'

type TimeEntry = {
  id: string
  workDate: string
  hours: number
  notes: string | null
  billed: boolean
  claimRef: string | null
  createdAt: string
}


export default function NurseDashboard() {
  const router = useRouter()
  const dateInputRef = useRef<DateInputHandle>(null)
  const [workDate, setWorkDate] = useState('') // stored as YYYY-MM-DD
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [invoiceSummary, setInvoiceSummary] = useState<{ totalDue: number; count: number } | null>(null)
  const [claimSummary, setClaimSummary] = useState<{ totalBilled: number; totalAllowed: number; totalPaid: number; avgPerHour: number | null } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

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
      body: JSON.stringify({ ids: [...selected] })
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

  function toggleAll() {
    const selectable = entries.filter(e => !e.billed)
    setSelected(prev =>
      prev.size === selectable.length ? new Set() : new Set(selectable.map(e => e.id))
    )
  }

  useEffect(() => {
    fetch('/api/nurse/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (!data.onboardingComplete) {
          router.replace('/nurse/onboarding')
        } else {
          loadEntries()
          fetch('/api/nurse/invoices/summary', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setInvoiceSummary(d) })
          fetch('/api/nurse/claims/summary', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setClaimSummary(d) })
        }
      })
  }, [router])

  async function submitTime(e: React.FormEvent) {
    e.preventDefault()

    const res = await fetch('/api/time-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ workDate, hours, notes })
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

  const hoursThisMonth = entries
    .filter(e => { const d = new Date(e.workDate); return d.getMonth() === thisMonth && d.getFullYear() === thisYear })
    .reduce((sum, e) => sum + e.hours, 0)

  const hoursPriorMonth = entries
    .filter(e => { const d = new Date(e.workDate); return d.getMonth() === priorMonth && d.getFullYear() === priorMonthYear })
    .reduce((sum, e) => sum + e.hours, 0)

  const hoursYTD = entries
    .filter(e => new Date(e.workDate).getFullYear() === thisYear)
    .reduce((sum, e) => sum + e.hours, 0)

  const hoursUnbilled = entries
    .filter(e => !e.billed)
    .reduce((sum, e) => sum + e.hours, 0)

  const monthName = now.toLocaleString('default', { month: 'long' })
  const priorMonthName = new Date(priorMonthYear, priorMonth).toLocaleString('default', { month: 'long' })

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">my</span>Dashboard
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">
          {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <PortalMessages priority="General" />

      {/* Account Summary */}
      {invoiceSummary && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-4">
            Account Summary
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Balance Due</p>
              <p className={`text-2xl font-black ${invoiceSummary.totalDue > 0 ? 'text-red-500' : 'text-green-600'}`}>
                ${invoiceSummary.totalDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Outstanding Invoices</p>
              <p className={`text-2xl font-black ${invoiceSummary.count > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {invoiceSummary.count}
              </p>
            </div>
          </div>
          {invoiceSummary.count === 0 && (
            <p className="text-xs text-[#7A8F79] italic mt-3">Your account is fully paid up. Thank you!</p>
          )}
        </div>
      )}

      {/* Claims reimbursement summary */}
      {claimSummary && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-4">
            Reimbursement Summary
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Total Billed</p>
              <p className="text-2xl font-black text-[#2F3E4E]">${claimSummary.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Total Allowed</p>
              <p className="text-2xl font-black text-[#2F3E4E]">${claimSummary.totalAllowed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Total Paid</p>
              <p className="text-2xl font-black text-green-600">${claimSummary.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-[#7A8F79] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70 mb-1">Avg Rate per Hour</p>
              {claimSummary.avgPerHour !== null ? (
                <p className="text-2xl font-black text-[#2F3E4E]">${claimSummary.avgPerHour.toFixed(2)}</p>
              ) : (
                <p className="text-sm text-white/70 italic mt-1">No paid claims yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Worked Hours Summary */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-4">
          Worked Hours Summary
        </p>
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
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Year to Date</p>
            <p className="text-2xl font-black text-[#2F3E4E]">{hoursYTD}</p>
          </div>
          <div className="bg-[#F4F6F5] rounded-xl p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Waiting to be Billed</p>
            <p className="text-2xl font-black text-amber-600">{hoursUnbilled}</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        {/* Submit Hours form */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-[#2F3E4E] mb-4 pb-2 border-b border-[#D9E1E8]">
            Submit Hours
          </h2>

          <form onSubmit={submitTime} className="space-y-3">

            {/* Quick-fill buttons */}
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

            {/* Date + Hours side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Date Worked</label>
                <DateInput
                  ref={dateInputRef}
                  value={workDate}
                  onChange={setWorkDate}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Hours Worked</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  placeholder="e.g. 8"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  required
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Notes <span className="normal-case font-normal text-[#aab]">(optional)</span></label>
              <textarea
                placeholder="Any clarification needed..."
                value={notes}
                rows={3}
                onChange={(e) => setNotes(e.target.value)}
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

        {/* History panel */}
        <div className="bg-white rounded-xl shadow-sm p-6">
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
          <p className="text-xs text-[#7A8F79] mb-3 italic">To delete an entry line, check the box for that row.</p>

          {loadingHistory ? (
            <p className="text-sm text-[#7A8F79]">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-[#7A8F79] italic">No submissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                    <th className="py-2 pr-2 w-6">
                      <input
                        type="checkbox"
                        checked={entries.filter(e => !e.billed).length > 0 && selected.size === entries.filter(e => !e.billed).length}
                        onChange={toggleAll}
                        className="accent-[#7A8F79]"
                      />
                    </th>
                    <th className="text-left py-2 pr-4">Date</th>
                    <th className="text-right py-2 pr-4">Hours</th>
                    <th className="text-left py-2 pr-4">Notes</th>
                    <th className="text-left py-2">Claim Ref #</th>
                  </tr>
                </thead>
                <tbody>
                  {[...entries].sort((a, b) => new Date(a.workDate).getTime() - new Date(b.workDate).getTime()).map((entry, i) => (
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
                          <input
                            type="checkbox"
                            checked={selected.has(entry.id)}
                            onChange={() => toggleSelect(entry.id)}
                            className="accent-[#7A8F79]"
                          />
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
