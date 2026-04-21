'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PortalMessages from '../../components/PortalMessages'
import { fmtPhoneInput } from '../../../lib/formatPhone'

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ email: string; name: string } | null>(null)
  const [profile, setProfile] = useState<any>({})
  const [message, setMessage] = useState('')
  const [pwMessage, setPwMessage] = useState('')

  // password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    fetch('/api/nurse/profile')
      .then((r) => {
        if (r.status === 401) { router.push('/login'); return }
        return r.json()
      })
      .then((data) => {
        if (data) { setUser(data.user); setProfile(data.profile || {}) }
      })
      .finally(() => setLoading(false))
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    const res = await fetch('/api/nurse/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profile),
    })
    const data = await res.json()
    if (res.ok) { setMessage('Profile updated successfully.'); router.refresh() }
    else setMessage(data.error || 'Update failed.')
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMessage('')
    if (newPassword !== confirmPassword) { setPwMessage('New passwords do not match.'); return }
    const res = await fetch('/api/nurse/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json()
    if (res.ok) {
      setPwMessage('Password changed.')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } else {
      setPwMessage(data.error || 'Could not change password.')
    }
  }

  if (loading) return <div className="p-8">Loading…</div>

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">my</span>Profile
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">Manage your personal information and billing preferences.</p>
      </div>

      <PortalMessages priority="General" />

      {profile.accountNumber && (
        <div className="bg-[#2F3E4E] text-white rounded-xl px-6 py-4 flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Account Number</p>
            <p className="text-2xl font-bold tracking-widest mt-0.5">#{profile.accountNumber}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#7A8F79] flex items-center justify-center text-white font-bold text-lg">
            {(profile.displayName || '?').charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* 3-column layout */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

          {/* ── Col 1+2: Personal Information ── */}
          <div className="lg:col-span-2 space-y-5">

            <div className="bg-white rounded-xl shadow p-6 space-y-4">
              <h2 className="text-xl font-semibold text-[#2F3E4E]">Personal Information</h2>

              {/* Name row */}
              <div className="grid grid-cols-6 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">First Name</label>
                  <input type="text" value={profile.firstName || ''} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E]" />
                </div>
                <div className="col-span-1 space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">MI</label>
                  <input type="text" maxLength={1} value={profile.middleInitial || ''} onChange={(e) => setProfile({ ...profile, middleInitial: e.target.value })} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E]" />
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Last Name</label>
                  <input type="text" value={profile.lastName || ''} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E]" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">
                    Email — <a href="mailto:support@cominghomecare.com" className="normal-case font-normal underline hover:text-[#2F3E4E]">request update</a>
                  </label>
                  <input type="text" value={user?.email || ''} disabled className="w-full border border-[#D9E1E8] p-2 rounded-lg bg-gray-100 text-[#2F3E4E]" />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Preferred Name <span className="normal-case font-normal text-[#7A8F79]">(optional)</span></label>
                  <input type="text" value={profile.displayName || ''} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E]" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Phone Number</label>
                <input type="tel" placeholder="(555) 555-5555" value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: fmtPhoneInput(e.target.value) })} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E]" />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Home Address</label>
                <input type="text" placeholder="Street address" value={profile.address || ''} onChange={(e) => setProfile({ ...profile, address: e.target.value })} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E]" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">City</label>
                  <input type="text" placeholder="City" value={profile.city || ''} onChange={(e) => setProfile({ ...profile, city: e.target.value })} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E]" />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">State</label>
                  <input type="text" placeholder="State" value={profile.state || ''} onChange={(e) => setProfile({ ...profile, state: e.target.value })} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E]" />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">ZIP</label>
                  <input type="text" placeholder="ZIP" value={profile.zip || ''} onChange={(e) => setProfile({ ...profile, zip: e.target.value })} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E]" />
                </div>
              </div>

              {/* Sensitive fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SensitiveField
                  label="Date of Birth"
                  type="date"
                  value={profile.dob || ''}
                  onChange={(v) => setProfile({ ...profile, dob: v })}
                />
                <SensitiveField
                  label="SSN"
                  value={profile.ssn || ''}
                  onChange={(v) => setProfile({ ...profile, ssn: v })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SensitiveField
                  label="NPI Number (Individual)"
                  value={profile.npiNumber || ''}
                  onChange={(v) => setProfile({ ...profile, npiNumber: v })}
                />
                <SensitiveField
                  label="Medicaid ID"
                  value={profile.medicaidNumber || ''}
                  onChange={(v) => setProfile({ ...profile, medicaidNumber: v })}
                />
              </div>

              <button type="submit" className="w-full bg-[#2F3E4E] text-white p-2 rounded-lg hover:bg-[#7A8F79] transition font-semibold">
                Save Changes
              </button>
              {message && <p className="text-sm text-center text-[#2F3E4E]">{message}</p>}
            </div>


          </div>

          {/* ── Col 3: myBilling + myCases + myPasswords + myNotifications ── */}
          <div className="space-y-5">

            <BillingSection profile={profile} onUnenroll={() => setProfile({ ...profile, enrolledInBilling: false })} />

            <MyCasesBlock />

            <form onSubmit={changePassword} className="bg-white rounded-xl shadow p-6 space-y-4">
              <h2 className="text-xl font-semibold text-[#2F3E4E]">
                <span style={{ color: '#7A8F79', fontStyle: 'italic' }}>my</span>Passwords
              </h2>
              <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E]" />
              <input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E]" />
              <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E]" />
              <button type="submit" className="w-full bg-[#2F3E4E] text-white p-2 rounded-lg hover:bg-[#7A8F79] transition font-semibold">
                Update Password
              </button>
              {pwMessage && <p className="text-sm text-center text-[#2F3E4E]">{pwMessage}</p>}
            </form>

            <NotifPrefsBlock profile={profile} setProfile={setProfile} />

          </div>

        </div>
      </form>
    </div>
  )
}

