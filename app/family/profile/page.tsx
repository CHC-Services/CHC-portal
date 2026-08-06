'use client'

import { useState, useEffect } from 'react'
import { fmtPhoneInput } from '../../../lib/formatPhone'

export default function FamilyProfilePage() {
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  // SMS phone number
  const [phone, setPhone] = useState('')
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
  }, [])

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
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-[#2F3E4E] mb-1">
          <span className="text-[#7A8F79] italic">my</span>Profile
        </h1>
        <p className="text-sm text-[#7A8F79] mb-6">Your account and security settings.</p>

        <div className="space-y-4">

          {/* Account info */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <p className="font-bold text-[#2F3E4E] text-sm mb-3">Account</p>
            <div className="text-sm space-y-1">
              <p><span className="text-[#7A8F79]">Name:</span> <span className="text-[#2F3E4E] font-medium">{name}</span></p>
              <p><span className="text-[#7A8F79]">Email:</span> <span className="text-[#2F3E4E] font-medium">{email}</span></p>
            </div>
          </div>

          {/* SMS phone number */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">📞</span>
              <p className="font-bold text-[#2F3E4E] text-sm">Text (SMS) Verification</p>
            </div>
            <p className="text-xs text-[#7A8F79] leading-relaxed mb-4">
              Used to send one-time login codes via text message.
            </p>
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

        </div>
      </div>
    </div>
  )
}
