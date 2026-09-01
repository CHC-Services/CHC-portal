'use client'

import { useRef, useState } from 'react'

// Replace/Delete for a document-based progress note's attached file only
// (lib/progressNoteDocument.ts) — the one correction path available after a
// document-based note is signed immediately at upload. Rendered inline next
// to the document link in ProgressNoteView via its documentAction slot.
export default function ProgressNoteDocumentActions({
  basePath, patientId, noteId, onReplaced, onDeleted,
}: {
  basePath: string // '/api/nurse' or '/api/admin'
  patientId: string
  noteId: string
  onReplaced: () => void
  onDeleted: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function replaceWithFile(file: File) {
    setBusy(true)
    setError('')
    try {
      const presignRes = await fetch(`${basePath}/patients/${patientId}/progress-note-documents/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/octet-stream' }),
      })
      const presignData = await presignRes.json()
      if (!presignRes.ok) { setError(presignData.error || 'Could not get upload URL.'); return }

      const formData = new FormData()
      Object.entries(presignData.fields as Record<string, string>).forEach(([k, v]) => formData.append(k, v))
      formData.append('file', file)
      await fetch(presignData.url, { method: 'POST', body: formData, mode: 'no-cors' })

      const patchRes = await fetch(`${basePath}/progress-notes/${noteId}/document`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ storageKey: presignData.storageKey, fileName: file.name, fileSize: file.size, mimeType: file.type || null }),
      })
      const patchData = await patchRes.json()
      if (!patchRes.ok) { setError(patchData.error || 'Upload succeeded but the note could not be updated.'); return }
      onReplaced()
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this uploaded document? This removes the entire note and cannot be undone.')) return
    setBusy(true)
    setError('')
    const res = await fetch(`${basePath}/progress-notes/${noteId}/document`, { method: 'DELETE', credentials: 'include' })
    setBusy(false)
    if (res.ok) onDeleted()
    else setError('Could not delete this document.')
  }

  return (
    <div className="flex items-center gap-3">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) replaceWithFile(f); e.target.value = '' }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
        className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition disabled:opacity-40"
      >
        {busy ? 'Working…' : 'Replace'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={handleDelete}
        className="text-xs font-semibold text-red-500 hover:text-red-700 transition disabled:opacity-40"
      >
        Delete
      </button>
    </div>
  )
}
