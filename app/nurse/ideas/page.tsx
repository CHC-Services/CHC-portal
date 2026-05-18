'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function NurseIdeasPage() {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/nurse/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ body }),
    })
    setSubmitting(false)
    if (res.ok) {
      setDone(true)
      setBody('')
    } else {
      setError('Something went wrong. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] pr-4 md:pr-6 lg:pr-6 py-4 md:py-6">
      <div className="max-w-lg mr-auto">

        <div className="mb-6">
          <Link href="/nurse" className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] transition">← Back to Dashboard</Link>
          <h1 className="text-3xl font-bold text-[#2F3E4E] mt-3">
            <span className="text-[#7A8F79] italic">my</span>Ideas
          </h1>
          <p className="text-sm text-[#7A8F79] mt-1">Have a suggestion or feature request? Send it directly to the team.</p>
        </div>

        {done ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-4">
            <div className="text-4xl">💡</div>
            <p className="font-bold text-[#2F3E4E] text-lg">Idea received!</p>
            <p className="text-sm text-[#7A8F79]">Thanks for the feedback — it goes straight to the team.</p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => setDone(false)}
                className="px-5 py-2 rounded-xl border border-[#D9E1E8] text-sm font-semibold text-[#7A8F79] hover:border-[#7A8F79] transition"
              >
                Submit another
              </button>
              <Link
                href="/nurse"
                className="px-5 py-2 rounded-xl bg-[#2F3E4E] text-white text-sm font-semibold hover:bg-[#7A8F79] transition"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-2">
                  Your idea or suggestion
                </label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e as unknown as React.FormEvent) }}
                  placeholder="Describe your idea, a feature you'd like, or anything that would make the portal better…"
                  rows={6}
                  required
                  className="w-full border border-[#D9E1E8] rounded-lg p-3 text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none"
                />
                <p className="text-[10px] text-[#7A8F79] mt-1">⌘↵ or Ctrl↵ to submit</p>
              </div>

              {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

              <button
                type="submit"
                disabled={submitting || !body.trim()}
                className="w-full bg-[#2F3E4E] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#7A8F79] transition disabled:opacity-40"
              >
                {submitting ? 'Sending…' : 'Submit Idea'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}
