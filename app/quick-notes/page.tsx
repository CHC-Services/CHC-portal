'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import QuickNoteForm, { QuickNoteDTO } from '../components/QuickNoteForm'
import { todayLocalDateString } from '../../lib/localDate'

type Patient = { id: string; label: string }
type Draft = { id: string; serviceDate: string; patientLabel: string }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function QuickNotesApp() {
  const token = useSearchParams().get('t')

  const [invalid, setInvalid] = useState(false)
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [activeNote, setActiveNote] = useState<QuickNoteDTO | null>(null)
  const [pickingPatient, setPickingPatient] = useState(false)
  const [creating, setCreating] = useState(false)
  const [justSigned, setJustSigned] = useState(false)

  function headers() {
    return { 'Content-Type': 'application/json', 'X-Quick-Access-Token': token || '' }
  }

  function load() {
    if (!token) { setInvalid(true); setLoading(false); return }
    setLoading(true)
    Promise.all([
      fetch('/api/quick-notes/patients', { headers: headers() }),
      fetch('/api/quick-notes/drafts', { headers: headers() }),
    ]).then(async ([pRes, dRes]) => {
      if (!pRes.ok || !dRes.ok) { setInvalid(true); setLoading(false); return }
      setPatients((await pRes.json()).patients || [])
      setDrafts((await dRes.json()).drafts || [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  async function openDraft(id: string) {
    const res = await fetch(`/api/quick-notes/notes/${id}`, { headers: headers() })
    if (res.ok) setActiveNote((await res.json()).note)
  }

  async function createNote(patientId: string) {
    setCreating(true)
    const res = await fetch('/api/quick-notes/notes', { method: 'POST', headers: headers(), body: JSON.stringify({ patientId, serviceDate: todayLocalDateString() }) })
    setCreating(false)
    if (res.ok) {
      const { note } = await res.json()
      setPickingPatient(false)
      openDraft(note.id)
    }
  }

  function backToList() {
    setActiveNote(null)
    load()
  }

  if (loading) {
    return <div className="min-h-screen bg-[#D9E1E8] flex items-center justify-center"><p className="text-sm text-[#7A8F79]">Loading…</p></div>
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-[#D9E1E8] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-sm">
          <p className="text-[#2F3E4E] font-semibold mb-1">This shortcut is no longer active</p>
          <p className="text-sm text-[#7A8F79] mb-4">Please delete this icon from your home screen. Log in below, then go to <strong>myNotes</strong> to reconnect a new one.</p>
          <Link href="/login" className="inline-block bg-[#2F3E4E] text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-[#7A8F79] transition">Go to Login</Link>
        </div>
      </div>
    )
  }

  if (justSigned) {
    return (
      <div className="min-h-screen bg-[#D9E1E8] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-sm">
          <p className="text-[#2F3E4E] font-semibold mb-1">✓ Note signed</p>
          <p className="text-sm text-[#7A8F79] mb-4">It&apos;s locked and saved. Log in normally any time to review or print it.</p>
          <button onClick={() => { setJustSigned(false); backToList() }} className="bg-[#2F3E4E] text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-[#7A8F79] transition">
            Back to My Notes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-bold text-[#2F3E4E] pt-2">myProgress Notes</h1>

        {activeNote ? (
          <>
            <button onClick={backToList} className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">← Back</button>
            <QuickNoteForm
              token={token!}
              note={activeNote}
              onSaved={setActiveNote}
              onSigned={() => { setActiveNote(null); setJustSigned(true) }}
              onDeleted={backToList}
            />
          </>
        ) : pickingPatient ? (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Select Patient</p>
              <button onClick={() => setPickingPatient(false)} className="text-xs text-[#7A8F79]">Cancel</button>
            </div>
            {patients.length === 0 ? (
              <p className="text-xs text-[#7A8F79] italic">No active patients linked to your account.</p>
            ) : (
              <div className="space-y-1.5">
                {patients.map(p => (
                  <button
                    key={p.id}
                    onClick={() => createNote(p.id)}
                    disabled={creating}
                    className="w-full text-left bg-[#F4F6F5] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] font-semibold hover:bg-[#D9E1E8] transition disabled:opacity-50"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <button
              onClick={() => setPickingPatient(true)}
              className="w-full bg-[#2F3E4E] text-white font-semibold py-3 rounded-xl hover:bg-[#7A8F79] transition"
            >
              + New Progress Note
            </button>

            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">My Drafts</p>
              {drafts.length === 0 ? (
                <p className="text-xs text-[#7A8F79] italic">No drafts in progress.</p>
              ) : (
                <div className="space-y-1.5">
                  {drafts.map(d => (
                    <button
                      key={d.id}
                      onClick={() => openDraft(d.id)}
                      className="w-full flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2 hover:bg-[#D9E1E8] transition text-left"
                    >
                      <span className="text-sm text-[#2F3E4E] font-semibold">{d.patientLabel}</span>
                      <span className="text-xs text-[#7A8F79]">{fmtDate(d.serviceDate)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function QuickNotesPage() {
  return (
    <Suspense>
      <QuickNotesApp />
    </Suspense>
  )
}
