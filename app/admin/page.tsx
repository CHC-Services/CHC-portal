'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import AdminNav from '../components/AdminNav'
import { DateInput, DateInputHandle } from '../components/DateInput'
import FaqEditorSection from '../components/FaqEditorSection'

type TimeEntry = {
  id: string
  workDate: string
  hours: number
  notes: string | null
  invoiceId: string | null
}

type Nurse = {
  id: string
  displayName: string
  accountNumber: string | null
  npiNumber: string | null
  invoiceBalance: number
  user: { email: string; name: string }
  timeEntries: TimeEntry[]
}

function NurseRow({ nurse, onDeleted, onRefresh }: { nurse: Nurse; onDeleted: () => void; onRefresh: () => void }) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [logDate, setLogDate] = useState('')
  const logDateRef = useRef<DateInputHandle>(null)
  const [logHours, setLogHours] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [logMessage, setLogMessage] = useState('')
  const [logSubmitting, setLogSubmitting] = useState(false)
  const [deletingEntry, setDeletingEntry] = useState<string | null>(null)

  async function submitHours(e: React.FormEvent) {
    e.preventDefault()
    setLogSubmitting(true)
    setLogMessage('')
    const res = await fetch('/api/admin/time-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nurseId: nurse.id, workDate: logDate, hours: logHours, notes: logNotes })
    })
    const data = await res.json()
    setLogSubmitting(false)
    if (res.ok) {
      setLogDate('')
      setLogHours('')
      setLogNotes('')
      setLogMessage('Hours logged.')
      onRefresh()
      requestAnimationFrame(() => logDateRef.current?.focus())
    } else {
      setLogMessage(data.error || 'Error logging hours.')
    }
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/admin/nurses/${nurse.id}`, { method: 'DELETE', credentials: 'include' })
    onDeleted()
  }

  async function deleteEntry(entryId: string) {
    setDeletingEntry(entryId)
    const res = await fetch('/api/admin/time-entry', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id: entryId }),
    })
    setDeletingEntry(null)
    if (res.ok) onRefresh()
  }

  const totalHours = nurse.timeEntries.reduce((sum, e) => sum + e.hours, 0)

  const now = new Date()
  const hoursThisMonth = nurse.timeEntries.filter(e => {
    const d = new Date(e.workDate)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((sum, e) => sum + e.hours, 0)

  const unbilledHours = nurse.timeEntries
    .filter(e => !e.invoiceId)
    .reduce((sum, e) => sum + e.hours, 0)

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
            <p className="text-xs text-[#7A8F79] uppercase tracking-wide">Balance</p>
            <p className={`font-bold ${nurse.invoiceBalance > 0 ? 'text-red-500' : 'text-[#7A8F79]'}`}>
              ${(nurse.invoiceBalance || 0).toFixed(2)}
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-[#7A8F79] uppercase tracking-wide">Unbilled</p>
            <p className={`font-bold ${unbilledHours > 0 ? 'text-orange-500' : 'text-[#7A8F79]'}`}>{unbilledHours} hrs</p>
          </div>
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
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {nurse.timeEntries.map((entry, i) => (
                  <tr
                    key={entry.id}
                    className={`border-b border-[#D9E1E8] last:border-0 ${i % 2 === 0 ? '' : 'bg-[#F4F6F5]'}`}
                  >
                    <td className="py-2 pr-4 text-[#2F3E4E] whitespace-nowrap">
                      {new Date(entry.workDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold text-[#2F3E4E]">{entry.hours}</td>
                    <td className="py-2 text-[#2F3E4E] italic text-xs">{entry.notes || '—'}</td>
                    <td className="py-2 pl-2">
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        disabled={deletingEntry === entry.id}
                        title="Delete entry"
                        className="text-red-400 hover:text-red-600 transition disabled:opacity-40"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Log hours on behalf of nurse */}
          <div className="mt-4 pt-4 border-t border-[#D9E1E8]">
            <button
              onClick={() => { setLogOpen(!logOpen); setLogMessage('') }}
              className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] underline underline-offset-2"
            >
              {logOpen ? 'Cancel' : '+ Log hours on behalf of this nurse'}
            </button>
            {logOpen && (
              <form onSubmit={submitHours} className="mt-3 space-y-2 max-w-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Date Worked</label>
                    <DateInput
                      ref={logDateRef}
                      value={logDate}
                      onChange={setLogDate}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Hours</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 8"
                      value={logHours}
                      onChange={e => setLogHours(e.target.value)}
                      required
                      className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] text-sm focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={logNotes}
                  onChange={e => setLogNotes(e.target.value)}
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] text-sm focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
                <button
                  type="submit"
                  disabled={logSubmitting}
                  className="bg-[#2F3E4E] text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
                >
                  {logSubmitting ? 'Saving…' : 'Log Hours'}
                </button>
                {logMessage && (
                  <p className={`text-xs font-medium ${logMessage.includes('Error') || logMessage.includes('already') ? 'text-red-500' : 'text-[#7A8F79]'}`}>
                    {logMessage}
                  </p>
                )}
              </form>
            )}
          </div>

          {/* Delete nurse */}
          <div className="mt-4 pt-4 border-t border-[#D9E1E8]">
            {confirmDelete ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                <p className="text-sm text-red-700 font-semibold">Permanently delete {nurse.displayName}? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-1.5 rounded text-sm font-semibold">Cancel</button>
                  <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 text-white py-1.5 rounded text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                    {deleting ? 'Deleting…' : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2">
                Delete this nurse
              </button>
            )}
          </div>
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
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [npiNumber, setNpiNumber] = useState('')
  const [medicaidNumber, setMedicaidNumber] = useState('')
  const [bcbsPayorId, setBcbsPayorId] = useState('')
  const [message, setMessage] = useState('')
  const [messageIsError, setMessageIsError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
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
    setSubmitting(true)
    setMessage('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, role: 'nurse', name, displayName })
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any
      try { data = await res.json() } catch { throw new Error(`Server error (${res.status})`) }

      if (res.ok) {
        // Patch extra profile fields if any were filled in
        const profileId = data.nurseProfile?.id
        if (profileId && (firstName || lastName || phone || dob || npiNumber || medicaidNumber || bcbsPayorId)) {
          await fetch(`/api/admin/nurses/${profileId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ firstName, lastName, phone, dob, npiNumber, medicaidNumber, bcbsPayorId })
          })
        }
        setEmail(''); setPassword(''); setName(''); setDisplayName('')
        setFirstName(''); setLastName(''); setPhone(''); setDob('')
        setNpiNumber(''); setMedicaidNumber(''); setBcbsPayorId('')
        setFormOpen(false)
        setMessageIsError(false)
        setMessage(`Nurse account created successfully for ${data.email}.`)
        loadNurses()
      } else {
        setMessageIsError(true)
        setMessage(data.error || 'Error creating nurse.')
      }
    } catch (err: unknown) {
      setMessageIsError(true)
      setMessage('Error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSubmitting(false)
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

  const totalEntries = nurses.reduce((s, n) => s + n.timeEntries.length, 0)
  const entriesThisMonth = nurses.reduce((sum, nurse) => {
    return sum + nurse.timeEntries.filter(e => {
      const d = new Date(e.workDate)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
  }, 0)

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <AdminNav />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#2F3E4E]"><span className="text-[#7A8F79] italic">ad</span>Roster</h1>
        <p className="text-sm text-[#7A8F79] mt-1">
          {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Link
          href="/admin/claims"
          className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition group"
        >
          <span className="text-2xl">📄</span>
          <span className="font-semibold text-[#2F3E4E] group-hover:text-[#7A8F79] transition">Claims</span>
          <span className="text-xs text-[#7A8F79]">Import & manage insurance claims</span>
        </Link>
        <Link
          href="/admin/billing"
          className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition group"
        >
          <span className="text-2xl">💳</span>
          <span className="font-semibold text-[#2F3E4E] group-hover:text-[#7A8F79] transition">Billing Summary</span>
          <span className="text-xs text-[#7A8F79]">Enrollment status & billing plans</span>
        </Link>
        <Link
          href="/admin/calendar"
          className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition group"
        >
          <span className="text-2xl">📅</span>
          <span className="font-semibold text-[#2F3E4E] group-hover:text-[#7A8F79] transition">Calendar</span>
          <span className="text-xs text-[#7A8F79]">Events, deadlines & reminders</span>
        </Link>
        <button
          onClick={() => { setFormOpen(!formOpen); setMessage('') }}
          className="bg-[#2F3E4E] text-white rounded-xl shadow-sm p-5 flex flex-col gap-2 hover:bg-[#3d5166] transition text-left"
        >
          <span className="text-2xl">➕</span>
          <span className="font-semibold">{formOpen ? 'Cancel' : 'Add Provider'}</span>
          <span className="text-xs text-[#D9E1E8]">Create a new provider account</span>
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 border-t-4 border-[#7A8F79]">
          <span className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Active Providers</span>
          <span className="text-3xl font-bold text-[#2F3E4E]">{nurses.length}</span>
          <span className="text-xs text-[#7A8F79]">registered accounts</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 border-t-4 border-[#7A8F79]">
          <span className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">{monthName} Hours</span>
          <span className="text-3xl font-bold text-[#2F3E4E]">{totalHoursThisMonth}</span>
          <span className="text-xs text-[#7A8F79]">hours worked this month</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 border-t-4 border-[#7A8F79]">
          <span className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">{monthName} Submissions</span>
          <span className="text-3xl font-bold text-[#2F3E4E]">{entriesThisMonth}</span>
          <span className="text-xs text-[#7A8F79]">time entries logged this month</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1 border-t-4 border-[#7A8F79]">
          <span className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">All-Time Entries</span>
          <span className="text-3xl font-bold text-[#2F3E4E]">{totalEntries}</span>
          <span className="text-xs text-[#7A8F79]">total time entry records</span>
        </div>
      </div>

      {/* Create nurse form (collapsible) */}
      {formOpen && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 max-w-lg">
          <h2 className="text-lg font-semibold text-[#2F3E4E] mb-4 pb-2 border-b border-[#D9E1E8]">
            Create Nurse Account
          </h2>
          <form onSubmit={createNurse} className="space-y-3">
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold pt-1">Account</p>
            <input type="text" placeholder="Internal Name (admin-visible)" value={name} onChange={e => setName(e.target.value)} required className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
            <input type="text" placeholder="Display Name (nurse-visible)" value={displayName} onChange={e => setDisplayName(e.target.value)} required className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
            <input type="email" placeholder="Nurse Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
            <input type="password" placeholder="Temporary Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />

            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold pt-2">Provider Info <span className="normal-case font-normal">(optional — can be filled in later)</span></p>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} className="border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
              <input type="text" placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} className="border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} className="border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
              <input type="text" placeholder="Date of Birth" value={dob} onChange={e => setDob(e.target.value)} className="border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
            </div>
            <input type="text" placeholder="NPI Number" value={npiNumber} onChange={e => setNpiNumber(e.target.value)} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
            <input type="text" placeholder="Medicaid Number" value={medicaidNumber} onChange={e => setMedicaidNumber(e.target.value)} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
            <input type="text" placeholder="BCBS Payor ID" value={bcbsPayorId} onChange={e => setBcbsPayorId(e.target.value)} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#2F3E4E] text-white py-2 rounded-lg hover:bg-[#7A8F79] transition font-semibold disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create Nurse'}
            </button>
          </form>
          {/* Error shown inside the form while it's open */}
          {message && messageIsError && (
            <p className="mt-3 text-sm text-center font-medium text-red-500">{message}</p>
          )}
        </div>
      )}

      {/* Success banner — outside the form so it persists after the form closes */}
      {message && !messageIsError && (
        <div className="mb-6 max-w-lg px-4 py-3 rounded-xl text-sm font-medium bg-[#f0f4f0] text-[#2F3E4E] border border-[#7A8F79]">
          {message}
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
              <NurseRow key={nurse.id} nurse={nurse} onDeleted={loadNurses} onRefresh={loadNurses} />
            ))}
          </div>
        )}
      </div>

      {/* FAQ Manager */}
      <div className="mt-8">
        <FaqEditorSection />
      </div>
    </div>
  )
}
