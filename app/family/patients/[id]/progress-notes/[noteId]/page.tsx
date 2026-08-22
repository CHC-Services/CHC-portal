'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import ProgressNoteView from '../../../../../components/patient/ProgressNoteView'
import { ProgressNoteDTO } from '../../../../../components/patient/ProgressNoteForm'

export default function FamilyProgressNotePage({ params }: { params: Promise<{ id: string; noteId: string }> }) {
  const { id, noteId } = use(params)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [note, setNote] = useState<ProgressNoteDTO | null>(null)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/family/progress-notes/${noteId}`, { credentials: 'include' })
      .then(async r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return }
        const body = await r.json()
        setNote(body.note)
        setSignatureUrl(body.signatureUrl)
        setLoading(false)
      })
  }, [noteId])

  if (loading) {
    return <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0"><p className="text-sm text-[#7A8F79]">Loading…</p></div>
  }

  if (notFound || !note) {
    return (
      <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-md mx-auto">
          <p className="text-[#2F3E4E] font-semibold">Progress note not found</p>
          <Link href={`/family/patients/${id}`} className="inline-block mt-4 text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E]">← Back to patient</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
      <div className="max-w-6xl">
        <Link href={`/family/patients/${id}`} className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
          ← Back to patient
        </Link>
        <h1 className="text-2xl font-bold text-[#2F3E4E] mt-2 mb-5">Progress Note</h1>

        <ProgressNoteView note={note} basePath="/api/family" signatureUrl={signatureUrl} />
      </div>
    </div>
  )
}
