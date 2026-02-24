'use client'

import { useState } from 'react'

export default function AdminDashboard() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState('')

  async function createNurse(e: React.FormEvent) {
    e.preventDefault()

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        role: 'nurse',
        displayName
      })
    })

    const data = await res.json()

    if (res.ok) {
      setMessage('Nurse account created successfully.')
      setEmail('')
      setPassword('')
      setDisplayName('')
    } else {
      setMessage(data.error || 'Error creating nurse.')
    }
  }

  return (
  <div className="min-h-screen bg-[#D9E1E8] p-8">
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold text-[#2F3E4E]">
        Admin Dashboard
      </h1>

      <button
        onClick={async () => {
          await fetch('/api/auth/logout', { method: 'POST' })
          window.location.href = '/login'
        }}
        className="bg-[#7A8F79] text-white px-4 py-2 rounded hover:bg-[#2F3E4E] transition"
      >
        Logout
      </button>
    </div>

    <div className="bg-white p-6 rounded shadow max-w-md">
      <h2 className="text-xl font-semibold mb-4 text-[#2F3E4E]">
        Create Nurse Account
      </h2>

      <form onSubmit={createNurse} className="space-y-3">
        <input
          type="text"
          placeholder="Nurse Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E] placeholder-[#7A8F79] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
        />

        <input
          type="email"
          placeholder="Nurse Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E] placeholder-[#7A8F79] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
        />

        <input
          type="password"
          placeholder="Temporary Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E] placeholder-[#7A8F79] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
        />

        <button
          type="submit"
          className="w-full bg-[#2F3E4E] text-white p-2 rounded hover:bg-[#7A8F79] transition"
        >
          Create Nurse
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
