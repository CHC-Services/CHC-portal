'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function ConsentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState('')

  async function handleConsent(useEmail: boolean) {
    setError('')
    setLoading(true)
    try {
      // Save consent acknowledgment
      const consentRes = await fetch('/api/auth/2fa/consent', {
        method: 'POST',
        credentials: 'include',
      })
      const consentData = await consentRes.json()
      if (!consentRes.ok) {
        setError(consentData.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      if (useEmail || !consentData.hasSms) {
        // Send code to email and go directly to verify
        const sendRes = await fetch('/api/auth/2fa/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ method: 'email' }),
        })
        const sendData = await sendRes.json()
        if (!sendRes.ok) {
          setError(sendData.error || 'Unable to send email code. Please try again.')
          setLoading(false)
          return
        }
        router.push('/login/verify?via=email')
      } else {
        // Has SMS — go to choose page
        router.push('/login/choose')
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] flex items-start justify-center pt-16 px-4">
      {/* Modal card */}
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">

        {/* Header */}
        <div className="bg-[#2F3E4E] px-8 py-6">
          <Image src="/chc_logo.png" alt="CHC Logo" width={140} height={48} className="h-auto mb-4 brightness-0 invert" />
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-1">Security Update</p>
          <h2 className="text-xl font-bold text-white leading-snug">Two-Step Verification</h2>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          <p className="text-sm text-[#4a5568] leading-relaxed mb-5">
            To enhance site security and protect user and patient data, we&apos;ve implemented
            two-step verification for all users.
          </p>
          <p className="text-sm text-[#4a5568] leading-relaxed mb-6">
            Each time you sign in, we&apos;ll send a one-time code to your phone or email to confirm it&apos;s you.
            Your account and the data you access are protected.
          </p>

          <label className="flex items-start gap-3 cursor-pointer mb-6 group">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#2F3E4E] cursor-pointer"
            />
            <span className="text-sm text-[#2F3E4E] leading-relaxed">
              I understand and agree to receive one-time security codes to verify my identity when signing in.
            </span>
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-center">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleConsent(false)}
              disabled={!checked || loading}
              className="w-full bg-[#2F3E4E] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#7A8F79] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Setting up…' : 'Confirm & Continue'}
            </button>
            <button
              onClick={() => handleConsent(true)}
              disabled={!checked || loading}
              className="w-full border border-[#D9E1E8] text-[#2F3E4E] py-3 rounded-xl font-semibold text-sm hover:border-[#7A8F79] hover:text-[#7A8F79] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send to my email address instead
            </button>
          </div>

          <p className="mt-5 text-center text-xs text-[#7A8F79]">
            Wrong account?{' '}
            <a href="/login" className="underline underline-offset-2 hover:text-[#2F3E4E] transition">
              Back to login
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
