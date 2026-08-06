'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function FamilyLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Invalid credentials')
        setLoading(false)
        return
      }

      if (data.requires2FA) {
        if (data.needsProfileInfo) {
          window.location.href = `/login/complete-profile?needsConsent=${data.needsConsent}`
        } else if (data.needsConsent) {
          window.location.href = '/login/consent'
        } else if (data.hasSms || data.hasAuthenticator) {
          window.location.href = '/login/choose'
        } else {
          // No phone on file — auto-send to email and go straight to verify
          await fetch('/api/auth/2fa/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ method: 'email' }),
          })
          window.location.href = '/login/verify?via=email'
        }
        return
      }

      window.location.href = '/family'

    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] flex items-stretch">

      {/* Left — branding panel */}
      <div className="hidden md:flex flex-col justify-top pt-24 gap-8 bg-[#2F3E4E] text-white w-1/3 px-12 py-16 ">
        <div>
          <div className="flex items-baseline gap-2 border-t border-[#3d5166] pt-6 mb-2">
            <p className="text-sm normal tracking-widest text-[#7A8F79] font-semibold">Inside the <span className="italic text-lg text-[#7A8F79]">my</span><span className="font-bold text-lg text-[#ffffff]">Care</span> portal</p>
          </div>
          <p className="text-sm normal tracking-widest text-[#7A8F79] font-semibold">You'll find...</p>
        </div>

        <div className="space-y-3">
          {[
            { icon: '❤️', label: 'More time together, less time on paperwork' },
            { icon: '💊', label: 'Medication reminders so no dose is missed' },
            { icon: '📁', label: 'All documents and forms organized in one place' },
            { icon: '🤝', label: "Easily share forms & files with your nurse care team" },
            { icon: '📅', label: 'Prior authorization renewal reminders' },
            { icon: '🗓️', label: "View your loved one's upcoming visits & schedule" },
            { icon: '🔒', label: 'Secure, private access to their care information' }
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="text-xl">{f.icon}</span>
              <p className="text-sm text-[#D9E1E8]">{f.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1">
            <p className="pt-4 pl-8 text-sm italic text-left text-[#7A8F79] border-t border-[#3d5166]">
                &ldquo;You care for them every day. </p>
          <p className="pb-4 pr-10 text-sm italic text-right text-[#7A8F79] border-b border-[#3d5166]">Let us help take care of the details.&rdquo;
          </p>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex flex-col justify-top pt-36 w-full md:w-2/3 px-8 md:px-16 py-16">
        <div className="max-w-sm w-full mx-auto">
          <p className="text-sm uppercase tracking-widest text-[#7A8F79] font-semibold mb-1">Welcome to your</p>
          <h1 className="text-3xl font-bold text-[#2F3E4E] mb-1 whitespace-nowrap">
            <span className="italic text-[#7A8F79]">my</span>Care Login
          </h1>
          <p className="text-sm text-[#7A8F79] mb-8">Sign in to view your loved one's care.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              autoComplete="email"
              required
              className="w-full border border-[#D9E1E8] p-3 rounded-lg text-[#2F3E4E] placeholder-[#7A8F79] bg-white focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              className="w-full border border-[#D9E1E8] p-3 rounded-lg text-[#2F3E4E] placeholder-[#7A8F79] bg-white focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2F3E4E] text-white p-3 rounded-lg hover:bg-[#7A8F79] transition font-semibold disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {error && (
            <p className="mt-4 text-sm text-red-600 text-center">{error}</p>
          )}

          <p className="mt-5 text-center text-sm text-[#7A8F79]">
            <Link href="/forgot-password" className="underline underline-offset-2 hover:text-[#2F3E4E]">
              Forgot your password?
            </Link>
          </p>

        </div>
      </div>

    </div>
  )
}
