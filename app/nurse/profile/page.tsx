'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PortalMessages from '../../components/PortalMessages'
import MessagingPrefToggle from '../../components/MessagingPrefToggle'
import ProfileDemographicsCard from '../../components/profile/ProfileDemographicsCard'
import ProfileBillingInfoCard from '../../components/profile/ProfileBillingInfoCard'
import ProfileBankingCard from '../../components/profile/ProfileBankingCard'
import SignatureCapture from '../../components/SignatureCapture'

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ email: string; name: string } | null>(null)
  const [profile, setProfile] = useState<any>({})
  const [message, setMessage] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)

  // 2FA state
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaStep, setMfaStep] = useState<'idle' | 'setup' | 'disabling'>('idle')
  const [mfaQr, setMfaQr] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaMessage, setMfaMessage] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)

  // password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwMessage, setPwMessage] = useState('')

  // email update fields
  const [newEmail, setNewEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailMessage, setEmailMessage] = useState('')

  // which profile cards are enabled for the nurse role (admin-configurable,
  // see app/admin/system/profile-cards) — defaults assume today's fields
  // until the fetch below resolves, so nothing flashes/disappears on load
  const [visibleCards, setVisibleCards] = useState<string[]>(['demographics', 'billing_info'])
  const setField = (k: string, v: any) => setProfile((p: any) => ({ ...p, [k]: v }))

  // My Signature
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [signatureLoading, setSignatureLoading] = useState(true)
  const [signatureSaving, setSignatureSaving] = useState(false)

  function loadSignature() {
    fetch('/api/nurse/signature', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setSignatureUrl(d.signatureUrl || null))
      .finally(() => setSignatureLoading(false))
  }

  useEffect(() => { loadSignature() }, [])

  async function saveSignature(dataUrl: string) {
    setSignatureSaving(true)
    const res = await fetch('/api/nurse/signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ imageDataUrl: dataUrl }),
    })
    setSignatureSaving(false)
    if (res.ok) loadSignature()
  }

  async function removeSignature() {
    await fetch('/api/nurse/signature', { method: 'DELETE', credentials: 'include' })
    setSignatureUrl(null)
  }

  // Quick-Access Shortcuts (home-screen Progress Note shortcut — see /quick-notes)
  type QuickAccessToken = { id: string; deviceLabel: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }
  const [tokens, setTokens] = useState<QuickAccessToken[]>([])
  const [tokensLoading, setTokensLoading] = useState(true)
  const [newDeviceLabel, setNewDeviceLabel] = useState('')
  const [creatingToken, setCreatingToken] = useState(false)
  const [justCreatedUrl, setJustCreatedUrl] = useState<string | null>(null)
  const [copyMsg, setCopyMsg] = useState('')

  function loadTokens() {
    fetch('/api/nurse/quick-access-tokens', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setTokens(d.tokens || []))
      .finally(() => setTokensLoading(false))
  }

  useEffect(() => { loadTokens() }, [])

  async function createToken() {
    if (!newDeviceLabel.trim()) return
    setCreatingToken(true)
    const res = await fetch('/api/nurse/quick-access-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ deviceLabel: newDeviceLabel.trim() }),
    })
    setCreatingToken(false)
    if (res.ok) {
      const { token } = await res.json()
      setJustCreatedUrl(`${window.location.origin}/quick-notes?t=${token}`)
      setNewDeviceLabel('')
      loadTokens()
    }
  }

  async function revokeToken(id: string) {
    await fetch(`/api/nurse/quick-access-tokens/${id}`, { method: 'DELETE', credentials: 'include' })
    loadTokens()
  }

  function copyUrl() {
    if (!justCreatedUrl) return
    navigator.clipboard.writeText(justCreatedUrl).then(() => {
      setCopyMsg('Copied!')
      setTimeout(() => setCopyMsg(''), 2000)
    })
  }

  useEffect(() => {
    fetch('/api/nurse/profile')
      .then((r) => {
        if (r.status === 401) { router.push('/login'); return }
        return r.json()
      })
      .then((data) => {
        if (data) {
          setUser(data.user)
          setProfile(data.profile || {})
          setMfaEnabled(data.user?.mfaEnabled ?? false)
          if (data.visibleCards) setVisibleCards(data.visibleCards)
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
      body: JSON.stringify(profile),
    })
    const data = await res.json()
    if (res.ok) { setMessage('Profile updated successfully.'); setEditingProfile(false); router.refresh() }
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
      setPwMessage('Password changed successfully.')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } else {
      setPwMessage(data.error || 'Could not change password.')
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailMessage('')
    if (!newEmail.trim()) { setEmailMessage('Please enter a new email address.'); return }
    if (newEmail.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setEmailMessage('Email addresses do not match.'); return
    }
    const res = await fetch('/api/nurse/update-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ newEmail: newEmail.trim(), currentPassword: emailPassword }),
    })
    const data = await res.json()
    if (res.ok) {
      setEmailMessage('Email updated. Please log in again with your new address.')
      setUser(u => u ? { ...u, email: data.email } : u)
      setNewEmail(''); setConfirmEmail(''); setEmailPassword('')
    } else {
      setEmailMessage(data.error || 'Could not update email.')
    }
  }

  async function startMfaSetup() {
    setMfaMessage('')
    setMfaLoading(true)
    const res = await fetch('/api/auth/2fa/setup', { method: 'POST', credentials: 'include' })
    const data = await res.json()
    setMfaQr(data.qrCodeUrl)
    setMfaSecret(data.secret)
    setMfaStep('setup')
    setMfaCode('')
    setMfaLoading(false)
  }

  async function enableMfa() {
    if (mfaCode.length !== 6) { setMfaMessage('Enter the 6-digit code from your app.'); return }
    setMfaLoading(true)
    setMfaMessage('')
    const res = await fetch('/api/auth/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ secret: mfaSecret, code: mfaCode }),
    })
    const data = await res.json()
    if (res.ok) {
      setMfaEnabled(true)
      setMfaStep('idle')
      setMfaQr('')
      setMfaSecret('')
      setMfaCode('')
      setMfaMessage('✓ Two-factor authentication is now enabled.')
    } else {
      setMfaMessage(data.error || 'Invalid code — try again.')
    }
    setMfaLoading(false)
  }

  async function disableMfa() {
    if (mfaCode.length !== 6) { setMfaMessage('Enter your current 6-digit code to confirm.'); return }
    setMfaLoading(true)
    setMfaMessage('')
    const res = await fetch('/api/auth/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code: mfaCode }),
    })
    const data = await res.json()
    if (res.ok) {
      setMfaEnabled(false)
      setMfaStep('idle')
      setMfaCode('')
      setMfaMessage('Two-factor authentication has been disabled.')
    } else {
      setMfaMessage(data.error || 'Invalid code — try again.')
    }
    setMfaLoading(false)
  }

  if (loading) return <div className="p-8">Loading…</div>

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8 pl-0 md:pl-0">
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

        {/* ── Col 1+2: Personal Information + myLogin ── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Demographics + Billing Info — shared cards, reused across every account role */}
          {!editingProfile ? (
            <>
              <ProfileDemographicsCard data={profile} readOnly={false} editing={false} onEdit={() => setEditingProfile(true)} setField={setField} />
              {visibleCards.includes('billing_info') && (
                <ProfileBillingInfoCard data={profile} readOnly={false} editing={false} onEdit={() => setEditingProfile(true)} setField={setField} />
              )}
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <ProfileDemographicsCard data={profile} readOnly={false} editing={true} onEdit={() => {}} setField={setField} />
              {visibleCards.includes('billing_info') && (
                <ProfileBillingInfoCard data={profile} readOnly={false} editing={true} onEdit={() => {}} setField={setField} />
              )}
              <div className="bg-white rounded-xl shadow p-6 space-y-3">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingProfile(false)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:border-[#7A8F79] transition">
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

          {/* My Signature — reusable drawn e-signature for future signing flows */}
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

          {/* Quick-Access Shortcuts — home-screen shortcut straight to New Progress
              Note / My Drafts. A separate, narrowly-scoped credential, not your
              login — it can't read anything except your own drafts. */}
          <div className="bg-white rounded-xl shadow p-6 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E]">Quick-Access Shortcuts</p>
            <p className="text-xs text-[#7A8F79] leading-relaxed">
              Create a link for your phone&apos;s home screen that jumps straight to starting or continuing a Progress Note —
              skips normal login, but can only create/edit/sign your own draft notes for your active patients. Nothing else.
            </p>

            {justCreatedUrl && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800">Save this link now — you won&apos;t be able to see it again (only revoke and create a new one).</p>
                <p className="text-xs font-mono text-[#2F3E4E] break-all bg-white rounded px-2 py-1.5 border border-[#D9E1E8]">{justCreatedUrl}</p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={copyUrl} className="text-xs font-semibold text-white bg-[#2F3E4E] px-3 py-1.5 rounded-lg hover:bg-[#7A8F79] transition">Copy Link</button>
                  {copyMsg && <span className="text-xs text-green-600 font-medium">{copyMsg}</span>}
                  <button type="button" onClick={() => setJustCreatedUrl(null)} className="text-xs text-[#7A8F79] ml-auto">Done</button>
                </div>
                <p className="text-[10px] text-amber-700">Open this link on your phone, then use your browser&apos;s &quot;Add to Home Screen.&quot;</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                className="flex-1 border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                placeholder="Device name (e.g. My iPhone)"
                value={newDeviceLabel}
                onChange={e => setNewDeviceLabel(e.target.value)}
              />
              <button type="button" onClick={createToken} disabled={creatingToken || !newDeviceLabel.trim()} className="text-sm font-semibold text-white bg-[#2F3E4E] px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50 whitespace-nowrap">
                {creatingToken ? 'Creating…' : '+ Create'}
              </button>
            </div>

            {!tokensLoading && tokens.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {tokens.map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm text-[#2F3E4E] font-semibold">{t.deviceLabel}{t.revokedAt ? ' (revoked)' : ''}</p>
                      <p className="text-xs text-[#7A8F79]">
                        Created {new Date(t.createdAt).toLocaleDateString()}
                        {t.lastUsedAt ? ` · Last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : ' · Never used'}
                      </p>
                    </div>
                    {!t.revokedAt && (
                      <button type="button" onClick={() => revokeToken(t.id)} className="text-xs font-semibold text-red-500 hover:text-red-700 transition">Revoke</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2FA */}
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-[#2F3E4E]">
                  Two-Factor Authentication
                </h2>
                <p className="text-xs text-[#7A8F79] mt-0.5">Require a code from your authenticator app at login.</p>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${mfaEnabled ? 'bg-green-100 text-green-700' : 'bg-[#F4F6F5] text-[#7A8F79]'}`}>
                {mfaEnabled ? '✓ Enabled' : 'Off'}
              </span>
            </div>

            {mfaMessage && (
              <p className={`text-xs font-medium px-3 py-2 rounded-lg mb-4 ${mfaMessage.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                {mfaMessage}
              </p>
            )}

            {/* Idle — not yet set up */}
            {mfaStep === 'idle' && !mfaEnabled && (
              <button
                onClick={startMfaSetup}
                disabled={mfaLoading}
                className="w-full bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
              >
                {mfaLoading ? 'Loading…' : 'Set Up 2FA'}
              </button>
            )}

            {/* Setup flow — show QR + verify first code */}
            {mfaStep === 'setup' && (
              <div className="space-y-4">
                <p className="text-sm text-[#2F3E4E]">
                  Scan this QR code with <strong>Apple Passwords</strong>, <strong>Google Authenticator</strong>, or any TOTP app, then enter the 6-digit code to confirm.
                </p>
                {mfaQr && (
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mfaQr} alt="2FA QR Code" className="w-48 h-48 rounded-xl border border-[#D9E1E8]" />
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Can&apos;t scan? Enter this code manually:</p>
                  <p className="font-mono text-xs bg-[#F4F6F5] rounded-lg px-3 py-2 text-[#2F3E4E] tracking-widest break-all">{mfaSecret}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">6-Digit Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] text-center text-xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setMfaStep('idle'); setMfaQr(''); setMfaSecret(''); setMfaCode(''); setMfaMessage('') }}
                    className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:border-[#7A8F79] transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={enableMfa}
                    disabled={mfaLoading || mfaCode.length !== 6}
                    className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
                  >
                    {mfaLoading ? 'Verifying…' : 'Enable 2FA'}
                  </button>
                </div>
              </div>
            )}

            {/* Enabled — show disable option */}
            {mfaStep === 'idle' && mfaEnabled && (
              <div className="space-y-3">
                <p className="text-xs text-[#7A8F79]">Your account is protected. To disable, enter your current authenticator code below.</p>
                {mfaStep === 'idle' && (
                  <button
                    onClick={() => { setMfaStep('disabling'); setMfaCode(''); setMfaMessage('') }}
                    className="w-full border border-red-300 text-red-500 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 transition"
                  >
                    Disable 2FA
                  </button>
                )}
              </div>
            )}

            {/* Disabling flow */}
            {mfaStep === 'disabling' && (
              <div className="space-y-3">
                <p className="text-sm text-[#2F3E4E]">Enter your current 6-digit authenticator code to confirm.</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] text-center text-xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setMfaStep('idle'); setMfaCode(''); setMfaMessage('') }}
                    className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:border-[#7A8F79] transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={disableMfa}
                    disabled={mfaLoading || mfaCode.length !== 6}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {mfaLoading ? 'Disabling…' : 'Confirm Disable'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* myLogin — email + password, 2-col */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-semibold text-[#2F3E4E] mb-5">
              <span style={{ color: '#7A8F79', fontStyle: 'italic' }}>my</span>Login Info
            </h2>

            <div className="grid sm:grid-cols-2 gap-6">

              {/* ── Left: Email Update ── */}
              <form onSubmit={changeEmail} className="space-y-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-widest text-[#2F3E4E] mb-0.5">Update Email Address</p>
                  <p className="text-xs text-[#7A8F79]">
                    Current email: <span className="font-semibold text-[#2F3E4E]">{user?.email}</span>
                  </p>
                </div>
                <input
                  type="email"
                  placeholder="new@email.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-gray-500"
                />
                <input
                  type="email"
                  placeholder="Confirm new email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  required
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-gray-500"
                />
                <input
                  type="password"
                  placeholder="Enter Current Password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  required
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-gray-500"
                />
                <button type="submit" className="w-full bg-[#2F3E4E] text-white p-2 rounded-lg hover:bg-[#7A8F79] transition font-semibold text-sm">
                  Update Email
                </button>
                {emailMessage && (
                  <p className={`text-xs text-center font-medium ${emailMessage.includes('updated') ? 'text-green-600' : 'text-red-500'}`}>
                    {emailMessage}
                  </p>
                )}
              </form>

              {/* ── Right: Password Change ── */}
              <form onSubmit={changePassword} className="space-y-3 sm:border-l sm:border-[#D9E1E8] sm:pl-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-widest text-[#2F3E4E] mb-0.5">Change Password</p>
                  <p className="text-xs text-[#7A8F79]">Choose a strong password you haven&apos;t used before.</p>
                </div>
                <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-gray-500" />
                <input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-gray-500" />
                <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-gray-500" />
                <button type="submit" className="w-full bg-[#2F3E4E] text-white p-2 rounded-lg hover:bg-[#7A8F79] transition font-semibold text-sm">
                  Update Password
                </button>
                {pwMessage && (
                  <p className={`text-xs text-center font-medium ${pwMessage.includes('successfully') ? 'text-green-600' : 'text-red-500'}`}>
                    {pwMessage}
                  </p>
                )}
              </form>

            </div>
          </div>

        </div>

        {/* ── Col 3: myBilling + myNotifications ── */}
        <div className="lg:col-span-2 space-y-5">
          <BillingSection profile={profile} onUnenroll={() => setProfile({ ...profile, enrolledInBilling: false })} />
          <NotifPrefsBlock profile={profile} setProfile={setProfile} />
        </div>

      </div>
    </div>
  )
}

// ── Notification preferences ──────────────────────────────────────────────────

function NotifPrefsBlock({ profile, setProfile }: { profile: any; setProfile: (p: any) => void }) {
  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[#2F3E4E]">
          <span style={{ color: '#7A8F79', fontStyle: 'italic' }}>my</span>Notifications
        </h2>
        <p className="text-xs text-[#7A8F79] mt-0.5">Choose which emails you&apos;d like to receive.</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-3">Reminders</p>
        <div className="space-y-3">
          {[
            { field: 'receiveNotifications',  label: 'Weekly Hour Submission',     desc: 'Weekly reminder to submit your hours' },
            { field: 'notifyBillingReminder', label: 'Billing Reminder',           desc: 'Reminders related to invoices and billing activity' },
            { field: 'notifyDocExpiring',     label: 'Document / License Expiring', desc: 'Alerts before a document or license on file reaches its expiration date' },
          ].map(({ field, label, desc }) => (
            <NotifToggle key={field} label={label} desc={desc} checked={profile[field] !== false}
              onChange={async (val) => {
                setProfile({ ...profile, [field]: val })
                await fetch('/api/nurse/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ [field]: val }) })
              }}
            />
          ))}
        </div>
      </div>
      <div className="pt-4 border-t border-[#D9E1E8]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-3">Alerts</p>
        <div className="space-y-3">
          {[
            { field: 'notifyNewDocument', label: 'New Document Added', desc: 'Email when a new document is uploaded to your account' },
            { field: 'notifyNewClaim',    label: 'New Claim Added',    desc: 'Email when a new claim is added to your profile' },
          ].map(({ field, label, desc }) => (
            <NotifToggle key={field} label={label} desc={desc} checked={profile[field] !== false}
              onChange={async (val) => {
                setProfile({ ...profile, [field]: val })
                await fetch('/api/nurse/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ [field]: val }) })
              }}
            />
          ))}
        </div>
      </div>
      <div className="pt-4 border-t border-[#D9E1E8]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-3">Messaging</p>
        <MessagingPrefToggle />
      </div>
    </div>
  )
}

function NotifToggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (val: boolean) => void }) {
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

// ── Billing section ───────────────────────────────────────────────────────────

function BillingSection({ profile, onUnenroll }: { profile: any; onUnenroll: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleUnenroll() {
    setLoading(true)
    await fetch('/api/nurse/unenroll', { method: 'POST', credentials: 'include' })
    setLoading(false); setDone(true); setConfirming(false); onUnenroll()
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
