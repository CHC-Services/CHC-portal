'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [signupRole, setSignupRole] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [countdown, setCountdown] = useState(4)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ firstName, lastName, phone, email, password, signupRole }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setLoading(false)
        return
      }

      setSuccess(true)
      setLoading(false)
      let secs = 4
      setCountdown(secs)
      const interval = setInterval(() => {
        secs -= 1
        setCountdown(secs)
        if (secs <= 0) {
          clearInterval(interval)
          router.push('/nurse/portal')
        }
      }, 1000)
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


      {/* Right — signup form */}
      <div className="flex flex-col justify-top pt-36 w-full md:w-2/3 px-8 md:px-16 py-16">
        <div className="max-w-sm w-full mx-auto">
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-1">Get started</p>
          <h1 className="text-3xl font-bold text-[#2F3E4E] mb-1 whitespace-nowrap">
            <span className="italic text-[#7A8F79]">my</span>Provider Portal
          </h1>
          <p className="text-sm text-[#7A8F79] mb-8">Create your account to access the provider portal.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <select
              value={signupRole}
              onChange={e => setSignupRole(e.target.value)}
              required
              className="w-full border border-[#D9E1E8] p-3 rounded-lg text-[#2F3E4E] bg-white focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            >
              <option value="" disabled>I am a… (select one)</option>
              <option value="Nurse">Medical Provider</option>
              <option value="Patient">Patient or Guardian</option>
              <option value="Billing Service">Billing Service</option>
              <option value="Other">Other</option>
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                className="w-full border border-[#D9E1E8] p-3 rounded-lg text-[#2F3E4E] placeholder-[#7A8F79] bg-white focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
              <input
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                required
                className="w-full border border-[#D9E1E8] p-3 rounded-lg text-[#2F3E4E] placeholder-[#7A8F79] bg-white focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
            </div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-[#D9E1E8] p-3 rounded-lg text-[#2F3E4E] placeholder-[#7A8F79] bg-white focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            />
            <input
              type="tel"
              placeholder="Phone number"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              className="w-full border border-[#D9E1E8] p-3 rounded-lg text-[#2F3E4E] placeholder-[#7A8F79] bg-white focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            />
            <input
              type="password"
              placeholder="Password (8+ characters)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border border-[#D9E1E8] p-3 rounded-lg text-[#2F3E4E] placeholder-[#7A8F79] bg-white focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className="w-full border border-[#D9E1E8] p-3 rounded-lg text-[#2F3E4E] placeholder-[#7A8F79] bg-white focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2F3E4E] text-white p-3 rounded-lg hover:bg-[#7A8F79] transition font-semibold disabled:opacity-50"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          {error && (
            <p className="mt-4 text-sm text-red-600 text-center">{error}</p>
          )}

          {success && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-center space-y-1">
              <p className="text-sm font-bold text-green-700">Account created successfully!</p>
              <p className="text-xs text-green-600">Loading your portalin {countdown} second{countdown !== 1 ? 's' : ''}…</p>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-[#7A8F79]">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-[#2F3E4E] underline underline-offset-2 hover:text-[#7A8F79] transition">
              Sign in →
            </Link>
          </p>
          
        </div>
      </div>

    </div>
  )
}