function SensitiveField({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">
        {label}
        <span className="ml-2 text-[10px] normal-case font-normal bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">encrypted</span>
      </label>
      <div className="relative">
        <input
          type={show ? type : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] pr-16"
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#7A8F79] hover:text-[#2F3E4E]">
          {show ? 'hide' : 'show'}
        </button>
      </div>
    </div>
  )
}

function MyCasesBlock() {
  const [cases, setCases] = useState<{ id: string; patientFirstName: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/nurse/cases', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.cases) setCases(data.cases) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-xl font-semibold mb-4 text-[#2F3E4E]">
        <span style={{ color: '#7A8F79', fontStyle: 'italic' }}>my</span>Cases
      </h2>
      {loading ? (
        <p className="text-sm text-[#7A8F79]">Loading…</p>
      ) : cases.length === 0 ? (
        <p className="text-sm text-[#7A8F79]">No cases assigned yet. Your coordinator will add you to a case.</p>
      ) : (
        <div className="space-y-2">
          {cases.map(c => (
            <div key={c.id} className="flex items-center gap-3 bg-[#F4F6F5] rounded-lg px-4 py-2.5">
              <div className="w-2 h-2 rounded-full bg-[#7A8F79] shrink-0" />
              <span className="text-sm font-semibold text-[#2F3E4E]">{c.patientFirstName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NotifPrefsBlock({ profile, setProfile }: { profile: any; setProfile: (p: any) => void }) {
  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[#2F3E4E]">
          <span style={{ color: '#7A8F79', fontStyle: 'italic' }}>my</span>Notifications
        </h2>
        <p className="text-xs text-[#7A8F79] mt-0.5">Choose which emails you'd like to receive.</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-3">Reminders</p>
        <div className="space-y-3">
          {[
            { field: 'receiveNotifications', label: 'Weekly Hour Submission', desc: 'Friday reminder to submit your hours for the week' },
            { field: 'notifyBillingReminder', label: 'Billing Reminder', desc: 'Reminders related to invoices and billing activity' },
            { field: 'notifyDocExpiring', label: 'Document / License Expiring', desc: 'Alerts before a document or license on file reaches its expiration date' },
          ].map(({ field, label, desc }) => (
            <NotifToggle
              key={field}
              label={label}
              desc={desc}
              checked={profile[field] !== false}
              onChange={async (val) => {
                setProfile({ ...profile, [field]: val })
                await fetch('/api/nurse/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ [field]: val }),
                })
              }}
            />
          ))}
        </div>
      </div>
      <div className="pt-4 border-t border-[#D9E1E8]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-3">Alerts</p>
        <div className="space-y-3">
          {[
            { field: 'notifyNewDocument', label: 'New Document Added', desc: 'Email when your coordinator uploads a document to your profile' },
            { field: 'notifyNewClaim', label: 'New Claim Added', desc: 'Email when a new claim is added to your account' },
          ].map(({ field, label, desc }) => (
            <NotifToggle
              key={field}
              label={label}
              desc={desc}
              checked={profile[field] !== false}
              onChange={async (val) => {
                setProfile({ ...profile, [field]: val })
                await fetch('/api/nurse/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ [field]: val }),
                })
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function NotifToggle({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (val: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#2F3E4E] leading-tight">{label}</p>
        <p className="text-xs text-[#7A8F79] mt-0.5 leading-snug">{desc}</p>
      </div>
      <div className="relative flex-shrink-0">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className={`w-11 h-6 rounded-full transition-colors ${checked ? 'bg-[#2F3E4E]' : 'bg-[#D9E1E8]'}`} />
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </label>
  )
}

function BillingSection({ profile, onUnenroll }: { profile: any; onUnenroll: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleUnenroll() {
    setLoading(true)
    await fetch('/api/nurse/unenroll', { method: 'POST', credentials: 'include' })
    setLoading(false)
    setDone(true)
    setConfirming(false)
    onUnenroll()
  }

  const planLabels: Record<string, string> = {
    A1: 'Plan A1 — Single Payer (BCBS)',
    A2: 'Plan A2 — Single Payer (Medicaid)',
    B:  'Plan B — Dual Payer (BCBS + Medicaid)',
    custom: 'Custom Arrangement',
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-xl font-semibold mb-4 text-[#2F3E4E]">
        <span style={{ color: '#7A8F79', fontStyle: 'italic' }}>my</span>Billing
      </h2>

      {profile.enrolledInBilling === true ? (
        <div className="space-y-3">
          <div className="bg-[#F4F6F5] rounded-lg p-4 text-sm space-y-1">
            <p><span className="text-[#7A8F79] font-semibold">Status:</span> <span className="text-green-700 font-semibold">Enrolled</span></p>
            {profile.billingPlan && <p><span className="text-[#7A8F79] font-semibold">Plan:</span> <span className="text-[#2F3E4E] font-medium">{planLabels[profile.billingPlan] || profile.billingPlan}</span></p>}
            {profile.planStartDate && <p><span className="text-[#7A8F79] font-semibold">Start Date:</span> <span className="text-[#2F3E4E] font-medium">{profile.planStartDate}</span></p>}
            {profile.billingDurationType && <p><span className="text-[#7A8F79] font-semibold">Duration:</span> <span className="text-[#2F3E4E] font-medium">{profile.billingDurationType === 'full_year' ? 'Full Year' : profile.billingDurationNote || 'Policy Specific'}</span></p>}
          </div>
          {done ? (
            <p className="text-sm text-[#7A8F79]">Unenrollment request submitted. Your administrator will be in touch.</p>
          ) : confirming ? (
            <div className="border border-red-200 rounded-lg p-4 bg-red-50 space-y-3">
              <p className="text-sm text-red-700 font-semibold">Are you sure you want to unenroll from billing services?</p>
              <p className="text-xs text-red-500">Your administrator will be notified. You can re-enroll at any time.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirming(false)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:border-[#7A8F79] transition">Cancel</button>
                <button type="button" onClick={handleUnenroll} disabled={loading} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50">{loading ? 'Submitting…' : 'Yes, Unenroll Me'}</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="w-full border border-red-300 text-red-600 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 transition">Request Unenrollment</button>
          )}
        </div>
      ) : profile.enrolledInBilling === false ? (
        <div className="space-y-3">
          <p className="text-sm text-[#7A8F79]">You are not currently enrolled in billing services.</p>
          <a href="/nurse/onboarding" className="block text-center w-full bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition">Enroll in Billing Services</a>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#7A8F79]">Complete your onboarding to set up billing services.</p>
          <a href="/nurse/onboarding" className="block text-center w-full bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition">Start Enrollment</a>
        </div>
      )}
    </div>
  )
}
