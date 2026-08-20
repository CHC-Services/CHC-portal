'use client'

import { useEffect, useState, use, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import ProgressNoteForm, { ProgressNoteDTO } from '../../../../../components/patient/ProgressNoteForm'
import ProgressNoteView from '../../../../../components/patient/ProgressNoteView'
import ProgressNoteAddendumForm from '../../../../../components/patient/ProgressNoteAddendumForm'

function NurseProgressNoteInner({ id, noteId }: { id: string; noteId: string }) {
  const router = useRouter()
  // Arriving from /nurse/my-notes means this patient's case may no longer be
  // linked to this nurse — "back to patient" would 404 for her in that case,
  // so the back link (and the post-delete redirect) point at the archive
  // instead whenever that's where she came from.
  const fromArchive = useSearchParams().get('from') === 'archive'
  const backHref = fromArchive ? '/nurse/my-notes' : `/nurse/patients/${id}`
  const backLabel = fromArchive ? '← My Notes' : '← Back to patient'

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [note, setNote] = useState<ProgressNoteDTO | null>(null)
  const [isAuthor, setIsAuthor] = useState(false)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)

  function load() {
    setLoading(true)
    fetch(`/api/nurse/progress-notes/${noteId}`, { credentials: 'include' })
      .then(async r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return }
        const body = await r.json()
        setNote(body.note)
        setIsAuthor(body.isAuthor)
        setSignatureUrl(body.signatureUrl)
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [noteId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0"><p className="text-sm text-[#7A8F79]">Loading…</p></div>
  }

  if (notFound || !note) {
    return (
      <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-md mx-auto">
          <p className="text-[#2F3E4E] font-semibold">Progress note not found</p>
          <Link href={backHref} className="inline-block mt-4 text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E]">{backLabel}</Link>
        </div>
      </div>
    )
  }

  const isEditableDraft = isAuthor && !note.signedAt

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
      <div className="max-w-5xl mx-auto">
        <Link href={backHref} className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
          {backLabel}
        </Link>
        <h1 className="text-2xl font-bold text-[#2F3E4E] mt-2 mb-5">Progress Note</h1>

        {isEditableDraft ? (
          <ProgressNoteForm
            note={note}
            basePath="/api/nurse"
            profileHref="/nurse/profile"
            onSaved={updated => setNote(updated)}
            onSigned={updated => { setNote(updated); load() }}
            onDeleted={() => router.push(backHref)}
          />
        ) : (
          <ProgressNoteView
            note={note}
            basePath="/api/nurse"
            signatureUrl={signatureUrl}
            addendumAction={isAuthor && note.signedAt && !note.voidedAt ? (
              <ProgressNoteAddendumForm
                basePath="/api/nurse"
                noteId={note.id}
                profileHref="/nurse/profile"
                onAdded={() => load()}
              />
            ) : undefined}
          />
        )}
      </div>
    </div>
  )
}

export default function NurseProgressNotePage({ params }: { params: Promise<{ id: string; noteId: string }> }) {
  const { id, noteId } = use(params)
  return (
    <Suspense>
      <NurseProgressNoteInner id={id} noteId={noteId} />
    </Suspense>
  )
}
