'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ProgressNoteForm, { ProgressNoteDTO } from '../../../../../components/patient/ProgressNoteForm'
import ProgressNoteView from '../../../../../components/patient/ProgressNoteView'
import ProgressNoteAddendumForm from '../../../../../components/patient/ProgressNoteAddendumForm'

export default function AdminProgressNotePage({ params }: { params: Promise<{ id: string; noteId: string }> }) {
  const { id, noteId } = use(params)
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [note, setNote] = useState<ProgressNoteDTO | null>(null)
  const [isAuthor, setIsAuthor] = useState(false)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [voiding, setVoiding] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [showVoidForm, setShowVoidForm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function load() {
    setLoading(true)
    fetch(`/api/admin/progress-notes/${noteId}`, { credentials: 'include' })
      .then(async r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return }
        const body = await r.json()
        setNote(body.note)
        setIsAuthor(body.isAuthor)
        setSignatureUrl(body.signatureUrl)
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [noteId])

  async function handleVoid() {
    setVoiding(true)
    const res = await fetch(`/api/admin/progress-notes/${noteId}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason: voidReason || null }),
    })
    setVoiding(false)
    if (res.ok) { setShowVoidForm(false); load() }
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/admin/progress-notes/${noteId}`, { method: 'DELETE', credentials: 'include' })
    setDeleting(false)
    if (res.ok) router.push(`/admin/patients/${id}`)
  }

  if (loading) {
    return <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6"><p className="text-sm text-[#7A8F79]">Loading…</p></div>
  }

  if (notFound || !note) {
    return (
      <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-md mx-auto">
          <p className="text-[#2F3E4E] font-semibold">Progress note not found</p>
          <Link href={`/admin/patients/${id}`} className="inline-block mt-4 text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E]">← Back to patient</Link>
        </div>
      </div>
    )
  }

  const isEditableDraft = isAuthor && !note.signedAt

  const voidAction = note.signedAt && !note.voidedAt ? (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
      {!showVoidForm ? (
        <button onClick={() => setShowVoidForm(true)} className="text-xs font-semibold text-red-600 border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition">
          Void This Note
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Reason (optional)</label>
            <input className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" value={voidReason} onChange={e => setVoidReason(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleVoid} disabled={voiding} className="bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50">
              {voiding ? 'Voiding…' : 'Confirm Void'}
            </button>
            <button onClick={() => setShowVoidForm(false)} className="text-sm text-[#7A8F79] hover:text-[#2F3E4E] transition">Cancel</button>
          </div>
        </div>
      )}
    </div>
  ) : null

  // Hard delete — always available to admin regardless of signed/voided
  // status (unlike Void, this actually removes the record). Meant as a
  // testing-environment escape hatch for erroneous notes; keep this
  // deliberately separate from Void, which is the real production path.
  const deleteAction = (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
      {!confirmingDelete ? (
        <button onClick={() => setConfirmingDelete(true)} className="text-xs font-semibold text-red-600 border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition">
          Delete This Note
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#2F3E4E]">This permanently deletes the note, its signature(s), PDF, and revision history. This cannot be undone — use Void instead for a real record. Continue?</p>
          <div className="flex items-center gap-3">
            <button onClick={handleDelete} disabled={deleting} className="bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50">
              {deleting ? 'Deleting…' : 'Confirm Delete'}
            </button>
            <button onClick={() => setConfirmingDelete(false)} className="text-sm text-[#7A8F79] hover:text-[#2F3E4E] transition">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <Link href={`/admin/patients/${id}`} className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
          ← Back to patient
        </Link>
        <h1 className="text-2xl font-bold text-[#2F3E4E] mt-2 mb-5">Progress Note</h1>

        {isEditableDraft ? (
          <ProgressNoteForm
            note={note}
            basePath="/api/admin"
            profileHref="/admin/profile"
            onSaved={updated => setNote(updated)}
            onSigned={updated => { setNote(updated); load() }}
            onDeleted={() => router.push(`/admin/patients/${id}`)}
          />
        ) : (
          <ProgressNoteView
            note={note}
            basePath="/api/admin"
            signatureUrl={signatureUrl}
            voidAction={voidAction}
            deleteAction={deleteAction}
            addendumAction={note.signedAt && !note.voidedAt ? (
              <ProgressNoteAddendumForm
                basePath="/api/admin"
                noteId={note.id}
                profileHref="/admin/profile"
                onAdded={() => load()}
              />
            ) : undefined}
          />
        )}
      </div>
    </div>
  )
}
