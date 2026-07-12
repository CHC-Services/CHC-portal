'use client'

import { useState, useEffect } from 'react'
import AdminNav from '../../../components/AdminNav'
import Link from 'next/link'
import { fmtPhoneInput } from '../../../../lib/formatPhone'

type SmsKeyEntry = { label: string; addedAt: string; masked: string; quotaRemaining: number | null }

export default function SecuritySettingsPage() {
  const [twofaEnabled, setTwofaEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // SMS key manager
  const [smsKeys, setSmsKeys] = useState<SmsKeyEntry[]>([])
  const [smsKeysLoading, setSmsKeysLoading] = useState(false)
  const [smsKeysLoaded, setSmsKeysLoaded] = useState(false)
  const [newApiKey, setNewApiKey] = useState('')
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [addingKey, setAddingKey] = useState(false)
  const [addKeyError, setAddKeyError] = useState('')
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null)

  // Admin's own 2FA phone number
  const [phone, setPhone] = useState('')
  const [phoneLoading, setPhoneLoading] = useState(true)
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneSaved, setPhoneSaved] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  useEffect(() => {
    fetch('/api/admin/system/security', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setTwofaEnabled(data.twofaEnabled ?? false)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetch('/api/admin/account', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setPhone(data.phone ? fmtPhoneInput(data.phone) : '')
        setPhoneLoading(false)
      })
  }, [])

  async function savePhone() {
    setPhoneSaving(true)
    setPhoneSaved(false)
    setPhoneError('')
    const res = await fetch('/api/admin/account', {
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

  async function toggle() {
    setSaving(true)
    setSaved(false)
    const next = !twofaEnabled
    const res = await fetch('/api/admin/system/security', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ twofaEnabled: next }),
    })
    if (res.ok) {
      setTwofaEnabled(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  async function loadSmsKeys() {
    setSmsKeysLoading(true)
    try {
      const res = await fetch('/api/admin/system/textbelt-keys', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) { setSmsKeys(data.keys ?? []); setSmsKeysLoaded(true) }
    } finally {
      setSmsKeysLoading(false)
    }
  }

  async function addKey() {
    if (!newApiKey.trim()) return
    setAddingKey(true)
    setAddKeyError('')
    const res = await fetch('/api/admin/system/textbelt-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ apiKey: newApiKey.trim(), label: newKeyLabel.trim() }),
    })
    const data = await res.json()
    setAddingKey(false)
    if (!res.ok) { setAddKeyError(data.error || 'Failed to add key'); return }
    setNewApiKey('')
    setNewKeyLabel('')
    loadSmsKeys()
  }

  async function deleteKey(index: number) {
    setDeletingIndex(index)
    await fetch('/api/admin/system/textbelt-keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ index }),
    })
    setDeletingIndex(null)
    loadSmsKeys()
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <AdminNav />

      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin/system" className="text-sm text-[#7A8F79] hover:text-[#2F3E4E] transition">⚙ System</Link>
        <span className="text-[#7A8F79] text-sm">/</span>
        <span className="text-sm text-[#2F3E4E] font-semibold">Security</span>
      </div>
      <h1 className="text-3xl font-bold text-[#2F3E4E] mb-1">Security</h1>
      <p className="text-sm text-[#7A8F79] mb-8">Manage authentication and access controls.</p>

      <div className="max-w-xl space-y-4">

        {/* 2FA global toggle */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🔐</span>
                <p className="font-bold text-[#2F3E4E] text-sm">Two-Step Verification — All Users</p>
              </div>
              <p className="text-xs text-[#7A8F79] leading-relaxed">
                When enabled, every user will be prompted for a one-time code at login via SMS or email.
                Users will see a one-time consent notice on their first 2FA login.
                Admins with individual 2FA enabled are unaffected by this toggle.
              </p>
            </div>
            <button
              onClick={toggle}
              disabled={loading || saving}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                twofaEnabled ? 'bg-[#2F3E4E]' : 'bg-[#D9E1E8]'
              }`}
              role="switch"
              aria-checked={twofaEnabled}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${twofaEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-[#D9E1E8] flex items-center gap-2">
            {loading ? (
              <span className="text-xs text-[#7A8F79]">Loading…</span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${twofaEnabled ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-[#F4F6F5] text-[#7A8F79] border border-[#D9E1E8]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${twofaEnabled ? 'bg-green-500' : 'bg-[#7A8F79]'}`} />
                {twofaEnabled ? 'Enabled for all users' : 'Disabled — admin accounts only'}
              </span>
            )}
            {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
          </div>
        </div>

        {/* Admin's own 2FA phone number */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📞</span>
            <p className="font-bold text-[#2F3E4E] text-sm">Your 2FA Phone Number</p>
          </div>
          <p className="text-xs text-[#7A8F79] leading-relaxed mb-4">
            Used to send your one-time login codes via SMS. Updating this replaces the number on your admin account.
          </p>
          <div className="flex gap-2">
            <input
              type="tel"
              placeholder="(555) 555-5555"
              value={phone}
              disabled={phoneLoading}
              onChange={e => setPhone(fmtPhoneInput(e.target.value))}
              className="flex-1 border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79] disabled:opacity-50"
            />
            <button
              onClick={savePhone}
              disabled={phoneLoading || phoneSaving || !phone.trim()}
              className="shrink-0 bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#7A8F79] transition disabled:opacity-50"
            >
              {phoneSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {phoneError && <p className="text-xs text-red-500 mt-2">{phoneError}</p>}
          {phoneSaved && <p className="text-xs text-green-600 font-medium mt-2">Saved</p>}
        </div>

        {/* TextBelt SMS Key Manager */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">📱</span>
                <p className="font-bold text-[#2F3E4E] text-sm">SMS API Keys — TextBelt</p>
              </div>
              <p className="text-xs text-[#7A8F79] leading-relaxed">
                Store one or more TextBelt API keys. When a key runs out of credits it automatically falls over to the next one.
                Keys are stored in the database — no Vercel env var needed.
              </p>
            </div>
            <button
              onClick={smsKeysLoaded ? loadSmsKeys : loadSmsKeys}
              disabled={smsKeysLoading}
              className="shrink-0 border border-[#D9E1E8] text-[#7A8F79] text-xs font-semibold px-3 py-1.5 rounded-lg hover:border-[#7A8F79] hover:text-[#2F3E4E] transition disabled:opacity-50"
            >
              {smsKeysLoading ? 'Loading…' : smsKeysLoaded ? 'Refresh' : 'Load Keys'}
            </button>
          </div>

          {/* Key list */}
          {smsKeysLoaded && (
            <div className="space-y-2 mb-4">
              {smsKeys.length === 0 ? (
                <p className="text-xs text-[#7A8F79] italic">No keys stored yet. Add one below.</p>
              ) : (
                smsKeys.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 border border-[#D9E1E8] rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          entry.quotaRemaining === null ? 'bg-[#D9E1E8]' :
                          entry.quotaRemaining === 0 ? 'bg-red-400' :
                          entry.quotaRemaining < 10 ? 'bg-amber-400' : 'bg-green-400'
                        }`} />
                        <p className="text-xs font-mono text-[#2F3E4E] truncate">{entry.masked}</p>
                        {i === 0 && <span className="text-[10px] font-semibold bg-[#2F3E4E] text-white px-1.5 py-0.5 rounded-full shrink-0">Active</span>}
                      </div>
                      <p className="text-[10px] text-[#7A8F79] mt-0.5">{entry.label}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {entry.quotaRemaining === null ? (
                        <p className="text-xs text-[#7A8F79]">—</p>
                      ) : entry.quotaRemaining === 0 ? (
                        <p className="text-xs text-red-500 font-semibold">0 left</p>
                      ) : (
                        <p className={`text-sm font-black ${entry.quotaRemaining < 10 ? 'text-amber-500' : 'text-green-600'}`}>
                          {entry.quotaRemaining.toLocaleString()}
                        </p>
                      )}
                      <p className="text-[10px] text-[#7A8F79]">credits</p>
                    </div>
                    <button
                      onClick={() => deleteKey(i)}
                      disabled={deletingIndex === i}
                      className="shrink-0 text-red-400 hover:text-red-600 text-xs font-semibold transition disabled:opacity-40"
                    >
                      {deletingIndex === i ? '…' : 'Remove'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Add new key form */}
          <div className="border-t border-[#D9E1E8] pt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Add a Key</p>
            <input
              type="text"
              placeholder="TextBelt API key"
              value={newApiKey}
              onChange={e => setNewApiKey(e.target.value)}
              className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] font-mono"
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Label (e.g. Purchased June 2026)"
                value={newKeyLabel}
                onChange={e => setNewKeyLabel(e.target.value)}
                className="flex-1 border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
              <button
                onClick={addKey}
                disabled={addingKey || !newApiKey.trim()}
                className="shrink-0 bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50"
              >
                {addingKey ? 'Verifying…' : 'Add'}
              </button>
            </div>
            {addKeyError && <p className="text-xs text-red-500">{addKeyError}</p>}
            <p className="text-[10px] text-[#7A8F79]">The key is verified with TextBelt before saving. Keys are tried in order — the first one with credits is used automatically.</p>
            <div className="mt-3 bg-[#F4F6F5] border border-[#D9E1E8] rounded-xl px-4 py-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#2F3E4E]">💡 Topping off your existing key</p>
              <p className="text-[10px] text-[#7A8F79] leading-relaxed">
                You don&apos;t need a new key when you run out. Go to <span className="font-semibold text-[#2F3E4E]">textbelt.com</span>, purchase additional credits, and enter your <span className="font-semibold text-[#2F3E4E]">existing key</span> at checkout. TextBelt adds the credits directly to it — your whitelist approval and message template stay intact. No new review required.
              </p>
              <p className="text-[10px] text-[#7A8F79] leading-relaxed">
                Only add a second key here if you want a true backup. For normal use, one key topped off as needed is all you need.
              </p>
            </div>
          </div>
        </div>

        {/* Note about admin accounts */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5">ℹ️</span>
            <div>
              <p className="font-bold text-[#2F3E4E] text-sm mb-1">Admin Account 2FA</p>
              <p className="text-xs text-[#7A8F79] leading-relaxed mb-3">
                Admin accounts have individual 2FA controlled separately via their user record and are not affected by the toggle above.
                To disable admin 2FA, run the following query in the Supabase SQL Editor:
              </p>
              <pre className="bg-[#F4F6F5] border border-[#D9E1E8] rounded-lg px-4 py-3 text-xs text-[#2F3E4E] font-mono leading-relaxed whitespace-pre-wrap break-all select-all">
{`UPDATE "User" SET "mfaEnabled" = false WHERE email = 'alex@cominghomecare.com';`}
              </pre>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
