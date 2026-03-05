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
        <div className="bg-[#2F3E4E] text-white rounded-xl px-6 py-4 max-w-lg flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Account Number</p>
            <p className="text-2xl font-bold tracking-widest mt-0.5">{profile.accountNumber}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#7A8F79] flex items-center justify-center text-white font-bold text-lg">
            {(profile.displayName || '?').charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow max-w-lg space-y-4">
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

      <form onSubmit={changePassword} className="mt-8 bg-white p-6 rounded shadow max-w-lg space-y-4">
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
  )
}
