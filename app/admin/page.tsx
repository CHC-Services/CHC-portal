'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type TimeEntry = {
  id: string
  workDate: string
  hours: number
  notes: string | null
}

type Nurse = {
  id: string
  displayName: string
  accountNumber: string | null
  npiNumber: string | null
  user: { email: string; name: string }
  timeEntries: TimeEntry[]
}

function NurseRow({ nurse }: { nurse: Nurse }) {
  const [open, setOpen] = useState(false)

  const totalHours = nurse.timeEntries.reduce((sum, e) => sum + e.hours, 0)

  const now = new Date()
  const hoursThisMonth = nurse.timeEntries.filter(e => {
    const d = new Date(e.workDate)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((sum, e) => sum + e.hours, 0)

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-[#F4F6F5] transition"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#D9E1E8] flex items-center justify-center text-[#2F3E4E] font-bold text-sm">
            {nurse.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-[#2F3E4E]">{nurse.displayName}</p>
            <p className="text-xs text-[#7A8F79]">{nurse.user.email}</p>
            {nurse.accountNumber && (
              <p className="text-xs font-mono text-[#2F3E4E] mt-0.5">{nurse.accountNumber}</p>
            )}
            <Link
              href={`/admin/nurse/${nurse.id}`}
              onClick={e => e.stopPropagation()}
              className="text-xs text-[#7A8F79] underline underline-offset-2 hover:text-[#2F3E4E] mt-0.5 inline-block"
            >
              View Full Profile
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-[#7A8F79] uppercase tracking-wide">This Month</p>
            <p className="font-bold text-[#2F3E4E]">{hoursThisMonth} hrs</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-[#7A8F79] uppercase tracking-wide">All Time</p>
            <p className="font-bold text-[#2F3E4E]">{totalHours} hrs</p>
          </div>
          <span className="text-[#7A8F79] text-lg">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-[#D9E1E8] px-6 py-4">
          {nurse.timeEntries.length === 0 ? (
            <p className="text-sm text-[#7A8F79] italic">No hours submitted yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-right py-2 pr-4">Hours</th>
                  <th className="text-left py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {nurse.timeEntries.map((entry, i) => (
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
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState('')
  const [nurses, setNurses] = useState<Nurse[]>([])
  const [loadingNurses, setLoadingNurses] = useState(true)
  const [formOpen, setFormOpen] = useState(false)

  function loadNurses() {
    fetch('/api/admin/nurses', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setNurses(data) })
      .finally(() => setLoadingNurses(false))
  }

  useEffect(() => { loadNurses() }, [])

  async function createNurse(e: React.FormEvent) {
    e.preventDefault()

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, role: 'nurse', name, displayName })
    })

    const data = await res.json()

    if (res.ok) {
      setMessage('Nurse account created successfully.')
      setEmail('')
      setPassword('')
      setName('')
      setDisplayName('')
      setFormOpen(false)
      loadNurses()
    } else {
      setMessage(data.error || 'Error creating nurse.')
    }
  }

  const totalHoursThisMonth = nurses.reduce((sum, nurse) => {
    const now = new Date()
    return sum + nurse.timeEntries.filter(e => {
      const d = new Date(e.workDate)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).reduce((s, e) => s + e.hours, 0)
  }, 0)

  const now = new Date()
  const monthName = now.toLocaleString('default', { month: 'long' })

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#2F3E4E]">Admin Dashboard</h1>
          <p className="text-sm text-[#7A8F79] mt-1">
            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setFormOpen(!formOpen)}
          className="bg-[#2F3E4E] text-white px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition text-sm font-semibold"
        >
          {formOpen ? 'Cancel' : '+ Add Nurse'}
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 border-t-4 border-[#7A8F79]">
          <span className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Active Nurses</span>
          <span className="text-3xl font-bold text-[#2F3E4E]">{nurses.length}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 border-t-4 border-[#7A8F79]">
          <span className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">{monthName} Hours</span>
          <span className="text-3xl font-bold text-[#2F3E4E]">{totalHoursThisMonth}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 border-t-4 border-[#7A8F79]">
          <span className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Total Submissions</span>
          <span className="text-3xl font-bold text-[#2F3E4E]">{nurses.reduce((s, n) => s + n.timeEntries.length, 0)}</span>
        </div>
      </div>

      {/* Create nurse form (collapsible) */}
      {formOpen && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 max-w-lg">
          <h2 className="text-lg font-semibold text-[#2F3E4E] mb-4 pb-2 border-b border-[#D9E1E8]">
            Create Nurse Account
          </h2>
          <form onSubmit={createNurse} className="space-y-3">
            <input
              type="text"
              placeholder="Internal Name (admin-visible)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            />
            <input
              type="text"
              placeholder="Display Name (nurse-visible)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            />
            <input
              type="email"
              placeholder="Nurse Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            />
            <input
              type="password"
              placeholder="Temporary Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            />
            <button
              type="submit"
              className="w-full bg-[#2F3E4E] text-white py-2 rounded-lg hover:bg-[#7A8F79] transition font-semibold"
            >
              Create Nurse
            </button>
          </form>
          {message && (
            <p className={`mt-3 text-sm text-center font-medium ${message.includes('Error') || message.includes('error') ? 'text-red-500' : 'text-[#7A8F79]'}`}>
              {message}
            </p>
          )}
        </div>
      )}

      {/* Nurse Roster */}
      <div>
        <h2 className="text-lg font-semibold text-[#2F3E4E] mb-3">
          Nurse Roster
          <span className="ml-2 text-sm font-normal text-[#7A8F79]">— click a nurse to expand their hours</span>
        </h2>

        {loadingNurses ? (
          <p className="text-sm text-[#7A8F79]">Loading nurses…</p>
        ) : nurses.length === 0 ? (
          <p className="text-sm text-[#7A8F79] italic">No nurses on record yet.</p>
        ) : (
          <div className="space-y-3">
            {nurses.map(nurse => (
              <NurseRow key={nurse.id} nurse={nurse} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
