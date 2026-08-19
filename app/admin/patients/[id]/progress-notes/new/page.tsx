'use client'

import { useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'

// Creates a fresh admin-authored draft note, then hands off to the [noteId] editor page.
export default function NewAdminProgressNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    fetch('/api/admin/progress-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ patientId: id }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.note?.id) router.replace(`/admin/patients/${id}/progress-notes/${d.note.id}`)
      })
  }, [id, router])

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">
      <p className="text-sm text-[#7A8F79] max-w-2xl mx-auto">Starting a new progress note…</p>
    </div>
  )
}
