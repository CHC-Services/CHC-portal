'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Nurse = {
  id: string
  displayName: string
  receiveNotifications: boolean
  user: { email: string }
}

export default function AdminEmailPage() {
  const router = useRouter()
  const [nurses, setNurses] = useState<Nurse[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [selectAll, setSelectAll] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/nurses', { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return }
        return r.json()
      })
      .then(data => {
        if (Array.isArray(data)) setNurses(data)
      })
  }, [router])

  function toggleNurse(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSelectAll(false)
  }

  function toggleAll() {
    if (selectAll) {
      setSelectAll(false)
      setSelected(new Set())
    } else {
      setSelectAll(true)
      setSelected(new Set())
    }
  }

  const recipientCount = selectAll ? nurses.length : selected.size

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)
    if (!subject.trim() || !body.trim()) { setError('Subject and body are required.'); return }
    if (recipientCount === 0) { setError('Select at least one recipient.'); return }

    setSending(true)
    const recipientIds = selectAll ? ['all'] : Array.from(selected)
    const res = await fetch('/api/admin/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ subject, body, recipientIds }),
    })
    setSending(false)

    if (res.ok) {
      const data = await res.json()
      setResult(data)
      setSubject('')
      setBody('')
      setSelected(new Set())
      setSelectAll(false)
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to send.')
    }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">ad</span>Email
          </h1>
          <p className="text-sm text-[#7A8F79] mt-1">Compose and send a message to one or more providers.</p>
        </div>

        <form onSubmit={send} className="space-y-5">

          {/* Recipients */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-3 border-b border-[#D9E1E8] mb-4">
              Recipients
            </h2>

            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={toggleAll}
                className="w-4 h-4 rounded accent-[#2F3E4E]"
              />
              <span className="text-sm font-semibold text-[#2F3E4E]">All Providers ({nurses.length})</span>
            </label>

            <div className="divide-y divide-[#D9E1E8] border border-[#D9E1E8] rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              {nurses.map(nurse => (
                <label
                  key={nurse.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${
                    (selectAll || selected.has(nurse.id)) ? 'bg-[#f4f6f5]' : 'hover:bg-[#fafbfa]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectAll || selected.has(nurse.id)}
                    onChange={() => !selectAll && toggleNurse(nurse.id)}
                    disabled={selectAll}
                    className="w-4 h-4 rounded accent-[#2F3E4E]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#2F3E4E]">{nurse.displayName}</p>
                    <p className="text-xs text-[#7A8F79] truncate">{nurse.user.email}</p>
                  </div>
                  {!nurse.receiveNotifications && (
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                      Reminders off
                    </span>
                  )}
                </label>
              ))}
            </div>

            {recipientCount > 0 && (
              <p className="mt-3 text-xs text-[#7A8F79]">
                {recipientCount} recipient{recipientCount !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Compose */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-3 border-b border-[#D9E1E8]">
              Message
            </h2>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Important Update from Coming Home Care"
                className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Body</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={8}
                placeholder="Write your message here…"
                className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-y"
              />
              <p className="mt-1 text-xs text-[#7A8F79]">Line breaks are preserved. The recipient&apos;s name will be added as a greeting automatically.</p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-700">
                Sent to {result.sent} of {result.total} recipients.
                {result.failed > 0 && <span className="text-red-500 ml-1">{result.failed} failed.</span>}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={sending || recipientCount === 0}
            className="w-full bg-[#2F3E4E] text-white font-semibold py-3 rounded-xl hover:bg-[#7A8F79] transition disabled:opacity-50"
          >
            {sending ? `Sending to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}…` : `Send Email to ${recipientCount} Recipient${recipientCount !== 1 ? 's' : ''}`}
          </button>

        </form>
      </div>
    </div>
  )
}
