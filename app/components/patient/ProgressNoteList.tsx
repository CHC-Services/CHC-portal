'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export type ProgressNoteSummary = {
  id: string
  serviceDate: string
  signedAt: string | null
  voidedAt: string | null
  authorDisplayName: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusBadge(note: ProgressNoteSummary) {
  if (note.voidedAt) return <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Voided</span>
  if (note.signedAt) return <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Signed</span>
  return <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Draft</span>
}

// Tab content for all three roles. basePath is the notes-list API
// ('/api/nurse', '/api/admin', '/api/family'); linkBase is the page route
// prefix each note row (and "+ New Note") links out to.
export default function ProgressNoteList({
  patientId, basePath, linkBase, canCreate,
}: {
  patientId: string
  basePath: string
  linkBase: string
  canCreate: boolean
}) {
  const [notes, setNotes] = useState<ProgressNoteSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${basePath}/progress-notes?patientId=${patientId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setNotes(d.notes || []); setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, basePath])

  if (loading) return <p className="text-sm text-[#7A8F79]">Loading progress notes…</p>

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Progress Notes</p>
        {canCreate && (
          <Link href={`${linkBase}/new`} className="bg-[#2F3E4E] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#7A8F79] transition shadow-sm">
            + New Note
          </Link>
        )}
      </div>

      {notes.length === 0 ? (
        <p className="text-xs text-[#7A8F79] italic">No progress notes yet.</p>
      ) : (
        <div className="space-y-1.5">
          {notes.map(n => (
            <Link key={n.id} href={`${linkBase}/${n.id}`} className="flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2 hover:bg-[#D9E1E8] transition">
              <div>
                <p className="text-sm text-[#2F3E4E] font-semibold">{fmtDate(n.serviceDate)}</p>
                <p className="text-xs text-[#7A8F79]">{n.authorDisplayName}</p>
              </div>
              {statusBadge(n)}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
