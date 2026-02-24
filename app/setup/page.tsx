'use client'

import { useState } from 'react'

export default function SetupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        role: 'admin',
        displayName: 'Administrator'
      })
    })

    const data = await res.json()

    if (res.ok) {
      setMessage('Admin account created successfully!')
    } else {
      setMessage(data.error || 'Error creating account')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#D9E1E8]">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-[#2F3E4E]">
          Initial Admin Setup
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Admin Email"
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
            className="w-full bg-[#2F3E4E] text-white p-2 rounded hover:bg-[#7A8F79]"
          >
            Create Admin
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm text-center text-[#2F3E4E]">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
