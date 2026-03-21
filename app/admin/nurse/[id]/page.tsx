'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Profile = Record<string, any>

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8]">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Field({
  label,
  field,
  profile,
  setProfile,
  type = 'text',
  sensitive = false,
}: {
  label: string
  field: string
  profile: Profile
  setProfile: (p: Profile) => void
  type?: string
  sensitive?: boolean
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">
        {label}
        {sensitive && (
          <span className="ml-2 text-[10px] normal-case font-normal bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">
            encrypted
          </span>
        )}
      </label>
      <div className="relative">
        <input
          type={sensitive && !show ? 'password' : type}
          value={profile[field] || ''}
          onChange={(e) => setProfile({ ...profile, [field]: e.target.value })}
          className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] pr-16"
        />
        {sensitive && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#7A8F79] hover:text-[#2F3E4E]"
          >
            {show ? 'hide' : 'show'}
          </button>
        )}
      </div>
    </div>
  )
}

function AliasEditor({ aliases, onChange }: { aliases: string[]; onChange: (a: string[]) => void }) {
  const [input, setInput] = useState('')

  function add() {
    const val = input.trim()
    if (!val || aliases.includes(val)) return
    onChange([...aliases, val])
    setInput('')
  }

  function remove(alias: string) {
    onChange(aliases.filter(a => a !== alias))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 min-h-[2rem]">
        {aliases.length === 0 && (
          <span className="text-xs text-[#7A8F79] italic">No aliases set — this provider will see no claims.</span>
        )}
        {aliases.map(alias => (
          <span key={alias} className="flex items-center gap-1.5 bg-[#D9E1E8] text-[#2F3E4E] text-sm font-semibold px-3 py-1 rounded-full">
            {alias}
            <button
              type="button"
              onClick={() => remove(alias)}
              className="text-[#7A8F79] hover:text-red-500 transition text-base leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="e.g. Janine or JCST"
          className="flex-1 border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
        />
        <button
          type="button"
          onClick={add}
          className="bg-[#7A8F79] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2F3E4E] transition"
        >
          Add
        </button>
      </div>
    </div>
  )
}

const ROLE_OPTIONS = [
  { value: 'nurse',    label: 'Nurse — Healthcare caregiver' },
  { value: 'biller',   label: 'Biller — Third-party billing access' },
  { value: 'provider', label: 'Provider — Other medical provider' },
  { value: 'guardian', label: 'Guardian — Parent / family member' },
  { value: 'admin',    label: 'Admin — Full portal access' },
]

const FEE_PLANS = [
  { value: 'A1', label: 'A1 — Medicaid Single Payer', amount: 2.00 },
  { value: 'A2', label: 'A2 — Commercial Single Payer', amount: 3.00 },
  { value: 'B',  label: 'B — Dual Payer', amount: 4.00 },
  { value: 'C',  label: 'C — 3+ Payer', amount: 6.00 },
]

type TimeEntry = {
  id: string
  workDate: string
  hours: number
  notes?: string
  billed: boolean
  readyToInvoice: boolean
  invoiceFeePlan?: string
  invoiceFeeAmt?: number
  invoiceId?: string
  invoice?: { invoiceNumber: string; status: string }
  claimRef?: string
}

export default function NurseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [profile, setProfile] = useState<Profile>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [userRole, setUserRole] = useState('')
  const [roleSaving, setRoleSaving] = useState(false)
  const [roleMessage, setRoleMessage] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const [notifEnabled, setNotifEnabled] = useState(true)
  const [notifSaving, setNotifSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState('')

  // Time entries + invoicing
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [claimRefs, setClaimRefs] = useState<Record<string, string>>({})
  const [deletingEntry, setDeletingEntry] = useState<string | null>(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceDueTerm, setInvoiceDueTerm] = useState('30')
  const [invoiceNotes, setInvoiceNotes] = useState('')
  const [invoiceSending, setInvoiceSending] = useState(false)
  const [invoiceMessage, setInvoiceMessage] = useState('')

  useEffect(() => {
    fetch(`/api/admin/nurses/${id}`, { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return }
        return r.json()
      })
      .then(data => {
        if (data) {
          setProfile(data)
          setUserRole(data.user?.role || 'nurse')
          setNotifEnabled(data.receiveNotifications !== false)
        }
      })
      .finally(() => setLoading(false))

    fetch(`/api/admin/time-entry?nurseId=${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEntries(data)
          const refs: Record<string, string> = {}
          data.forEach((e: TimeEntry) => { refs[e.id] = e.claimRef || '' })
          setClaimRefs(refs)
        }
      })
  }, [id, router])

  async function toggleInvoiceFlag(entry: TimeEntry, checked: boolean, feePlan?: string) {
    const plan = feePlan ?? entry.invoiceFeePlan ?? 'A1'
    const res = await fetch(`/api/admin/time-entry/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ readyToInvoice: checked, invoiceFeePlan: checked ? plan : null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, ...updated } : e))
    }
  }

  async function saveClaimRef(entryId: string, ref: string) {
    const res = await fetch(`/api/admin/time-entry/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ claimRef: ref }),
    })
    if (res.ok) {
      const updated = await res.json()
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, claimRef: updated.claimRef } : e))
    }
  }

  async function deleteEntry(entryId: string) {
    if (!confirm('Delete this time entry? This cannot be undone.')) return
    setDeletingEntry(entryId)
    const res = await fetch('/api/admin/time-entry', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id: entryId }),
    })
    setDeletingEntry(null)
    if (res.ok) {
      setEntries(prev => prev.filter(e => e.id !== entryId))
    } else {
      const d = await res.json()
      alert(d.error || 'Failed to delete entry.')
    }
  }

  async function createInvoice() {
    setInvoiceSending(true)
    setInvoiceMessage('')
    const res = await fetch('/api/admin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nurseId: id, dueTerm: invoiceDueTerm, notes: invoiceNotes }),
    })
    const data = await res.json()
    setInvoiceSending(false)
    if (res.ok) {
      setInvoiceMessage(`Invoice ${data.invoiceNumber} sent successfully.`)
      setShowInvoiceModal(false)
      setInvoiceNotes('')
      // Refresh entries
      fetch(`/api/admin/time-entry?nurseId=${id}`, { credentials: 'include' })
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setEntries(d) })
    } else {
      setInvoiceMessage(data.error || 'Failed to create invoice.')
    }
  }

  const pendingEntries = entries.filter(e => e.readyToInvoice && !e.invoiceId)
  const pendingTotal = pendingEntries.reduce((s, e) => s + (e.invoiceFeeAmt ?? 0), 0)

  async function saveRole() {
    setRoleSaving(true)
    setRoleMessage('')
    const res = await fetch(`/api/admin/users/${profile.userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role: userRole }),
    })
    setRoleSaving(false)
    setRoleMessage(res.ok ? 'Role updated.' : 'Error updating role.')
  }

  async function resendInvite() {
    if (!confirm(`This will reset ${profile.displayName}'s password and send them a new login email. Continue?`)) return
    setInviteSending(true)
    setInviteMessage('')
    const res = await fetch(`/api/admin/nurses/${id}/resend-invite`, {
      method: 'POST',
      credentials: 'include',
    })
    const data = await res.json()
    setInviteSending(false)
    setInviteMessage(res.ok
      ? `Invite resent to ${data.email}. Their password has been reset.`
      : data.error || 'Failed to send invite.')
  }

  async function setPassword() {
    if (!newPassword.trim()) return
    setPwSaving(true)
    setPwMessage('')
    const res = await fetch(`/api/admin/nurses/${id}/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password: newPassword }),
    })
    setPwSaving(false)
    if (res.ok) {
      setPwMessage('Password updated successfully.')
      setNewPassword('')
    } else {
      setPwMessage('Error updating password.')
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const res = await fetch(`/api/admin/nurses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profile)
    })

    setSaving(false)
    setMessage(res.ok ? 'Saved successfully.' : 'Error saving.')
  }

  if (loading) return <div className="p-8 text-[#7A8F79]">Loading…</div>

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin" className="text-[#7A8F79] hover:text-[#2F3E4E] text-sm">
          ← Back to Roster
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-[#2F3E4E]">{profile.displayName}</h1>
          {profile.accountNumber && (
            <p className="text-sm font-mono text-[#7A8F79]">{profile.accountNumber}</p>
          )}
        </div>
      </div>

      {/* Portal Access — role dropdown, saved independently */}
      <div className="max-w-2xl mb-6 bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8] mb-4">
          Portal Access
        </h2>
        {/* Last login indicator */}
        <div className="mb-4 flex items-center gap-2">
          {profile.user?.lastLoginAt ? (() => {
            const last = new Date(profile.user.lastLoginAt)
            const daysAgo = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24))
            const color = daysAgo <= 7 ? 'bg-green-100 text-green-700' : daysAgo <= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
            return (
              <>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color}`}>
                  {daysAgo === 0 ? 'Active today' : daysAgo === 1 ? 'Active yesterday' : `Active ${daysAgo} days ago`}
                </span>
                <span className="text-xs text-[#7A8F79]">
                  Last login: {last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </>
            )
          })() : (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
              Never logged in
            </span>
          )}
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Role</label>
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={saveRole}
            disabled={roleSaving}
            className="bg-[#2F3E4E] text-white px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition text-sm font-semibold disabled:opacity-50"
          >
            {roleSaving ? 'Saving…' : 'Update Role'}
          </button>
        </div>
        {roleMessage && (
          <p className={`mt-2 text-xs font-medium ${roleMessage.includes('Error') ? 'text-red-500' : 'text-[#7A8F79]'}`}>
            {roleMessage}
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-[#D9E1E8]">
          <p className="text-xs font-semibold text-[#2F3E4E] mb-1">Set Password Manually</p>
          <p className="text-xs text-[#7A8F79] mb-2">Set a specific password for this provider without sending an email.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="flex-1 border border-[#D9E1E8] px-3 py-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            />
            <button
              type="button"
              onClick={setPassword}
              disabled={pwSaving || !newPassword.trim()}
              className="shrink-0 bg-[#2F3E4E] text-white px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition text-sm font-semibold disabled:opacity-50"
            >
              {pwSaving ? 'Saving…' : 'Set Password'}
            </button>
          </div>
          {pwMessage && (
            <p className={`mt-2 text-xs font-medium ${pwMessage.includes('Error') ? 'text-red-500' : 'text-[#7A8F79]'}`}>
              {pwMessage}
            </p>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-[#D9E1E8] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#2F3E4E]">Resend Portal Invite</p>
            <p className="text-xs text-[#7A8F79] mt-0.5">Resets their password and sends a new welcome email with fresh login credentials.</p>
          </div>
          <button
            type="button"
            onClick={resendInvite}
            disabled={inviteSending}
            className="shrink-0 ml-4 bg-[#7A8F79] text-white px-4 py-2 rounded-lg hover:bg-[#657a64] transition text-sm font-semibold disabled:opacity-50"
          >
            {inviteSending ? 'Sending…' : 'Resend Invite'}
          </button>
        </div>
        {inviteMessage && (
          <p className={`mt-2 text-xs font-medium ${inviteMessage.includes('Failed') || inviteMessage.includes('error') ? 'text-red-500' : 'text-[#7A8F79]'}`}>
            {inviteMessage}
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-[#D9E1E8] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#2F3E4E]">Weekly Reminder Emails</p>
            <p className="text-xs text-[#7A8F79] mt-0.5">
              {notifEnabled ? 'This provider receives weekly hour submission reminders.' : 'Weekly reminders are turned off for this provider.'}
            </p>
          </div>
          <button
            type="button"
            disabled={notifSaving}
            onClick={async () => {
              const next = !notifEnabled
              setNotifSaving(true)
              const res = await fetch(`/api/admin/nurses/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ receiveNotifications: next }),
              })
              setNotifSaving(false)
              if (res.ok) setNotifEnabled(next)
            }}
            className={`shrink-0 ml-4 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 ${
              notifEnabled
                ? 'bg-[#D9E1E8] text-[#2F3E4E] hover:bg-red-100 hover:text-red-600'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {notifSaving ? 'Saving…' : notifEnabled ? 'Turn Off' : 'Turn On'}
          </button>
        </div>
      </div>

      <form onSubmit={save} className="space-y-6 max-w-2xl">

        {/* Individual Provider */}
        <Section title="Individual Provider Information">
          <div className="grid grid-cols-3 gap-3">
            <Field label="First Name"     field="firstName"     profile={profile} setProfile={setProfile} />
            <Field label="MI"             field="middleInitial" profile={profile} setProfile={setProfile} />
            <Field label="Last Name"      field="lastName"      profile={profile} setProfile={setProfile} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"          field="phone"         profile={profile} setProfile={setProfile} />
            <Field label="Email"          field="user.email"    profile={profile} setProfile={setProfile} type="email" />
          </div>
          <Field label="Home Address"     field="address"       profile={profile} setProfile={setProfile} />
          <div className="grid grid-cols-3 gap-3">
            <Field label="City"           field="city"          profile={profile} setProfile={setProfile} />
            <Field label="State"          field="state"         profile={profile} setProfile={setProfile} />
            <Field label="ZIP"            field="zip"           profile={profile} setProfile={setProfile} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of Birth"  field="dob"           profile={profile} setProfile={setProfile} type="date" />
            <Field label="SSN"            field="ssn"           profile={profile} setProfile={setProfile} sensitive />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="NPI"            field="npiNumber"     profile={profile} setProfile={setProfile} />
            <Field label="Medicaid ID"    field="medicaidNumber" profile={profile} setProfile={setProfile} />
          </div>
          <Field label="BCBS Payor ID"    field="bcbsPayorId"   profile={profile} setProfile={setProfile} />
        </Section>

        {/* Business Provider toggle */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!profile.hasBusinessProvider}
              onChange={(e) => setProfile({ ...profile, hasBusinessProvider: e.target.checked })}
              className="w-4 h-4 accent-[#7A8F79]"
            />
            <span className="font-semibold text-[#2F3E4E]">This provider has a separate Business entity</span>
          </label>

          {profile.hasBusinessProvider && (
            <div className="mt-6 space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8]">
                Business Provider Information
              </h2>
              <Field label="Entity Name"       field="bizEntityName"      profile={profile} setProfile={setProfile} />
              <Field label="Service Address"   field="bizServiceAddress"  profile={profile} setProfile={setProfile} />
              <Field label="Business Email"    field="bizEmail"           profile={profile} setProfile={setProfile} type="email" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="EIN"             field="ein"                profile={profile} setProfile={setProfile} sensitive />
                <Field label="FEIN"            field="fein"               profile={profile} setProfile={setProfile} sensitive />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Business NPI"    field="bizNpi"             profile={profile} setProfile={setProfile} />
                <Field label="Business Medicaid ID" field="bizMedicaidId" profile={profile} setProfile={setProfile} />
              </div>
            </div>
          )}
        </div>

        {/* Payment */}
        <Section title="Payment Information">
          <Field label="Bank Name"         field="bankName"       profile={profile} setProfile={setProfile} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Routing #"       field="bankRouting"    profile={profile} setProfile={setProfile} sensitive />
            <Field label="Account #"       field="bankAccount"    profile={profile} setProfile={setProfile} sensitive />
          </div>
        </Section>

        {/* Claims Access */}
        <Section title="Claims Access — Provider Aliases">
          <p className="text-xs text-[#7A8F79]">
            This provider will see any claim where the Provider Name in the CSV matches one of these aliases exactly.
          </p>
          <AliasEditor
            aliases={profile.providerAliases || []}
            onChange={(aliases) => setProfile({ ...profile, providerAliases: aliases })}
          />
        </Section>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#2F3E4E] text-white py-3 rounded-xl hover:bg-[#7A8F79] transition font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>

        {message && (
          <p className={`text-sm text-center font-medium ${message.includes('Error') ? 'text-red-500' : 'text-[#7A8F79]'}`}>
            {message}
          </p>
        )}

      </form>

      {/* ── Time Entries + Invoicing ── */}
      <div className="max-w-2xl mt-6 bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#D9E1E8]">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79]">
            Time Entries — Invoice Flagging
          </h2>
          {pendingEntries.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#2F3E4E]">
                {pendingEntries.length} flagged · ${pendingTotal.toFixed(2)} pending
              </span>
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="bg-[#7A8F79] text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#2F3E4E] transition"
              >
                Create Invoice
              </button>
            </div>
          )}
        </div>

        {invoiceMessage && (
          <p className={`text-xs font-semibold ${invoiceMessage.includes('sent') ? 'text-[#7A8F79]' : 'text-red-500'}`}>
            {invoiceMessage}
          </p>
        )}

        {entries.length === 0 ? (
          <p className="text-sm text-[#7A8F79] italic">No time entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                  <th className="text-left py-2 pr-3 w-8"></th>
                  <th className="text-left py-2 pr-4">Account #</th>
                  <th className="text-left py-2 pr-4">Provider</th>
                  <th className="text-left py-2 pr-4">Date of Service</th>
                  <th className="text-right py-2 pr-4">Hours</th>
                  <th className="text-left py-2 pr-4">Notes</th>
                  <th className="text-left py-2 pr-4">Claim Ref #</th>
                  <th className="text-left py-2 pr-4">Fee / Status</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const isInvoiced = !!entry.invoiceId
                  const dateStr = new Date(entry.workDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
                  return (
                    <tr
                      key={entry.id}
                      className={`border-b border-[#D9E1E8] last:border-0 ${i % 2 === 0 ? '' : 'bg-[#F4F6F5]'} ${isInvoiced ? 'opacity-60' : ''}`}
                    >
                      <td className="py-2.5 pr-3">
                        <input
                          type="checkbox"
                          disabled={isInvoiced}
                          checked={entry.readyToInvoice}
                          onChange={e => toggleInvoiceFlag(entry, e.target.checked)}
                          className="w-4 h-4 accent-[#7A8F79]"
                        />
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="font-mono text-xs text-[#2F3E4E]">
                          {profile.accountNumber || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 font-semibold text-[#2F3E4E] whitespace-nowrap">
                        {profile.displayName}
                      </td>
                      <td className="py-2.5 pr-4 text-[#2F3E4E] whitespace-nowrap">{dateStr}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-[#2F3E4E]">{entry.hours}</td>
                      <td className="py-2.5 pr-4 text-[#7A8F79] italic text-xs max-w-[120px] truncate">
                        {entry.notes || '—'}
                      </td>
                      <td className="py-2.5 pr-4">
                        {isInvoiced ? (
                          <span className="text-xs text-[#7A8F79] font-mono">{entry.claimRef || '—'}</span>
                        ) : (
                          <input
                            type="text"
                            value={claimRefs[entry.id] ?? entry.claimRef ?? ''}
                            onChange={e => setClaimRefs(prev => ({ ...prev, [entry.id]: e.target.value }))}
                            onBlur={e => saveClaimRef(entry.id, e.target.value)}
                            placeholder="e.g. CLM-001"
                            className="border border-[#D9E1E8] rounded px-2 py-1 text-xs text-[#2F3E4E] w-28 focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                          />
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        {isInvoiced ? (
                          <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                            {entry.invoice?.invoiceNumber}
                          </span>
                        ) : entry.readyToInvoice ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={entry.invoiceFeePlan ?? 'A1'}
                              onChange={e => toggleInvoiceFlag(entry, true, e.target.value)}
                              className="border border-[#D9E1E8] rounded px-1.5 py-1 text-xs text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                            >
                              {FEE_PLANS.map(p => (
                                <option key={p.value} value={p.value}>{p.value} — ${p.amount.toFixed(2)}</option>
                              ))}
                            </select>
                            <span className="text-xs font-bold text-[#2F3E4E]">
                              ${(entry.invoiceFeeAmt ?? 0).toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-[#7A8F79] italic">not flagged</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        {!entry.billed && (
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            title="Delete entry"
                            className="text-red-400 hover:text-red-600 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Invoice Modal ── */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-[#2F3E4E]">Create Invoice</h3>
            <p className="text-sm text-[#7A8F79]">
              {pendingEntries.length} entries · <strong className="text-[#2F3E4E]">${pendingTotal.toFixed(2)} total</strong>
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Due Terms</label>
              <select
                value={invoiceDueTerm}
                onChange={e => setInvoiceDueTerm(e.target.value)}
                className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E]"
              >
                <option value="30">Net 30 — due in 30 days</option>
                <option value="60">Net 60 — due in 60 days</option>
                <option value="90">Net 90 — due in 90 days</option>
                <option value="ASAP">ASAP — due immediately</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Notes (optional)</label>
              <textarea
                value={invoiceNotes}
                onChange={e => setInvoiceNotes(e.target.value)}
                rows={3}
                placeholder="Any additional notes for the nurse…"
                className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f6f8] transition"
              >
                Cancel
              </button>
              <button
                onClick={createInvoice}
                disabled={invoiceSending}
                className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
              >
                {invoiceSending ? 'Sending…' : 'Send Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
