'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { todayLocalDateString } from '../../../lib/localDate'

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

type PickerPatient = {
  patientId: string
  name: string
  accountNumber: string
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
  const router = useRouter()
  const [notes, setNotes] = useState<MyNote[]>([])
  const [loading, setLoading] = useState(true)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [patients, setPatients] = useState<PickerPatient[]>([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  const [pickerError, setPickerError] = useState('')

  useEffect(() => {
    fetch('/api/nurse/my-notes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setNotes(d.notes || []); setLoading(false) })
  }, [])

  function openPicker() {
    setPickerOpen(true)
    setPickerError('')
    setPatientsLoading(true)
    fetch('/api/nurse/patients', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const list: PickerPatient[] = (d.patients || []).map((p: {
          patientId: string
          merged?: { firstName?: string; lastName?: string; accountNumber?: string }
        }) => ({
          patientId: p.patientId,
          name: `${p.merged?.firstName || ''} ${p.merged?.lastName || ''}`.trim(),
          accountNumber: p.merged?.accountNumber || '—',
        }))
        setPatients(list)
        setPatientsLoading(false)
      })
      .catch(() => { setPickerError('Failed to load your patients.'); setPatientsLoading(false) })
  }

  async function createNoteFor(patientId: string) {
    setCreatingFor(patientId)
    setPickerError('')
    const res = await fetch('/api/nurse/progress-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ patientId, serviceDate: todayLocalDateString() }),
    })
    if (res.ok) {
      const { note } = await res.json()
      router.push(`/nurse/patients/${patientId}/progress-notes/${note.id}`)
    } else {
      setCreatingFor(null)
      setPickerError('Failed to start a new note. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-[#2F3E4E] mb-1">
          <span className="text-[#7A8F79] italic">my</span>Notes
        </h1>
        <p className="text-sm text-[#7A8F79] mb-5">Every Progress Note you&apos;ve authored, including patients you&apos;re no longer actively assigned to.</p>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Progress Notes</p>
            <button
              type="button"
              onClick={openPicker}
              className="bg-[#2F3E4E] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#7A8F79] transition shadow-sm"
            >
              + New Note
            </button>
          </div>

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

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#D9E1E8]">
              <h2 className="text-lg font-bold text-[#2F3E4E]">Select a Patient</h2>
              <button onClick={() => setPickerOpen(false)} className="text-[#7A8F79] hover:text-[#2F3E4E] transition text-xl leading-none">✕</button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-[#7A8F79]">Choose which patient this new progress note is for.</p>
              {pickerError && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{pickerError}</p>}

              {patientsLoading ? (
                <p className="text-sm text-[#7A8F79]">Loading your patients…</p>
              ) : patients.length === 0 ? (
                <p className="text-sm text-[#7A8F79] italic">You have no actively assigned patients.</p>
              ) : (
                <div className="space-y-1.5">
                  {patients.map(p => (
                    <button
                      key={p.patientId}
                      type="button"
                      disabled={creatingFor !== null}
                      onClick={() => createNoteFor(p.patientId)}
                      className="w-full flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2 hover:bg-[#D9E1E8] transition text-left disabled:opacity-50"
                    >
                      <div>
                        <p className="text-sm text-[#2F3E4E] font-semibold">{p.name}</p>
                        <p className="text-xs text-[#7A8F79]">{p.accountNumber}</p>
                      </div>
                      {creatingFor === p.patientId && <span className="text-xs text-[#7A8F79]">Starting…</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
