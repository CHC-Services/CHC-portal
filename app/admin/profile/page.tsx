'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProfileDemographicsCard from '../../components/profile/ProfileDemographicsCard'
import ProfileBillingInfoCard from '../../components/profile/ProfileBillingInfoCard'
import ProfileBankingCard from '../../components/profile/ProfileBankingCard'
import MessagingPrefToggle from '../../components/MessagingPrefToggle'
import PartialShiftClaimNotifyToggle from '../../components/PartialShiftClaimNotifyToggle'
import SignatureCapture from '../../components/SignatureCapture'

export default function AdminProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>({})
  const [visibleCards, setVisibleCards] = useState<string[]>(['demographics'])
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')

  // My Signature
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [signatureLoading, setSignatureLoading] = useState(true)
  const [signatureSaving, setSignatureSaving] = useState(false)

  function loadSignature() {
    fetch('/api/admin/signature', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setSignatureUrl(d.signatureUrl || null))
      .finally(() => setSignatureLoading(false))
  }

  useEffect(() => { loadSignature() }, [])

  async function saveSignature(dataUrl: string) {
    setSignatureSaving(true)
    const res = await fetch('/api/admin/signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ imageDataUrl: dataUrl }),
    })
    setSignatureSaving(false)
    if (res.ok) loadSignature()
  }

  async function removeSignature() {
    await fetch('/api/admin/signature', { method: 'DELETE', credentials: 'include' })
    setSignatureUrl(null)
  }

  // My Initials — same reusable-drawn-mark pattern as Signature above, just
  // a short initial for MAR/TAR grid cells instead of a full signature.
  const [initialsUrl, setInitialsUrl] = useState<string | null>(null)
  const [initialsLoading, setInitialsLoading] = useState(true)
  const [initialsSaving, setInitialsSaving] = useState(false)

  function loadInitials() {
    fetch('/api/admin/initials', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setInitialsUrl(d.initialsUrl || null))
      .finally(() => setInitialsLoading(false))
  }

  useEffect(() => { loadInitials() }, [])

  async function saveInitials(dataUrl: string) {
    setInitialsSaving(true)
    const res = await fetch('/api/admin/initials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ imageDataUrl: dataUrl }),
    })
    setInitialsSaving(false)
    if (res.ok) loadInitials()
  }

  async function removeInitials() {
    await fetch('/api/admin/initials', { method: 'DELETE', credentials: 'include' })
    setInitialsUrl(null)
  }

  useEffect(() => {
    fetch('/api/admin/profile', { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return }
        return r.json()
      })
      .then(data => {
        if (data) {
          setProfile(data.profile || {})
          if (data.visibleCards) setVisibleCards(data.visibleCards)
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  const setField = (k: string, v: any) => setProfile((p: any) => ({ ...p, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    const res = await fetch('/api/admin/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profile),
    })
    if (res.ok) { setMessage('Profile updated successfully.'); setEditing(false) }
    else { const data = await res.json(); setMessage(data.error || 'Update failed.') }
  }

  if (loading) return <div className="p-8">Loading…</div>

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8 pl-0 md:pl-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">ad</span>Profile
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">Manage your personal information.</p>
      </div>

      <div className="max-w-xl space-y-5">
        {!editing ? (
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
        )}
        {visibleCards.includes('banking') && <ProfileBankingCard data={profile} />}

        {/* My Signature — used for authoring/signing Progress Notes as admin */}
        <div className="bg-white rounded-xl shadow p-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E]">My Signature</p>
            {signatureUrl && (
              <button type="button" onClick={removeSignature} className="text-xs font-semibold text-red-500 hover:text-red-700 transition">
                Remove
              </button>
            )}
          </div>
          {signatureLoading ? (
            <p className="text-sm text-[#7A8F79]">Loading…</p>
          ) : (
            <SignatureCapture existingImageUrl={signatureUrl} onSave={saveSignature} saving={signatureSaving} />
          )}
        </div>

        {/* My Initials — short drawn mark for MAR/TAR grid cells */}
        <div className="bg-white rounded-xl shadow p-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E]">My Initials</p>
            {initialsUrl && (
              <button type="button" onClick={removeInitials} className="text-xs font-semibold text-red-500 hover:text-red-700 transition">
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-[#7A8F79] -mt-1">Used for quick per-dose/per-task marks, like on the MAR and TAR.</p>
          {initialsLoading ? (
            <p className="text-sm text-[#7A8F79]">Loading…</p>
          ) : (
            <SignatureCapture existingImageUrl={initialsUrl} onSave={saveInitials} saving={initialsSaving} label="Initials" square />
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <p className="font-bold text-[#2F3E4E] text-sm mb-1">Messaging</p>
          <p className="text-xs text-[#7A8F79] leading-relaxed mb-4">Email alerts for new messages you receive on the portal.</p>
          <MessagingPrefToggle />
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <p className="font-bold text-[#2F3E4E] text-sm mb-1">Scheduling</p>
          <p className="text-xs text-[#7A8F79] leading-relaxed mb-4">Notifications for partial open-shift claims.</p>
          <PartialShiftClaimNotifyToggle />
        </div>
      </div>
    </div>
  )
}
