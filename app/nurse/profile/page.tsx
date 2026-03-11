'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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
        if (r.status === 401) {
          router.push('/login')
          return
        }
        return r.json()
      })
      .then((data) => {
        if (data) {
          setUser(data.user)
          setProfile(data.profile || {})
        }
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
      body: JSON.stringify(profile)
    })

    const data = await res.json()
    if (res.ok) {
      setMessage('Profile updated successfully.')
      // refresh layout/data so Banner picks up any new displayName
      router.refresh()
    } else {
      setMessage(data.error || 'Update failed.')
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMessage('')
    if (newPassword !== confirmPassword) {
      setPwMessage('New passwords do not match.')
      return
    }
    const res = await fetch('/api/nurse/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword })
    })
    const data = await res.json()
    if (res.ok) {
      setPwMessage('Password changed.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      setPwMessage(data.error || 'Could not change password.')
    }
  }

  if (loading) {
    return <div className="p-8">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span style={{color:'#7A8F79', fontStyle: 'italic'}}>my</span>Profile
        </h1>
      </div>

      {profile.accountNumber && (
        <div className="bg-[#2F3E4E] text-white rounded-xl px-6 py-4 max-w-3xl flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Account Number</p>
            <p className="text-2xl font-bold tracking-widest mt-0.5">{profile.accountNumber}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#7A8F79] flex items-center justify-center text-white font-bold text-lg">
            {(profile.displayName || '?').charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">

        {/* Left column */}
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-4">
            <h2 className="text-xl font-semibold mb-4 text-[#2F3E4E]">Personal Information</h2>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#2F3E4E]">Email (<a href='mailto:supportn@cominghomecare.com'>submit request to update email <u>here</u>.</a>)</label>
              <input
                type="text"
                value={user?.email || ''}
                disabled
                className="w-full border border-[#D9E1E8] p-2 rounded bg-gray-100 text-[#2F3E4E]"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#2F3E4E]">Display Name</label>
              <input
                type="text"
                value={profile.displayName || ''}
                onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Address"
                value={profile.address || ''}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
              />
              <input
                type="text"
                placeholder="City"
                value={profile.city || ''}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
              />
              <input
                type="text"
                placeholder="State"
                value={profile.state || ''}
                onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
              />
              <input
                type="text"
                placeholder="ZIP Code"
                value={profile.zip || ''}
                onChange={(e) => setProfile({ ...profile, zip: e.target.value })}
                className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#2F3E4E]">NPI Number</label>
              <input
                type="text"
                value={profile.npiNumber || ''}
                onChange={(e) => setProfile({ ...profile, npiNumber: e.target.value })}
                className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#2F3E4E]">Medicaid Number</label>
              <input
                type="text"
                value={profile.medicaidNumber || ''}
                onChange={(e) => setProfile({ ...profile, medicaidNumber: e.target.value })}
                className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#2F3E4E]">Billing Info</label>
              <textarea
                value={profile.billingInfo || ''}
                onChange={(e) => setProfile({ ...profile, billingInfo: e.target.value })}
                className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#2F3E4E] text-white p-2 rounded hover:bg-[#7A8F79] transition"
            >
              Save Changes
            </button>

            {message && <p className="mt-2 text-sm text-center text-[#2F3E4E]">{message}</p>}
          </form>

          <form onSubmit={changePassword} className="bg-white p-6 rounded shadow space-y-4">
            <h2 className="text-xl font-semibold mb-4 text-[#2F3E4E]">Change Password</h2>
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
            />
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E]"
            />
            <button
              type="submit"
              className="w-full bg-[#2F3E4E] text-white p-2 rounded hover:bg-[#7A8F79] transition"
            >
              Update Password
            </button>
            {pwMessage && <p className="mt-2 text-sm text-center text-[#2F3E4E]">{pwMessage}</p>}
          </form>
        </div>

        {/* Right column — myBilling */}
        <div>
          <BillingSection profile={profile} onUnenroll={() => setProfile({ ...profile, enrolledInBilling: false })} />
        </div>

      </div>

    </div>
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
    <div className="bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-4 text-[#2F3E4E]">
        <span style={{ color: '#7A8F79', fontStyle: 'italic' }}>my</span>Billing
      </h2>

      {profile.enrolledInBilling === true ? (
        <div className="space-y-3">
          <div className="bg-[#F4F6F5] rounded-lg p-4 text-sm space-y-1">
            <p><span className="text-[#7A8F79] font-semibold">Status:</span> <span className="text-green-700 font-semibold">Enrolled</span></p>
            {profile.billingPlan && (
              <p><span className="text-[#7A8F79] font-semibold">Plan:</span> {planLabels[profile.billingPlan] || profile.billingPlan}</p>
            )}
            {profile.planStartDate && (
              <p><span className="text-[#7A8F79] font-semibold">Start Date:</span> {profile.planStartDate}</p>
            )}
            {profile.billingDurationType && (
              <p><span className="text-[#7A8F79] font-semibold">Duration:</span> {profile.billingDurationType === 'full_year' ? 'Full Year' : profile.billingDurationNote || 'Policy Specific'}</p>
            )}
          </div>

          {done ? (
            <p className="text-sm text-[#7A8F79]">Unenrollment request submitted. Your administrator will be in touch.</p>
          ) : confirming ? (
            <div className="border border-red-200 rounded-lg p-4 bg-red-50 space-y-3">
              <p className="text-sm text-red-700 font-semibold">Are you sure you want to unenroll from billing services?</p>
              <p className="text-xs text-red-500">Your administrator will be notified. You can re-enroll at any time.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirming(false)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:border-[#7A8F79] transition">
                  Cancel
                </button>
                <button onClick={handleUnenroll} disabled={loading} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50">
                  {loading ? 'Submitting…' : 'Yes, Unenroll Me'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="w-full border border-red-300 text-red-600 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 transition"
            >
              Request Unenrollment
            </button>
          )}
        </div>
      ) : profile.enrolledInBilling === false ? (
        <div className="space-y-3">
          <p className="text-sm text-[#7A8F79]">You are not currently enrolled in billing services.</p>
          <a
            href="/nurse/onboarding"
            className="block text-center w-full bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition"
          >
            Enroll in Billing Services
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#7A8F79]">Complete your onboarding to set up billing services.</p>
          <a
            href="/nurse/onboarding"
            className="block text-center w-full bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition"
          >
            Start Enrollment
          </a>
        </div>
      )}
    </div>
  )
}
