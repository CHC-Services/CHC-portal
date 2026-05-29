'use client'

import { useState, useEffect } from 'react'
import AdminNav from '../../../components/AdminNav'
import Link from 'next/link'

export default function SecuritySettingsPage() {
  const [twofaEnabled, setTwofaEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/system/security')
      .then(r => r.json())
      .then(data => {
        setTwofaEnabled(data.twofaEnabled ?? false)
        setLoading(false)
      })
  }, [])

  async function toggle() {
    setSaving(true)
    setSaved(false)
    const next = !twofaEnabled
    const res = await fetch('/api/admin/system/security', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ twofaEnabled: next }),
    })
    if (res.ok) {
      setTwofaEnabled(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
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
        <div className="bg-white rounded-2xl shadow-sm border border-transparent p-6">
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
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  twofaEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-[#D9E1E8] flex items-center gap-2">
            {loading ? (
              <span className="text-xs text-[#7A8F79]">Loading…</span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                twofaEnabled
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-[#F4F6F5] text-[#7A8F79] border border-[#D9E1E8]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${twofaEnabled ? 'bg-green-500' : 'bg-[#7A8F79]'}`} />
                {twofaEnabled ? 'Enabled for all users' : 'Disabled — admin accounts only'}
              </span>
            )}
            {saved && (
              <span className="text-xs text-green-600 font-medium">Saved</span>
            )}
          </div>
        </div>

        {/* Note about admin accounts */}
        <div className="bg-white rounded-2xl shadow-sm border border-transparent p-6">
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
