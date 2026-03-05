'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type TimeEntry = {
  id: string
  workDate: string
  hours: number
  notes: string | null
  createdAt: string
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 border-t-4 border-[#7A8F79]">
      <span className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">{label}</span>
      <span className="text-3xl font-bold text-[#2F3E4E]">{value}</span>
    </div>
  )
}

export default function NurseDashboard() {
  const router = useRouter()
  const [workDate, setWorkDate] = useState('')
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [enrolledInBilling, setEnrolledInBilling] = useState<boolean | null>(null)

  function loadEntries() {
    fetch('/api/time-entry', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setEntries(data)
      })
      .finally(() => setLoadingHistory(false))
  }

  useEffect(() => {
    fetch('/api/nurse/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (!data.onboardingComplete) {
          router.replace('/nurse/onboarding')
        } else {
          setEnrolledInBilling((data.profile as any)?.enrolledInBilling ?? null)
          loadEntries()
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
      loadEntries()
    } else {
      setMessage(data.error || 'Error submitting hours.')
    }
  }

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()

  const hoursThisMonth = entries
    .filter(e => {
      const d = new Date(e.workDate)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    })
    .reduce((sum, e) => sum + e.hours, 0)

  const hoursAllTime = entries.reduce((sum, e) => sum + e.hours, 0)

  const monthName = now.toLocaleString('default', { month: 'long' })

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

      {/* Billing enrollment banner for opted-out nurses */}
      {enrolledInBilling === false && (
        <div className="bg-white border border-[#D9E1E8] rounded-xl p-5 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-[#2F3E4E] text-sm">Not enrolled in billing services</p>
            <p className="text-xs text-[#7A8F79] mt-0.5">
              You can enroll at any time — Coming Home Care will handle your insurance billing so you don't have to.
            </p>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/nurse/onboarding-reset', { method: 'POST', credentials: 'include' })
              router.push('/nurse/onboarding')
            }}
            className="shrink-0 bg-[#2F3E4E] text-white px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition text-sm font-semibold"
          >
            Enroll in Services
          </button>
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard label={`Hours in ${monthName}`} value={hoursThisMonth} />
        <StatCard label="Total Hours on Record" value={hoursAllTime} />
        <StatCard label="Submissions" value={entries.length} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        {/* Submit Hours form */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-[#2F3E4E] mb-4 pb-2 border-b border-[#D9E1E8]">
            Submit Hours
          </h2>

          <form onSubmit={submitTime} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Date Worked</label>
              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                required
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
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
          <h2 className="text-lg font-semibold text-[#2F3E4E] mb-4 pb-2 border-b border-[#D9E1E8]">
            Submission History
          </h2>

          {loadingHistory ? (
            <p className="text-sm text-[#7A8F79]">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-[#7A8F79] italic">No submissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                    <th className="text-left py-2 pr-4">Date</th>
                    <th className="text-right py-2 pr-4">Hours</th>
                    <th className="text-left py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-[#D9E1E8] last:border-0 ${i % 2 === 0 ? '' : 'bg-[#F4F6F5]'}`}
                    >
                      <td className="py-2 pr-4 text-[#2F3E4E] whitespace-nowrap">
                        {new Date(entry.workDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-2 pr-4 text-right font-semibold text-[#2F3E4E]">{entry.hours}</td>
                      <td className="py-2 text-[#7A8F79] italic text-xs">{entry.notes || '—'}</td>
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
