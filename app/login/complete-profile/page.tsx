'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { fmtPhoneInput } from '../../../lib/formatPhone'

function CompleteProfileForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const needsConsent = searchParams.get('needsConsent') !== 'false'

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!firstName.trim() || !lastName.trim()) { setError('Please enter your first and last name.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      router.push(needsConsent ? '/login/consent' : '/login/choose')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] flex items-start justify-center pt-16 px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">

        <div className="bg-[#2F3E4E] px-8 py-6">
          <Image src="/chc_logo.png" alt="CHC Logo" width={140} height={48} className="h-auto mb-4 brightness-0 invert" />
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-1">Welcome</p>
          <h2 className="text-xl font-bold text-white leading-snug">Complete Your Profile</h2>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6">
          <p className="text-sm text-[#4a5568] leading-relaxed mb-5">
            Before we set up your login security, let&apos;s confirm a few details.
          </p>

          <div className="space-y-3 mb-6">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  className="w-full border border-[#D9E1E8] p-2.5 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                  className="w-full border border-[#D9E1E8] p-2.5 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="(555) 555-5555"
                value={phone}
                onChange={e => setPhone(fmtPhoneInput(e.target.value))}
                required
                className="w-full border border-[#D9E1E8] p-2.5 rounded-lg text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
              <p className="text-xs text-[#7A8F79] mt-1">Used for text-message login codes, in addition to email.</p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2F3E4E] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#7A8F79] transition disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>

          <p className="mt-5 text-center text-xs text-[#7A8F79]">
            Wrong account?{' '}
            <a href="/login" className="underline underline-offset-2 hover:text-[#2F3E4E] transition">
              Back to login
            </a>
          </p>
        </form>
      </div>
    </div>
  )
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={null}>
      <CompleteProfileForm />
    </Suspense>
  )
}
