'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AdminNav from '../components/AdminNav'

type TimeEntry = {
  id: string
  workDate: string
  hours: number
  notes: string | null
  invoiceId: string | null
  readyToInvoice: boolean
  billed: boolean
}

type Nurse = {
  id: string
  displayName: string
  firstName: string | null
  lastName: string | null
  middleInitial: string | null
  accountNumber: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  // encrypted fields — truthy means "on file", never display raw value
  npiNumber: string | null
  medicaidNumber: string | null
  dob: string | null
  ssn: string | null
  etin: string | null
  epacesUserId: string | null
  // business entity
  hasBusinessProvider: boolean | null
  bizNpi: string | null
  bizNpiType: string | null
  bizMedicaidId: string | null
  bizEntityName: string | null
  bizServiceAddress: string | null
  bizCity: string | null
  bizState: string | null
  bizZip: string | null
  bizPhone: string | null
  bizEmail: string | null
  ein: string | null
  fein: string | null
  invoiceBalance: number
  totalInvoiced: number
  totalPaid: number
  isDemo: boolean
  signupRole: string | null
  user: { id: string; email: string; name: string; role: string; createdAt: string }
  timeEntries: TimeEntry[]
}

function PendingRequestRow({ nurse, onApprove, onDeny }: { nurse: Nurse; onApprove: () => void; onDeny: () => void }) {
  const [confirmDeny, setConfirmDeny] = useState(false)
  const [acting, setActing] = useState(false)

  async function handleApprove() {
    setActing(true)
    await onApprove()
  }

  async function handleDeny() {
    setActing(true)
    await onDeny()
  }

  const joinedDate = new Date(nurse.user.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  const roleColor: Record<string, string> = {
    'Nurse': 'bg-blue-100 text-blue-700',
    'Patient': 'bg-purple-100 text-purple-700',
    'Billing Service': 'bg-yellow-100 text-yellow-700',
    'Other': 'bg-gray-100 text-gray-600',
  }
  const badgeClass = nurse.signupRole ? (roleColor[nurse.signupRole] ?? 'bg-gray-100 text-gray-600') : 'bg-gray-100 text-gray-400'

  return (
    <div className="bg-white rounded-xl shadow-sm border-l-4 border-orange-400 px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-[#2F3E4E]">{nurse.user.name}</p>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>
            {nurse.signupRole ?? 'No type selected'}
          </span>
        </div>
        <p className="text-xs text-[#7A8F79] mt-0.5">{nurse.user.email}</p>
        {nurse.user.createdAt && (
          <p className="text-xs text-[#7A8F79] mt-0.5">Requested {joinedDate}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {confirmDeny ? (
          <>
            <p className="text-xs text-red-600 font-semibold mr-1">Remove this account?</p>
            <button
              onClick={() => setConfirmDeny(false)}
              className="text-xs border border-[#D9E1E8] text-[#7A8F79] px-3 py-1.5 rounded-lg hover:bg-[#F4F6F5] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleDeny}
              disabled={acting}
              className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
            >
              {acting ? 'Removing…' : 'Yes, Remove'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleApprove}
              disabled={acting}
              className="text-xs bg-[#7A8F79] text-white px-4 py-1.5 rounded-lg font-semibold hover:bg-[#2F3E4E] transition disabled:opacity-50"
            >
              {acting ? 'Approving…' : 'Approve'}
            </button>
            <button
              onClick={() => setConfirmDeny(true)}
              disabled={acting}
              className="text-xs border border-red-300 text-red-500 px-4 py-1.5 rounded-lg font-semibold hover:bg-red-50 transition disabled:opacity-50"
            >
              Deny
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function InfoField({ label, value, sensitive }: { label: string; value: string | null | undefined; sensitive?: boolean }) {
  const display = value
    ? sensitive ? '●●●●●●' : value
    : '—'
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">{label}</p>
      <p className={`text-sm ${value ? 'text-[#2F3E4E]' : 'text-[#aab]'}`}>{display}</p>
    </div>
  )
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

  const unbilledHours = nurse.timeEntries
    .filter(e => !e.billed)
    .reduce((sum, e) => sum + e.hours, 0)

  const displayName = nurse.lastName && nurse.firstName
    ? `${nurse.lastName}, ${nurse.firstName}`
    : nurse.displayName

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-5 py-2.5 flex items-center justify-between hover:bg-[#F4F6F5] transition"
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <div className="w-9 h-9 rounded-full bg-[#D9E1E8] flex items-center justify-center text-[#2F3E4E] font-bold text-sm">
              {nurse.displayName.charAt(0).toUpperCase()}
            </div>
            <Link
              href={`/admin/nurse/${nurse.id}`}
              onClick={e => e.stopPropagation()}
              className="text-[10px] text-[#7A8F79] underline underline-offset-1 hover:text-[#2F3E4E] leading-tight"
            >
              View Profile
            </Link>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-[#2F3E4E] text-sm leading-tight">{displayName}</p>
              {nurse.accountNumber && (
                <span className="text-[11px] font-mono text-[#7A8F79]">{nurse.accountNumber}</span>
              )}
              {nurse.isDemo && (
                <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full">Demo</span>
              )}
            </div>
            <p className="text-xs text-[#7A8F79] leading-tight">{nurse.user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-[#7A8F79] uppercase tracking-wide">Invoiced</p>
            <p className="font-bold text-[#2F3E4E] text-sm">${(nurse.totalInvoiced || 0).toFixed(2)}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-[#7A8F79] uppercase tracking-wide">Paid</p>
            <p className="font-bold text-green-600 text-sm">${(nurse.totalPaid || 0).toFixed(2)}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-[#7A8F79] uppercase tracking-wide">Balance</p>
            <p className={`font-bold text-sm ${nurse.invoiceBalance > 0 ? 'text-red-500' : 'text-[#7A8F79]'}`}>
              ${(nurse.invoiceBalance || 0).toFixed(2)}
            </p>
          </div>
          {/* Fading vertical divider */}
          <div className="hidden sm:block w-px h-8 shrink-0" style={{ background: 'linear-gradient(to bottom, transparent, #D9E1E8 30%, #D9E1E8 70%, transparent)' }} />
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-[#7A8F79] uppercase tracking-wide">Unbilled</p>
            <p className={`font-bold text-sm ${unbilledHours > 0 ? 'text-orange-500' : 'text-[#7A8F79]'}`}>{unbilledHours} hrs</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-[#7A8F79] uppercase tracking-wide">This Month</p>
            <p className="font-bold text-sm text-[#2F3E4E]">{hoursThisMonth} hrs</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-[#7A8F79] uppercase tracking-wide">All Time</p>
            <p className="font-bold text-sm text-[#2F3E4E]">{totalHours} hrs</p>
          </div>
          <span className="text-[#7A8F79] text-lg">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-[#D9E1E8] px-6 py-5">
          <div className={`grid gap-6 ${nurse.hasBusinessProvider ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-md'}`}>

            {/* ── Left: Individual Provider Info ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] border-b border-[#D9E1E8] pb-1">Individual Provider Information</p>

              <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
                <InfoField label="First Name" value={nurse.firstName} />
                <InfoField label="MI" value={nurse.middleInitial} />
                <InfoField label="Last Name" value={nurse.lastName} />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <InfoField label="Phone" value={nurse.phone} />
                <InfoField label="Email" value={nurse.user.email} />
              </div>
              <InfoField label="Address" value={nurse.address} />
              <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
                <InfoField label="City" value={nurse.city} />
                <InfoField label="State" value={nurse.state} />
                <InfoField label="ZIP" value={nurse.zip} />
              </div>
              {nurse.displayName && nurse.displayName !== nurse.firstName && (
                <InfoField label="Preferred Name" value={nurse.displayName} />
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <InfoField label="Date of Birth" value={nurse.dob} sensitive />
                <InfoField label="SSN" value={nurse.ssn} sensitive />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <InfoField label="NPI (Individual)" value={nurse.npiNumber} sensitive />
                <InfoField label="Medicaid ID" value={nurse.medicaidNumber} sensitive />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <InfoField label="ETIN" value={nurse.etin} />
                <InfoField label="ePaces User ID" value={nurse.epacesUserId} />
              </div>
            </div>

            {/* ── Right: Business Provider Info (only if checked) ── */}
            {nurse.hasBusinessProvider && (
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] border-b border-[#D9E1E8] pb-1">Business Provider Information</p>

                <InfoField label="Entity Name" value={nurse.bizEntityName} />
                <InfoField label="Service Address" value={nurse.bizServiceAddress} />
                <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
                  <InfoField label="City" value={nurse.bizCity} />
                  <InfoField label="State" value={nurse.bizState} />
                  <InfoField label="ZIP" value={nurse.bizZip} />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <InfoField label="Business Phone" value={nurse.bizPhone} />
                  <InfoField label="Business Email" value={nurse.bizEmail} />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <InfoField label="Business NPI" value={nurse.bizNpi} />
                  <InfoField label="NPI Type" value={nurse.bizNpiType} />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <InfoField label="Business Medicaid ID" value={nurse.bizMedicaidId} />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <InfoField label="EIN" value={nurse.ein} sensitive />
                  <InfoField label="FEIN" value={nurse.fein} sensitive />
                </div>
              </div>
            )}
          </div>

          {/* Delete nurse */}
          <div className="mt-5 pt-4 border-t border-[#D9E1E8]">
            {confirmDelete ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2 max-w-sm">
                <p className="text-sm text-red-700 font-semibold">Permanently delete {displayName}? This cannot be undone.</p>
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

  const pendingNurses = nurses.filter(n => n.user.role === 'provider')
  const activeNurses = nurses.filter(n => n.user.role !== 'provider')
  const liveNurses = activeNurses.filter(n => !n.isDemo)
  const demoNurses = activeNurses.filter(n => n.isDemo)
  const billableNurses = liveNurses

  async function approveRequest(userId: string, nurseId: string) {
    await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role: 'nurse' }),
    })
    loadNurses()
  }

  async function denyRequest(nurseId: string) {
    await fetch(`/api/admin/nurses/${nurseId}`, { method: 'DELETE', credentials: 'include' })
    loadNurses()
  }

  const totalHoursThisMonth = billableNurses.reduce((sum, nurse) => {
    const now = new Date()
    return sum + nurse.timeEntries.filter(e => {
      const d = new Date(e.workDate)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).reduce((s, e) => s + e.hours, 0)
  }, 0)

  const now = new Date()
  const monthName = now.toLocaleString('default', { month: 'long' })

  const totalEntries = billableNurses.reduce((s, n) => s + n.timeEntries.length, 0)
  const entriesThisMonth = billableNurses.reduce((sum, nurse) => {
    return sum + nurse.timeEntries.filter(e => {
      const d = new Date(e.workDate)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
  }, 0)

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <AdminNav />

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-[#2F3E4E]"><span className="text-[#7A8F79] italic">ad</span>Roster</h1>
          <p className="text-sm text-[#7A8F79] mt-1">
            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          href="/admin/enrollment"
          className="text-xs font-semibold text-[#7A8F79] border border-[#D9E1E8] rounded-lg px-3 py-1.5 hover:border-[#7A8F79] hover:text-[#2F3E4E] transition whitespace-nowrap"
        >
          Billing Enrollment →
        </Link>
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
          <span className="font-semibold text-[#2F3E4E] group-hover:text-[#7A8F79] transition">Billing</span>
          <span className="text-xs text-[#7A8F79]">Hours, invoices & campaigns</span>
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
          <span className="text-3xl font-bold text-[#2F3E4E]">{activeNurses.length}</span>
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

      {/* Pending Access Requests */}
      {pendingNurses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-[#2F3E4E] mb-3 flex items-center gap-2">
            Pending Access Requests
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold">
              {pendingNurses.length}
            </span>
          </h2>
          <div className="space-y-3">
            {pendingNurses.map(nurse => (
              <PendingRequestRow
                key={nurse.id}
                nurse={nurse}
                onApprove={() => approveRequest(nurse.user.id, nurse.id)}
                onDeny={() => denyRequest(nurse.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Nurse Roster */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-[#2F3E4E]">
            Nurse Roster
            <span className="ml-2 text-sm font-normal text-[#7A8F79]">— click a nurse to view their profile</span>
          </h2>
          <a
            href="/api/admin/reports/time-matrix"
            download="CHC-Time-Report-2026.xlsx"
            className="flex items-center gap-2 bg-[#2F3E4E] hover:bg-[#7A8F79] text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Jan–Apr 2026
          </a>
        </div>

        {loadingNurses ? (
          <p className="text-sm text-[#7A8F79]">Loading nurses…</p>
        ) : liveNurses.length === 0 ? (
          <p className="text-sm text-[#7A8F79] italic">No nurses on record yet.</p>
        ) : (
          <div className="space-y-3">
            {liveNurses.map(nurse => (
              <NurseRow key={nurse.id} nurse={nurse} onDeleted={loadNurses} />
            ))}
          </div>
        )}

        {demoNurses.length > 0 && (
          <details className="mt-6">
            <summary className="cursor-pointer text-xs font-semibold text-[#7A8F79] uppercase tracking-widest hover:text-[#2F3E4E] transition select-none">
              Demo Accounts ({demoNurses.length})
            </summary>
            <div className="space-y-3 mt-3">
              {demoNurses.map(nurse => (
                <NurseRow key={nurse.id} nurse={nurse} onDeleted={loadNurses} />
              ))}
            </div>
          </details>
        )}
      </div>

    </div>
  )
}
