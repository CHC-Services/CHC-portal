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

function NurseRow({ nurse, onDeleted }: { nurse: Nurse; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/admin/nurses/${nurse.id}`, { method: 'DELETE', credentials: 'include' })
    onDeleted()
  }

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

      const text = await res.text()
      let data: Record<string, unknown>
      try { data = JSON.parse(text) } catch { throw new Error(`Server error (${res.status}): ${text.slice(0, 200)}`) }

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
        setMessage(`Nurse account created successfully. A welcome email has been sent to ${data.email}.`)
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

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#2F3E4E]">Admin Dashboard</h1>
          <p className="text-sm text-[#7A8F79] mt-1">
            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <div className="flex gap-4 mt-2">
            <Link href="/admin/claims" className="text-sm text-[#7A8F79] underline underline-offset-2 hover:text-[#2F3E4E]">
              View Claims →
            </Link>
            <Link href="/admin/billing" className="text-sm text-[#7A8F79] underline underline-offset-2 hover:text-[#2F3E4E]">
              Billing Summary →
            </Link>
          </div>
        </div>
        <button
          onClick={() => { setFormOpen(!formOpen); setMessage('') }}
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
              <NurseRow key={nurse.id} nurse={nurse} onDeleted={loadNurses} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
