'use client'

import { useState } from 'react'

export default function NurseDashboard() {
  const [workDate, setWorkDate] = useState('')
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')

  async function submitTime(e: React.FormEvent) {
    e.preventDefault()

    const res = await fetch('/api/time-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workDate, hours, notes })
    })

    const data = await res.json()

    if (res.ok) {
      setMessage('Time submitted successfully.')
      setWorkDate('')
      setHours('')
      setNotes('')
    } else {
      setMessage(data.error || 'Error submitting time.')
    }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#5F735E]">
          Nurse Dashboard
        </h1>
      </div>

      <div className="bg-white p-6 rounded shadow max-w-md">
        <h2 className="text-xl font-semibold mb-4 text-[#2F3E4E]">
          Submit Hours
        </h2>

        <form onSubmit={submitTime} className="space-y-3">
          <input
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            required
            className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
          />

          <input
            type="number"
            step="1"
            min="1"
            placeholder="Hours Worked"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            required
            className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E] placeholder-[#7A8F79] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
          />

          <textarea
            placeholder="Optional Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-[#D9E1E8] p-2 rounded text-[#2F3E4E] placeholder-[#7A8F79] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
          />

          <button
            type="submit"
            className="w-full bg-[#2F3E4E] text-white p-2 rounded hover:bg-[#7A8F79] transition"
          >
            Submit
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm text-center text-[#2F3E4E]">
            {message}
          </p>
        )}
      </div>
      <div className="mt-6 border-t border-[#D9E1E8] pt-4">
  <h3 className="text-md font-semibold text-[#5F735E] mb-2">
    Submission Guidelines
  </h3>

  <ul className="text-sm text-[#2F3E4E] space-y-1">
    <li>• Select the exact date worked.</li>
    <li>• Submit whole hours only (no partial hours).</li>
    <li>• Use notes only if clarification is needed.</li>
  </ul>
</div>
    </div>
  )
}
