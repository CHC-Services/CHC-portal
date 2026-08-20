'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type MyNote = {
  id: string
  serviceDate: string
  signedAt: string | null
  voidedAt: string | null
  patientId: string
  patientName: string
  patientAccountNumber: string
  activeCase: boolean
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusBadge(note: MyNote) {
  if (note.voidedAt) return <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Voided</span>
  if (note.signedAt) return <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Signed</span>
  return <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Draft</span>
}

// Every note this nurse has ever authored, across every patient — reachable
// even after she's no longer linked to a case, since the notes themselves
// still exist and she may need them for her own billing/record purposes.
// Does not grant browsing access to a patient's other notes or full chart —
// see app/api/nurse/my-notes/route.ts.
export default function MyNotesPage() {
  const [notes, setNotes] = useState<MyNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/nurse/my-notes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setNotes(d.notes || []); setLoading(false) })
  }, [])

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-[#2F3E4E] mb-1">
          <span className="text-[#7A8F79] italic">my</span>Notes
        </h1>
        <p className="text-sm text-[#7A8F79] mb-5">Every Progress Note you&apos;ve authored, including patients you&apos;re no longer actively assigned to.</p>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          {loading ? (
            <p className="text-sm text-[#7A8F79]">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-[#7A8F79] italic">You haven&apos;t authored any progress notes yet.</p>
          ) : (
            <div className="space-y-1.5">
              {notes.map(n => (
                <Link
                  key={n.id}
                  href={`/nurse/patients/${n.patientId}/progress-notes/${n.id}?from=archive`}
                  className="flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2 hover:bg-[#D9E1E8] transition"
                >
                  <div>
                    <p className="text-sm text-[#2F3E4E] font-semibold">{n.patientName}</p>
                    <p className="text-xs text-[#7A8F79]">
                      {fmtDate(n.serviceDate)} · {n.patientAccountNumber}
                      {!n.activeCase && ' · No longer an active case'}
                    </p>
                  </div>
                  {statusBadge(n)}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
