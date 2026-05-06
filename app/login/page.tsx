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

      // Nurses who haven't signed the portal agreement go there first
      if ((data.role === 'nurse' || data.role === 'provider') && !data.portalAgreementSigned) {
        window.location.href = '/nurse/agreement'
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
      <div className="hidden md:flex flex-col justify-top pt-24 gap-8 bg-[#2F3E4E] text-white w-1/3 px-12 py-16 ">
        <div>
          <div className="flex items-baseline gap-2 border-t border-[#3d5166] pt-6 mb-2">
            <p className="text-sm normal tracking-widest text-[#7A8F79] font-semibold">Inside the provider's</p>
            <h3 className="text-xl font-bold leading-tight">
              <span className="italic text-[#7A8F79]">my</span>Portal
            </h3>
          </div>
          <p className="text-sm normal tracking-widest text-[#7A8F79] font-semibold">You'll find...</p>
        </div>

        <div className="space-y-3">
          {[
            { icon: '⏰', label: 'Easily log your hours from anywhere' },
            { icon: '📊', label: 'Claim status tracker & income reports' },
            { icon: '📅', label: 'Important document renewal reminders' },
            { icon: '🧾', label: 'Review & pay invoices, save receipts' },
            { icon: '✍🏼', label: 'Provider guides for Medicaid enrollment' },
            { icon: '⏳', label: 'Self-employed tax date reminders' },
            { icon: '🗄️', label: 'Secure storage for sensitive documents' }
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="text-xl">{f.icon}</span>
              <p className="text-sm text-[#D9E1E8]">{f.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1">
            <p className="pt-4 pl-8 text-sm italic text-left text-[#7A8F79] border-t border-[#3d5166]">
                &ldquo;You take care of everyone else. </p>
          <p className="pb-4 pr-10 text-sm italic text-right text-[#7A8F79] border-b border-[#3d5166]">Let us help take care of this.&rdquo;
          </p>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex flex-col justify-top pt-36 w-full md:w-2/3 px-8 md:px-16 py-16">
        <div className="max-w-sm w-full mx-auto">
          <p className="text-sm uppercase tracking-widest text-[#7A8F79] font-semibold mb-1">Welcome to your</p>
          <h1 className="text-3xl font-bold text-[#2F3E4E] mb-1 whitespace-nowrap">
            <span className="italic text-[#7A8F79]">my</span>Portal Login
          </h1>
          <p className="text-sm text-[#7A8F79]">Sign in to access your provider dashboard.</p>
          <p className="text-sm mt-2 mb-8">
            <span className="text-[#7A8F79]">New user?</span>{' '}
            <Link href="/signup" className="font-semibold text-[#2F3E4E] underline underline-offset-2 hover:text-[#7A8F79] transition">
              Create an Account.
            </Link>
          </p>

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

        </div>
      </div>

    </div>
  )
}
