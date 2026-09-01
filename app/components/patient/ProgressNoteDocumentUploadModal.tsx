'use client'

import { useState } from 'react'

// Upload a progress-note document (e.g. a scanned paper note) for a
// specific patient/day — nurse/provider only. Signs the note immediately on
// upload (see lib/progressNoteDocument.ts); no draft/sign step. Used from
// both the per-patient calendar's Day view and the nurse's own myCalendar
// Day view (app/patient/[id]/calendar/page.tsx, app/nurse/calendar/page.tsx).
export default function ProgressNoteDocumentUploadModal({
  patientId, serviceDate, onClose, onUploaded,
}: {
  patientId: string
  serviceDate: Date
  onClose: () => void
  onUploaded: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const presignRes = await fetch(`/api/nurse/patients/${patientId}/progress-note-documents/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/octet-stream' }),
      })
      const presignData = await presignRes.json()
      if (!presignRes.ok) {
        setError(presignData.error || 'Could not get upload URL.')
        setUploading(false)
        return
      }

      const formData = new FormData()
      Object.entries(presignData.fields as Record<string, string>).forEach(([k, v]) => formData.append(k, v))
      formData.append('file', file)
      await fetch(presignData.url, { method: 'POST', body: formData, mode: 'no-cors' })

      const confirmRes = await fetch(`/api/nurse/patients/${patientId}/progress-note-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          storageKey: presignData.storageKey,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || null,
          serviceDate: serviceDate.toISOString(),
          shiftNotes: notes.trim() || null,
        }),
      })
      const confirmData = await confirmRes.json()
      if (!confirmRes.ok) {
        setError(confirmData.error || 'File uploaded but the note could not be saved.')
        setUploading(false)
        return
      }
      onUploaded()
    } catch {
      setError('Upload failed. Please try again.')
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <p className="text-lg font-bold text-[#2F3E4E] mb-1">Upload Progress Note</p>
        <p className="text-xs text-[#7A8F79] mb-4">
          {serviceDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>

        <form onSubmit={handleUpload} className="space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Document</label>
            <input
              type="file"
              accept="application/pdf,image/*"
              required
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-[#2F3E4E]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] px-4 py-2 transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#7A8F79] transition disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
