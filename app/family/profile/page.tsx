'use client'

import { useState, useEffect } from 'react'
import { fmtPhoneInput } from '../../../lib/formatPhone'
import Tabs from '../../components/Tabs'
import AppearanceControls from '../../components/AppearanceControls'
import { Row } from '../../components/ReadOnlyField'
import GuardianInviteModal from '../../components/GuardianInviteModal'
import MessagingPrefToggle from '../../components/MessagingPrefToggle'
import ProfileDemographicsCard from '../../components/profile/ProfileDemographicsCard'

type LinkedPatient = {
  id: string
  firstName: string
  lastName: string
  medicationRemindersOptIn: boolean
}

export default function FamilyProfilePage() {
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [profileTab, setProfileTab] = useState<'profile' | 'settings'>('profile')

  // SMS phone number
  const [phone, setPhone] = useState('')
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneSaved, setPhoneSaved] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  // Authenticator app (TOTP)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaStep, setMfaStep] = useState<'idle' | 'setup' | 'disabling'>('idle')
  const [mfaQr, setMfaQr] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaMessage, setMfaMessage] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)

  const [patients, setPatients] = useState<LinkedPatient[]>([])

  // Change email
  const [newEmail, setNewEmail] = useState('')
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')
  const [emailMessageIsError, setEmailMessageIsError] = useState(false)

  // Change password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordMessageIsError, setPasswordMessageIsError] = useState(false)

  // Settings tab — invite another guardian
  const [invitingGuardian, setInvitingGuardian] = useState(false)
  const [invitePatientId, setInvitePatientId] = useState('')

  // Demographics card (admin-configurable — see app/admin/system/profile-cards)
  const [demographics, setDemographics] = useState<any>({})
  const [visibleCards, setVisibleCards] = useState<string[]>(['demographics'])
  const [editingDemographics, setEditingDemographics] = useState(false)
  const [demoSaving, setDemoSaving] = useState(false)
  const [demoMessage, setDemoMessage] = useState('')

  function loadDemographics() {
    fetch('/api/family/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.profile) setDemographics(data.profile)
        if (data.visibleCards) setVisibleCards(data.visibleCards)
      })
      .catch(() => {})
  }

  const setDemographicsField = (k: string, v: any) => setDemographics((d: any) => ({ ...d, [k]: v }))

  async function saveDemographics(e: React.FormEvent) {
    e.preventDefault()
    setDemoSaving(true)
    setDemoMessage('')
    const res = await fetch('/api/family/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(demographics),
    })
    setDemoSaving(false)
    if (res.ok) { setDemoMessage('Saved.'); setEditingDemographics(false) }
    else { const data = await res.json(); setDemoMessage(data.error || 'Update failed.') }
  }

  function loadPatients() {
    fetch('/api/family/patients', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const list = data.patients || []
        setPatients(list)
        if (list.length === 1) setInvitePatientId(list[0].id)
      })
  }

  useEffect(() => {
    fetch('/api/family/account', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setName(data.name || '')
        setEmail(data.email || '')
        setPhone(data.phone ? fmtPhoneInput(data.phone) : '')
        setMfaEnabled(data.mfaEnabled ?? false)
        setLoading(false)
      })
    loadPatients()
    loadDemographics()
  }, [])

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailSaving(true); setEmailMessage(''); setEmailMessageIsError(false)
    const res = await fetch('/api/family/update-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ newEmail, currentPassword: emailCurrentPassword }),
    })
    const data = await res.json()
    setEmailSaving(false)
    if (res.ok) {
      setEmail(data.email)
      setNewEmail(''); setEmailCurrentPassword('')
      setEmailMessage('Email updated.')
    } else {
      setEmailMessage(data.error || 'Failed to update email.')
      setEmailMessageIsError(true)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordSaving(true); setPasswordMessage(''); setPasswordMessageIsError(false)
    const res = await fetch('/api/family/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json()
    setPasswordSaving(false)
    if (res.ok) {
      setCurrentPassword(''); setNewPassword('')
      setPasswordMessage('Password updated.')
    } else {
      setPasswordMessage(data.error || 'Failed to update password.')
      setPasswordMessageIsError(true)
    }
  }

  async function savePhone() {
    setPhoneSaving(true)
    setPhoneSaved(false)
    setPhoneError('')
    const res = await fetch('/api/family/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ phone }),
    })
    const data = await res.json()
    setPhoneSaving(false)
    if (res.ok) {
      setPhoneSaved(true)
      setEditingPhone(false)
      setTimeout(() => setPhoneSaved(false), 3000)
    } else {
      setPhoneError(data.error || 'Failed to save phone number')
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
      setMfaMessage('✓ Authenticator app 2FA is now enabled.')
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
      setMfaMessage('Authenticator app 2FA has been disabled.')
    } else {
      setMfaMessage(data.error || 'Invalid code — try again.')
    }
    setMfaLoading(false)
  }

  if (loading) {
    return <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0"><p className="text-sm text-[#7A8F79]">Loading…</p></div>
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
      <div className="max-w-6xl">
        <h1 className="text-2xl font-bold text-[#2F3E4E] mb-1">
          <span className="text-[#7A8F79] italic">my</span>Profile
        </h1>
        <p className="text-sm text-[#7A8F79] mb-6">Your account and security settings.</p>

        <div className="mb-4">
          <Tabs
            tabs={[{ key: 'profile', label: 'Profile' }, { key: 'settings', label: 'Settings' }]}
            active={profileTab}
            onChange={k => setProfileTab(k as 'profile' | 'settings')}
          />
        </div>

        {profileTab === 'profile' && (
        <div className="space-y-4">

          {/* Account info */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <p className="font-bold text-[#2F3E4E] text-sm mb-3">Account</p>
            <div className="text-sm space-y-1">
              <p><span className="text-[#7A8F79]">Name:</span> <span className="text-[#2F3E4E] font-medium">{name}</span></p>
              <p><span className="text-[#7A8F79]">Email:</span> <span className="text-[#2F3E4E] font-medium">{email}</span></p>
            </div>
          </div>

          {/* Demographics */}
          {visibleCards.includes('demographics') && (
            !editingDemographics ? (
              <ProfileDemographicsCard data={demographics} readOnly={false} editing={false} onEdit={() => setEditingDemographics(true)} setField={setDemographicsField} showPreferredName={false} />
            ) : (
              <form onSubmit={saveDemographics} className="space-y-4">
                <ProfileDemographicsCard data={demographics} readOnly={false} editing={true} onEdit={() => {}} setField={setDemographicsField} showPreferredName={false} />
                <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditingDemographics(false)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:border-[#7A8F79] transition">
                      Cancel
                    </button>
                    <button type="submit" disabled={demoSaving} className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                      {demoSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                  {demoMessage && <p className="text-sm text-center text-[#2F3E4E]">{demoMessage}</p>}
                </div>
              </form>
            )
          )}

          {/* SMS phone number */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">📞</span>
                <p className="font-bold text-[#2F3E4E] text-sm">Text (SMS) Verification</p>
              </div>
              {!editingPhone && phone.trim() && (
                <button onClick={() => setEditingPhone(true)} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
                  Edit
                </button>
              )}
            </div>
            <p className="text-xs text-[#7A8F79] leading-relaxed mb-4">
              Used to send one-time login codes via text message.
            </p>
            {!editingPhone && phone.trim() ? (
              <Row label="Phone" value={phone} />
            ) : (
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={phone}
                  onChange={e => setPhone(fmtPhoneInput(e.target.value))}
                  className="flex-1 border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
                <button
                  onClick={savePhone}
                  disabled={phoneSaving || !phone.trim()}
                  className="shrink-0 bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#7A8F79] transition disabled:opacity-50"
                >
                  {phoneSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
            {phoneError && <p className="text-xs text-red-500 mt-2">{phoneError}</p>}
            {phoneSaved && <p className="text-xs text-green-600 font-medium mt-2">Saved</p>}
          </div>

          {/* Authenticator app (TOTP) */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔑</span>
                <p className="font-bold text-[#2F3E4E] text-sm">Authenticator App</p>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${mfaEnabled ? 'bg-green-100 text-green-700' : 'bg-[#F4F6F5] text-[#7A8F79]'}`}>
                {mfaEnabled ? '✓ Enabled' : 'Off'}
              </span>
            </div>
            <p className="text-xs text-[#7A8F79] leading-relaxed mb-4">
              Use Apple Passwords, Google Authenticator, or any TOTP app as an alternative or backup to text/email codes.
            </p>

            {mfaMessage && (
              <p className={`text-xs font-medium px-3 py-2 rounded-lg mb-4 ${mfaMessage.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                {mfaMessage}
              </p>
            )}

            {mfaStep === 'idle' && !mfaEnabled && (
              <button
                onClick={startMfaSetup}
                disabled={mfaLoading}
                className="w-full bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
              >
                {mfaLoading ? 'Loading…' : 'Set Up Authenticator App'}
              </button>
            )}

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
                    {mfaLoading ? 'Verifying…' : 'Enable'}
                  </button>
                </div>
              </div>
            )}

            {mfaStep === 'idle' && mfaEnabled && (
              <div className="space-y-3">
                <p className="text-xs text-[#7A8F79]">Your account is protected. To disable, enter your current authenticator code below.</p>
                <button
                  onClick={() => { setMfaStep('disabling'); setMfaCode(''); setMfaMessage('') }}
                  className="w-full border border-red-300 text-red-500 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 transition"
                >
                  Disable Authenticator App
                </button>
              </div>
            )}

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

          <p className="text-xs text-[#7A8F79] px-1">
            Email codes are always available as a fallback with no setup required. Enabling more than one method
            gives you a backup if one service is temporarily unavailable.
          </p>


          {/* Messaging */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <p className="font-bold text-[#2F3E4E] text-sm mb-1">Messaging</p>
            <p className="text-xs text-[#7A8F79] leading-relaxed mb-4">Email alerts for new messages you receive on the portal.</p>
            <MessagingPrefToggle />
          </div>

          {/* Change email */}
          <form onSubmit={saveEmail} className="bg-white rounded-2xl shadow-sm p-6">
            <p className="font-bold text-[#2F3E4E] text-sm mb-1">Change Email</p>
            <p className="text-xs text-[#7A8F79] leading-relaxed mb-4">Update the email address you sign in with.</p>
            <div className="space-y-2">
              <input
                type="email"
                placeholder="New email address"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
              <input
                type="password"
                placeholder="Current password"
                value={emailCurrentPassword}
                onChange={e => setEmailCurrentPassword(e.target.value)}
                required
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
              <button
                type="submit"
                disabled={emailSaving}
                className="w-full bg-[#2F3E4E] text-white text-sm font-semibold py-2 rounded-xl hover:bg-[#7A8F79] transition disabled:opacity-50"
              >
                {emailSaving ? 'Saving…' : 'Update Email'}
              </button>
            </div>
            {emailMessage && (
              <p className={`text-xs mt-2 ${emailMessageIsError ? 'text-red-500' : 'text-green-600'}`}>{emailMessage}</p>
            )}
          </form>

          {/* Change password */}
          <form onSubmit={savePassword} className="bg-white rounded-2xl shadow-sm p-6">
            <p className="font-bold text-[#2F3E4E] text-sm mb-1">Change Password</p>
            <p className="text-xs text-[#7A8F79] leading-relaxed mb-4">Update your sign-in password.</p>
            <div className="space-y-2">
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
              <input
                type="password"
                placeholder="New password (min. 8 characters)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
              <button
                type="submit"
                disabled={passwordSaving}
                className="w-full bg-[#2F3E4E] text-white text-sm font-semibold py-2 rounded-xl hover:bg-[#7A8F79] transition disabled:opacity-50"
              >
                {passwordSaving ? 'Saving…' : 'Update Password'}
              </button>
            </div>
            {passwordMessage && (
              <p className={`text-xs mt-2 ${passwordMessageIsError ? 'text-red-500' : 'text-green-600'}`}>{passwordMessage}</p>
            )}
          </form>

        </div>
        )}

        {profileTab === 'settings' && (
          <div className="space-y-6">

            {/* Care Team — invite another guardian */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-[#2F3E4E] text-sm">Care Team</p>
              </div>
              <p className="text-xs text-[#7A8F79] leading-relaxed mb-4">
                Invite another family member to view and manage a linked patient&apos;s care.
              </p>
              {patients.length > 1 && (
                <select
                  value={invitePatientId}
                  onChange={e => setInvitePatientId(e.target.value)}
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] mb-3 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                >
                  <option value="">Select a patient…</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setInvitingGuardian(true)}
                disabled={!invitePatientId}
                className="w-full bg-[#2F3E4E] text-white text-sm font-semibold py-2 rounded-xl hover:bg-[#7A8F79] transition disabled:opacity-50"
              >
                + Invite Family Member
              </button>
              {invitingGuardian && invitePatientId && (
                <GuardianInviteModal
                  patientName={(() => {
                    const p = patients.find(p => p.id === invitePatientId)
                    return p ? `${p.firstName} ${p.lastName}` : ''
                  })()}
                  onClose={() => setInvitingGuardian(false)}
                  onInvite={async data => {
                    const res = await fetch(`/api/family/patients/${invitePatientId}/guardians`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify(data),
                    })
                    const body = await res.json()
                    return res.ok ? { ok: true } : { ok: false, error: body.error }
                  }}
                />
              )}
            </div>

            {/* Visual customization — same controls nurse/admin have */}
            <AppearanceControls />

          </div>
        )}
      </div>
    </div>
  )
}
