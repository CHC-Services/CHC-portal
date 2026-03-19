'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()

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

      window.location.href = '/'

    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] flex items-stretch">

      {/* Left — branding panel */}
      <div className="hidden md:flex flex-col justify-between bg-[#2F3E4E] text-white w-1/2 px-12 py-16">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-2">Coming Home Care</p>
          <h2 className="text-4xl font-bold leading-tight">
            <span className="italic text-[#7A8F79]">my</span>Provider{' '}
            <span className="text-white">Portal</span>
          </h2>
          <p className="mt-4 text-[#D9E1E8] text-sm leading-relaxed max-w-sm">
            Your secure home base for time tracking, claims management, billing enrollment, and renewal reminders — everything you need in one place.
          </p>
        </div>

        <div className="space-y-5">
          {[
            { icon: '⏱', label: 'Log hours instantly' },
            { icon: '📋', label: 'Track BCBS claims in real time' },
            { icon: '📅', label: 'Never miss a renewal deadline' },
            { icon: '📚', label: 'NY provider enrollment guides' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="text-xl">{f.icon}</span>
              <p className="text-sm text-[#D9E1E8]">{f.label}</p>
            </div>
          ))}

          <p className="pt-4 text-xs italic text-[#7A8F79] border-t border-[#3d5166]">
            &ldquo;You take care of everyone else. We take care of this.&rdquo;
          </p>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex flex-col justify-center w-full md:w-1/2 px-8 md:px-16 py-16">

        <div className="max-w-sm w-full mx-auto">
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-1">Welcome back</p>
          <h1 className="text-3xl font-bold text-[#2F3E4E] mb-1">
            <span className="italic text-[#7A8F79]">my</span>Provider Portal
          </h1>
          <p className="text-sm text-[#7A8F79] mb-8">Sign in to access your dashboard.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-[#D9E1E8] p-3 rounded-lg text-[#2F3E4E] placeholder-[#7A8F79] bg-white focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          <div className="mt-10 border-t border-[#D9E1E8] pt-6 text-center">
            <p className="text-xs text-[#7A8F79]">Not a provider yet?</p>
            <Link href="/billing" className="text-xs font-semibold text-[#2F3E4E] hover:text-[#7A8F79] underline underline-offset-2 transition">
              Learn about our billing services →
            </Link>
          </div>
        </div>
      </div>

    </div>
  )
}
