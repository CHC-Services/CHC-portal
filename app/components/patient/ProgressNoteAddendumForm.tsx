'use client'

import { useEffect, useState } from 'react'
import { ProgressNoteAddendumDTO } from './ProgressNoteForm'

// Compose-and-sign a late addendum to an already-signed note — one atomic
// action (no separate draft state, unlike the main note). Shows the
// caller's own stored signature as a preview before confirming, same shape
// as ProgressNoteForm's sign flow.
export default function ProgressNoteAddendumForm({
  basePath, noteId, profileHref, onAdded,
}: {
  basePath: string // '/api/nurse' or '/api/admin'
  noteId: string
  profileHref: string
  onAdded: (addendum: ProgressNoteAddendumDTO) => void
}) {
  const [text, setText] = useState('')
  const [signatureUrl, setSignatureUrl] = useState<string | null | undefined>(undefined)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${basePath}/signature`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setSignatureUrl(d.signatureUrl ?? null))
      .catch(() => setSignatureUrl(null))
  }, [basePath])

  async function submit() {
    setSubmitting(true); setError('')
    const res = await fetch(`${basePath}/progress-notes/${noteId}/addendum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text }),
    })
    setSubmitting(false)
    if (res.ok) {
      const body = await res.json()
      setText(''); setConfirming(false)
      onAdded(body.addendum)
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Failed to add addendum.')
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
      <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Add Addendum</p>
      <p className="text-xs text-[#7A8F79]">Appends a separately-signed note — the original content above is never changed.</p>

      <textarea
        rows={4}
        className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] resize-none focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
        value={text}
        onChange={e => setText(e.target.value)}
      />

      {signatureUrl === undefined ? (
        <p className="text-xs text-[#7A8F79]">Checking for a stored signature…</p>
      ) : signatureUrl === null ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          You don&apos;t have a stored signature yet. <a href={profileHref} className="font-semibold underline">Add one on your profile page</a> before adding an addendum.
        </p>
      ) : !confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!text.trim()}
          className="bg-[#2F3E4E] text-white px-6 py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
        >
          Sign &amp; Add Addendum
        </button>
      ) : (
        <div className="space-y-3">
          <div className="border border-[#D9E1E8] rounded-lg bg-[#F4F6F5] p-4 flex items-center justify-center max-w-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={signatureUrl} alt="Your signature" className="max-h-24" />
          </div>
          {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex items-center gap-3">
            <button type="button" onClick={submit} disabled={submitting} className="bg-[#2F3E4E] text-white px-6 py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
              {submitting ? 'Signing…' : 'Confirm & Sign'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="border border-[#D9E1E8] text-[#7A8F79] px-6 py-2 rounded-xl text-sm font-semibold hover:bg-white transition">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
