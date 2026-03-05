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

      // Login successful — cookie should have been set by server
      // For reliability we'll do a full redirect so the browser sends the cookie on
      // the next request (and avoids any caching issues).
      console.log('login response cookies:', document.cookie)
      window.location.href = '/'

    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#D9E1E8]">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        
        <h1 className="text-2xl font-bold mb-6 text-[#2F3E4E]">
          CHC Portal Login
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E] placeholder-[#7A8F79] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E] placeholder-[#7A8F79] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2F3E4E] text-white p-2 rounded hover:bg-[#7A8F79] transition disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

        </form>

        {error && (
          <p className="mt-4 text-sm text-red-600 text-center">
            {error}
          </p>
        )}

        <p className="mt-4 text-center text-sm text-[#7A8F79]">
          <Link href="/forgot-password" className="underline underline-offset-2 hover:text-[#2F3E4E]">
            Forgot password?
          </Link>
        </p>

      </div>
    </div>
  )
}