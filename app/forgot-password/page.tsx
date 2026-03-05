'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#D9E1E8]">
      <div className="bg-white p-8 rounded-xl shadow-sm w-full max-w-md">

        {submitted ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-[#D9E1E8] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#7A8F79]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#2F3E4E] mb-2">Check your email</h2>
            <p className="text-sm text-[#7A8F79] mb-6">
              If an account exists for <strong className="text-[#2F3E4E]">{email}</strong>, you'll receive a reset link shortly. The link expires in 1 hour.
            </p>
            <Link href="/login" className="text-sm text-[#7A8F79] underline underline-offset-2 hover:text-[#2F3E4E]">
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-[#2F3E4E] mb-2">Forgot your password?</h1>
            <p className="text-sm text-[#7A8F79] mb-6">Enter your email and we'll send you a reset link.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2F3E4E] text-white py-2 rounded-lg hover:bg-[#7A8F79] transition font-semibold disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-[#7A8F79]">
              <Link href="/login" className="underline underline-offset-2 hover:text-[#2F3E4E]">
                Back to login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
