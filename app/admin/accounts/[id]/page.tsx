'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminNav from '../../../components/AdminNav'
import ProfileDemographicsCard from '../../../components/profile/ProfileDemographicsCard'
import ProfileBillingInfoCard from '../../../components/profile/ProfileBillingInfoCard'
import ProfileBankingCard from '../../../components/profile/ProfileBankingCard'

const ROLE_LABEL: Record<string, string> = {
  nurse: 'Nurse',
  provider: 'Pending Provider',
  admin: 'Admin',
  biller: 'Biller',
  guardian: 'Guardian / Family',
}

export default function AdminAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [account, setAccount] = useState<{ id: string; name: string; email: string; role: string } | null>(null)
  const [profile, setProfile] = useState<any>({})
  const [visibleCards, setVisibleCards] = useState<string[]>([])
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    const res = await fetch(`/api/admin/accounts/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) {
      router.push('/admin')
    } else {
      const data = await res.json().catch(() => null)
      setDeleteError(data?.error || 'Delete failed.')
      setDeleting(false)
    }
  }

  function load() {
    fetch(`/api/admin/accounts/${id}/profile`, { credentials: 'include' })
      .then(async r => {
        if (r.status === 404) { setNotFound(true); return null }
        if (!r.ok) {
          const body = await r.json().catch(() => null)
          setLoadError(body?.error || `Failed to load account (${r.status})`)
          return null
        }
        return r.json()
      })
      .then(data => {
        if (data) {
          setAccount(data.user)
          setProfile(data.profile || {})
          setVisibleCards(data.visibleCards || [])
        }
      })
      .catch(err => setLoadError(err?.message || 'Failed to load account'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const setField = (k: string, v: any) => setProfile((p: any) => ({ ...p, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    const res = await fetch(`/api/admin/accounts/${id}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profile),
    })
    if (res.ok) { setMessage('Profile updated successfully.'); setEditing(false) }
    else { const data = await res.json(); setMessage(data.error || 'Update failed.') }
  }

  if (loading) return <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8"><AdminNav /><p className="text-sm text-[#7A8F79]">Loading…</p></div>

  if (notFound || loadError || !account) {
    return (
      <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
        <AdminNav />
        <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-md mx-auto mt-8">
          <p className="text-[#2F3E4E] font-semibold">{notFound ? 'Account not found' : (loadError || 'Something went wrong loading this account.')}</p>
          <Link href="/admin" className="inline-block mt-4 text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E]">← Back to adAccounts</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <AdminNav />

      <Link href="/admin" className="text-sm text-[#7A8F79] hover:text-[#2F3E4E] transition">← adAccounts</Link>

      <div className="mt-2 mb-6 flex items-center gap-3">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">{account.name}</h1>
        <span className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] bg-white px-3 py-1 rounded-full shadow-sm">
          {ROLE_LABEL[account.role] || account.role}
        </span>
      </div>
      <p className="text-sm text-[#7A8F79] mb-6">{account.email}</p>

      <div className="max-w-xl space-y-5">
        {visibleCards.includes('demographics') && (
          !editing ? (
            <>
              <ProfileDemographicsCard data={profile} readOnly={false} editing={false} onEdit={() => setEditing(true)} setField={setField} showPreferredName={false} />
              {visibleCards.includes('billing_info') && (
                <ProfileBillingInfoCard data={profile} readOnly={false} editing={false} onEdit={() => setEditing(true)} setField={setField} />
              )}
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <ProfileDemographicsCard data={profile} readOnly={false} editing={true} onEdit={() => {}} setField={setField} showPreferredName={false} />
              {visibleCards.includes('billing_info') && (
                <ProfileBillingInfoCard data={profile} readOnly={false} editing={true} onEdit={() => {}} setField={setField} />
              )}
              <div className="bg-white rounded-xl shadow p-6 space-y-3">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(false)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:border-[#7A8F79] transition">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 bg-[#2F3E4E] text-white p-2 rounded-lg hover:bg-[#7A8F79] transition font-semibold">
                    Save Changes
                  </button>
                </div>
                {message && <p className="text-sm text-center text-[#2F3E4E]">{message}</p>}
              </div>
            </form>
          )
        )}
        {visibleCards.includes('banking') && <ProfileBankingCard data={profile} />}
        {visibleCards.length === 0 && (
          <p className="text-sm text-[#7A8F79] italic">No profile cards are enabled for this account&apos;s role. Manage this in ⚙ System → User Profile Data.</p>
        )}

        {/* Danger Zone */}
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3 pb-1 border-b border-[#D9E1E8]">Danger Zone</p>
          {confirmDelete ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <p className="text-sm text-red-700 font-semibold">Permanently delete {account.name}? This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-1.5 rounded text-sm font-semibold">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 text-white py-1.5 rounded text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                  {deleting ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
              {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2">
              Delete this account
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
