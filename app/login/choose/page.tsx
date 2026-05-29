'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Methods = {
  hasSms: boolean
  phoneLast4: string | null
  emailMasked: string
}

export default function ChoosePage() {
  const router = useRouter()
  const [methods, setMethods] = useState<Methods | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/auth/2fa/methods', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          router.replace('/login')
        } else {
          setMethods(data)
        }
      })
      .catch(() => router.replace('/login'))
  }, [router])

  async function choose(method: 'sms' | 'email') {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ method }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      router.push(`/login/verify?via=${method}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] flex items-stretch">

      {/* Left branding panel */}
      <div className="hidden md:flex flex-col justify-start pt-24 bg-[#2F3E4E] text-white w-1/3 px-12 py-16 gap-6">
        <div className="border-t border-[#3d5166] pt-6">
          <p className="text-sm tracking-widest text-[#7A8F79] font-semibold">
            <span className="italic text-lg">my</span><span className="font-bold text-lg text-white">Provider</span>
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white leading-snug">Two-Step<br />Verification</p>
          <p className="text-sm text-[#D9E1E8] mt-3 leading-relaxed">
            We'll send a one-time 6-digit code to confirm it's you. Choose where you'd like to receive it.
          </p>
        </div>
        <div className="border-t border-[#3d5166] pt-4 text-xs text-[#7A8F79] leading-relaxed">
          The code expires in five minutes. If you don&apos;t receive it, try again or contact support.
        </div>
      </div>

      {/* Right — method selection */}
      <div className="flex flex-col justify-start pt-24 w-full md:w-2/3 px-8 md:px-16 py-16">
        <div className="max-w-sm w-full mx-auto">
          <div className="mb-6">
            <Image src="/chc_logo.png" alt="CHC Logo" width={180} height={60} className="h-auto" />
          </div>
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-1">Security Check</p>
          <h1 className="text-2xl font-bold text-[#2F3E4E] mb-1">Where should we send your code?</h1>
          <p className="text-sm text-[#7A8F79] mb-8">Choose a delivery method for your one-time login code.</p>

          {!methods ? (
            <p className="text-sm text-[#7A8F79]">Loading…</p>
          ) : (
            <div className="flex flex-col gap-3">
              {methods.hasSms && (
                <button
                  onClick={() => choose('sms')}
                  disabled={loading}
                  className="w-full flex items-center gap-4 bg-white border-2 border-[#D9E1E8] hover:border-[#7A8F79] rounded-xl px-5 py-4 text-left transition disabled:opacity-50"
                >
                  <span className="text-2xl">📱</span>
                  <div>
                    <p className="font-semibold text-[#2F3E4E] text-sm">Text message</p>
                    <p className="text-xs text-[#7A8F79]">Send to {methods.phoneLast4}</p>
                  </div>
                </button>
              )}
              <button
                onClick={() => choose('email')}
                disabled={loading}
                className="w-full flex items-center gap-4 bg-white border-2 border-[#D9E1E8] hover:border-[#7A8F79] rounded-xl px-5 py-4 text-left transition disabled:opacity-50"
              >
                <span className="text-2xl">✉️</span>
                <div>
                  <p className="font-semibold text-[#2F3E4E] text-sm">Email</p>
                  <p className="text-xs text-[#7A8F79]">Send to {methods.emailMasked}</p>
                </div>
              </button>
            </div>
          )}

          {loading && (
            <p className="text-sm text-[#7A8F79] text-center mt-4">Sending your code…</p>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mt-4 text-center">
              {error}
            </p>
          )}

          <p className="mt-8 text-center text-xs text-[#7A8F79]">
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
