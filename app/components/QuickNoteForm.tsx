'use client'

import { useEffect, useRef, useState } from 'react'
import { mergeRowsByTime, computeShiftHours } from '../../lib/parseClockTime'

function toDateInputValue(iso: string) {
  return iso ? iso.slice(0, 10) : ''
}

// Mirrors ProgressNoteForm.tsx's flowsheet fields, but wired to /api/quick-notes/*
// with a header token instead of cookie session auth — kept as its own
// component rather than a further stretch of ProgressNoteForm, since the two
// auth models are different enough that sharing would hurt more than help.

type VitalRow = {
  time: string | null; temp: string | null; hr: string | null; rr: string | null; skin: string | null
  o2Flow: string | null; o2Route: string | null; o2Percent: string | null; lungSounds: string | null
  txNeeded: string | null; suction: string | null
}
type IORow = {
  time: string | null; intakeType: string | null; intakeAmt: string | null; intakeRoute: string | null
  outputUrine: string | null; outputBM: string | null; outputEmesis: string | null
}

export type VoiceEntryDTO = { id: string; rawText: string; recordedAt: string }

export type QuickNoteDTO = {
  id: string
  patientLabel: string
  serviceDate: string
  shiftStartTime: string | null
  shiftEndTime: string | null
  totalHours: number | null
  location: string | null
  arrivalFindings: string | null
  shiftNotes: string | null
  signedAt: string | null
  vitals: VitalRow[]
  intakeOutput: IORow[]
  voiceEntries: VoiceEntryDTO[]
}

// Micro-Charting's per-recording state machine — 'recording' while the mic is
// live, 'transcribing' while Transcribe Medical's job is polled, 'ready' once
// she can glance-and-confirm the just-saved entry's text (or redo it),
// 'error' on failure. There's only ever one of these active at a time.
type PendingEntry =
  | { phase: 'recording' }
  | { phase: 'transcribing' }
  | { phase: 'ready'; entry: VoiceEntryDTO }
  | { phase: 'error'; message: string }

const LOCATIONS = ['Home', 'School', 'Daycare', 'Facility', 'Community', 'Other']
const O2_ROUTES = ['AirVo', 'HME', 'O2 Tank', 'Passy Muir', 'POC', 'Vent', 'Room Air']
const TX_NEEDED = ['Yes', 'No']
const INTAKE_ROUTES = ['Oral', 'G-Tube', 'J-Tube', 'GJ-Split', 'NG-Tube', 'IV']

const EMPTY_VITAL: VitalRow = { time: null, temp: null, hr: null, rr: null, skin: null, o2Flow: null, o2Route: null, o2Percent: null, lungSounds: null, txNeeded: null, suction: null }
const EMPTY_IO: IORow = { time: null, intakeType: null, intakeAmt: null, intakeRoute: null, outputUrine: null, outputBM: null, outputEmesis: null }

const inp = 'w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'
const lbl = 'block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1'
const cellInp = 'w-full min-w-[4.5rem] border border-[#D9E1E8] rounded px-1.5 py-1 text-xs text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79]'
const th = 'px-1.5 py-1 text-left whitespace-nowrap'

export default function QuickNoteForm({
  token, note, onSaved, onSigned, onDeleted,
}: {
  token: string
  note: QuickNoteDTO
  onSaved: (note: QuickNoteDTO) => void
  onSigned: () => void
  onDeleted: () => void
}) {
  const [serviceDate, setServiceDate] = useState(toDateInputValue(note.serviceDate))
  const [shiftStartTime, setShiftStartTime] = useState(note.shiftStartTime || '')
  const [shiftEndTime, setShiftEndTime] = useState(note.shiftEndTime || '')
  // Fully derived from Shift Start/End, not independent state — one less
  // thing for her to fill out (or get wrong) manually.
  const totalHours = computeShiftHours(shiftStartTime, shiftEndTime)
  const [location, setLocation] = useState(note.location || 'Home')
  const [arrivalFindings, setArrivalFindings] = useState(note.arrivalFindings || '')
  const [shiftNotes, setShiftNotes] = useState(note.shiftNotes || '')
  const [vitals, setVitals] = useState<VitalRow[]>(note.vitals.length ? note.vitals : [{ ...EMPTY_VITAL }])
  const [intakeOutput, setIntakeOutput] = useState<IORow[]>(note.intakeOutput.length ? note.intakeOutput : [{ ...EMPTY_IO }])

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [confirmingSign, setConfirmingSign] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Micro-Charting state
  const [voiceEntries, setVoiceEntries] = useState<VoiceEntryDTO[]>(note.voiceEntries)
  const [pending, setPending] = useState<PendingEntry | null>(null)
  const [compiling, setCompiling] = useState(false)
  const [compileError, setCompileError] = useState('')
  const [compilePreview, setCompilePreview] = useState<string | null>(null)
  const [showCompileConfirm, setShowCompileConfirm] = useState(false)
  const [extractedVitals, setExtractedVitals] = useState<VitalRow[]>([])
  const [extractedIO, setExtractedIO] = useState<IORow[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  function headers() {
    return { 'X-Quick-Access-Token': token }
  }
  function jsonHeaders() {
    return { 'Content-Type': 'application/json', 'X-Quick-Access-Token': token }
  }

  async function startRecording() {
    setPending({ phase: 'recording' })
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    chunksRef.current = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      uploadAndTranscribe(blob)
    }
    mediaRecorderRef.current = recorder
    recorder.start()
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
  }

  async function uploadAndTranscribe(blob: Blob) {
    setPending({ phase: 'transcribing' })
    try {
      const form = new FormData()
      form.append('audio', blob, 'entry.webm')
      const startRes = await fetch(`/api/quick-notes/notes/${note.id}/voice-entries/start`, {
        method: 'POST',
        headers: headers(),
        body: form,
      })
      if (!startRes.ok) throw new Error()
      const { jobId } = await startRes.json()
      await pollStatus(jobId)
    } catch {
      if (mountedRef.current) setPending({ phase: 'error', message: "Didn't catch that — try again." })
    }
  }

  async function pollStatus(jobId: string) {
    while (mountedRef.current) {
      await new Promise(r => setTimeout(r, 2000))
      const res = await fetch(`/api/quick-notes/notes/${note.id}/voice-entries/status/${jobId}`, { headers: headers() })
      if (!res.ok) { if (mountedRef.current) setPending({ phase: 'error', message: "Didn't catch that — try again." }); return }
      const body = await res.json()
      if (body.status === 'IN_PROGRESS') continue
      if (body.status === 'FAILED') { if (mountedRef.current) setPending({ phase: 'error', message: body.error || 'Transcription failed.' }); return }
      // COMPLETED
      setVoiceEntries(rows => [...rows, body.entry])
      if (mountedRef.current) setPending({ phase: 'ready', entry: body.entry })
      return
    }
  }

  function dismissPending() {
    setPending(null)
  }

  async function redoPending() {
    if (pending?.phase === 'ready') {
      await deleteEntry(pending.entry.id)
    }
    setPending(null)
    startRecording()
  }

  async function deleteEntry(entryId: string) {
    setVoiceEntries(rows => rows.filter(e => e.id !== entryId))
    await fetch(`/api/quick-notes/notes/${note.id}/voice-entries/${entryId}`, { method: 'DELETE', headers: headers() })
  }

  function handleCompileClick() {
    // Only worth a confirmation when there's existing Shift Notes content
    // that a Replace could actually overwrite — an empty note has nothing at
    // risk, so compile runs immediately (auto-fills with no extra click).
    if (shiftNotes.trim()) setShowCompileConfirm(true)
    else runCompile()
  }

  async function runCompile() {
    setShowCompileConfirm(false)
    setCompiling(true); setCompileError('')
    const res = await fetch(`/api/quick-notes/notes/${note.id}/compile`, { method: 'POST', headers: headers() })
    setCompiling(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setCompileError(body.error || 'Failed to compile.')
      return
    }
    const { narrative, vitals, intakeOutput } = await res.json()
    if (!shiftNotes.trim()) {
      setShiftNotes(narrative)
    } else {
      setCompilePreview(narrative)
    }

    // Extracted table rows always go through review, even into empty
    // tables — a wrong number in a structured field reads as an established
    // fact, not prose she's already reading critically, so this doesn't get
    // the same "auto-fill when empty" shortcut the narrative gets.
    if (vitals?.length) {
      setExtractedVitals(vitals.map((v: Record<string, string | undefined>) => ({
        time: v.time ?? null, temp: v.temp ?? null, hr: v.hr ?? null, rr: v.rr ?? null, skin: v.skin ?? null,
        o2Flow: v.o2Flow ?? null, o2Route: v.o2Route ?? null, o2Percent: v.o2Percent ?? null,
        lungSounds: v.lungSounds ?? null, txNeeded: v.txNeeded ?? null, suction: v.suction ?? null,
      })))
    }
    if (intakeOutput?.length) {
      setExtractedIO(intakeOutput.map((r: Record<string, string | undefined>) => ({
        time: r.time ?? null, intakeType: r.intakeType ?? null, intakeAmt: r.intakeAmt ?? null, intakeRoute: r.intakeRoute ?? null,
        outputUrine: r.outputUrine ?? null, outputBM: r.outputBM ?? null, outputEmesis: r.outputEmesis ?? null,
      })))
    }
  }

  function acceptExtractedRows() {
    if (extractedVitals.length) setVitals(rows => mergeRowsByTime(rows, extractedVitals))
    if (extractedIO.length) setIntakeOutput(rows => mergeRowsByTime(rows, extractedIO))
    setExtractedVitals([]); setExtractedIO([])
  }

  function discardExtractedRows() {
    setExtractedVitals([]); setExtractedIO([])
  }

  function acceptCompile(mode: 'replace' | 'append') {
    if (compilePreview == null) return
    setShiftNotes(prev => mode === 'replace' ? compilePreview : `${prev}\n\n${compilePreview}`)
    setCompilePreview(null)
  }

  function updateVital(i: number, field: keyof VitalRow, value: string) {
    setVitals(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value || null } : r))
  }
  function updateIO(i: number, field: keyof IORow, value: string) {
    setIntakeOutput(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value || null } : r))
  }

  async function saveDraft(): Promise<boolean> {
    setSaving(true); setError(''); setSaved(false)
    const res = await fetch(`/api/quick-notes/notes/${note.id}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({
        serviceDate: new Date(serviceDate).toISOString(),
        shiftStartTime: shiftStartTime || null,
        shiftEndTime: shiftEndTime || null,
        totalHours,
        location: location || null,
        arrivalFindings: arrivalFindings || null,
        shiftNotes: shiftNotes || null,
        vitals,
        intakeOutput,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const body = await res.json()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      onSaved(body.note)
      return true
    }
    const body = await res.json().catch(() => ({}))
    setError(body.error || 'Failed to save.')
    return false
  }

  async function signAndLock() {
    setSigning(true); setSignError('')
    const ok = await saveDraft()
    if (!ok) { setSigning(false); return }
    const res = await fetch(`/api/quick-notes/notes/${note.id}/sign`, { method: 'POST', headers: headers() })
    setSigning(false)
    if (res.ok) {
      onSigned()
    } else {
      const body = await res.json().catch(() => ({}))
      setSignError(body.error || 'Failed to sign.')
    }
  }

  async function deleteDraft() {
    setDeleting(true)
    const res = await fetch(`/api/quick-notes/notes/${note.id}`, { method: 'DELETE', headers: headers() })
    setDeleting(false)
    if (res.ok) onDeleted()
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">{note.patientLabel}</p>
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <label className={lbl}>Service Date</label>
            <input type="date" className={`${inp} w-[136px]`} value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Shift Start</label>
            <input className={`${inp} w-[104px]`} placeholder="08:00 AM" value={shiftStartTime} onChange={e => setShiftStartTime(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Shift End</label>
            <input className={`${inp} w-[104px]`} placeholder="08:00 PM" value={shiftEndTime} onChange={e => setShiftEndTime(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Ttl Hrs</label>
            <p className="text-sm font-bold text-[#2F3E4E] p-2 w-16">{totalHours ?? '—'}</p>
          </div>
          <div>
            <label className={lbl}>Location</label>
            <select className={`${inp} w-36`} value={location} onChange={e => setLocation(e.target.value)}>
              {/* Carries forward a pre-existing free-text location (from before this was a dropdown) as its own option, so opening an old note never silently swaps it for a different value on save. */}
              {(LOCATIONS.includes(location) ? LOCATIONS : [location, ...LOCATIONS]).map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Micro-Charting</p>

        {pending == null && (
          <button type="button" onClick={startRecording} className="bg-[#2F3E4E] text-white px-5 py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition">
            🎙 Record Entry
          </button>
        )}
        {pending?.phase === 'recording' && (
          <button type="button" onClick={stopRecording} className="bg-red-600 text-white px-5 py-2 rounded-xl font-semibold hover:bg-red-700 transition">
            ■ Stop Recording
          </button>
        )}
        {pending?.phase === 'transcribing' && (
          <p className="text-sm text-[#7A8F79] italic">Transcribing…</p>
        )}
        {pending?.phase === 'ready' && (
          <div className="border border-[#D9E1E8] bg-[#F4F6F5] rounded-lg p-3 space-y-2">
            <p className="text-sm text-[#2F3E4E]">{pending.entry.rawText}</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={dismissPending} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E]">✓ Looks good</button>
              <button type="button" onClick={redoPending} className="text-xs font-semibold text-red-600">🔁 Re-record</button>
            </div>
          </div>
        )}
        {pending?.phase === 'error' && (
          <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-2">
            <p className="text-sm text-red-600">{pending.message}</p>
            <button type="button" onClick={startRecording} className="text-xs font-semibold text-red-600">Try Again</button>
          </div>
        )}

        {voiceEntries.length > 0 && (
          <div className="space-y-1.5">
            {voiceEntries.map(e => (
              <div key={e.id} className="flex items-start justify-between gap-2 bg-[#F4F6F5] rounded-lg px-3 py-2">
                <div>
                  <p className="text-xs font-semibold text-[#7A8F79]">
                    {new Date(e.recordedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-sm text-[#2F3E4E]">{e.rawText}</p>
                </div>
                <button type="button" onClick={() => deleteEntry(e.id)} className="text-red-500 text-xs shrink-0">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-[#D9E1E8] space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79]">End of Shift</p>
            <button
              type="button"
              onClick={handleCompileClick}
              disabled={compiling || voiceEntries.length === 0}
              className="bg-[#2F3E4E] text-white px-5 py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
            >
              {compiling ? 'Compiling…' : 'Compile'}
            </button>
          </div>
          {compileError && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{compileError}</p>}
        </div>

        {compilePreview != null && (
          <div className="border border-[#D9E1E8] bg-[#F4F6F5] rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Compiled Result <span className="normal-case font-normal text-[#7A8F79]">— review and edit before accepting</span></p>
            <textarea rows={8} className={`${inp} resize-none bg-white`} value={compilePreview} onChange={e => setCompilePreview(e.target.value)} />
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => acceptCompile('replace')} className="text-xs font-semibold text-white bg-[#2F3E4E] px-3 py-1.5 rounded-lg hover:bg-[#7A8F79] transition">Replace Shift Notes</button>
              <button type="button" onClick={() => acceptCompile('append')} className="text-xs font-semibold text-[#2F3E4E] border border-[#D9E1E8] px-3 py-1.5 rounded-lg hover:border-[#7A8F79] transition">Append</button>
              <button type="button" onClick={() => setCompilePreview(null)} className="text-xs text-[#7A8F79]">Discard</button>
            </div>
          </div>
        )}

        {(extractedVitals.length > 0 || extractedIO.length > 0) && (
          <div className="border border-[#D9E1E8] bg-[#F4F6F5] rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Extracted Vitals &amp; Intake/Output — Review Before Adding</p>
            <div className="space-y-1">
              {extractedVitals.map((v, i) => (
                <p key={`v${i}`} className="text-sm text-[#2F3E4E]">
                  {v.time || '—'} — {[
                    v.temp && `Temp ${v.temp}`, v.hr && `HR ${v.hr}`, v.rr && `RR ${v.rr}`, v.skin && `Skin ${v.skin}`,
                    v.o2Flow && `O2 Flow ${v.o2Flow}`, v.o2Route && `O2 Route ${v.o2Route}`, v.o2Percent && `O2 % ${v.o2Percent}`,
                    v.lungSounds && `Lung Sounds ${v.lungSounds}`, v.txNeeded && `Tx Needed ${v.txNeeded}`, v.suction && `Suction ${v.suction}`,
                  ].filter(Boolean).join(', ')}
                </p>
              ))}
              {extractedIO.map((r, i) => (
                <p key={`io${i}`} className="text-sm text-[#2F3E4E]">
                  {r.time || '—'} — {[
                    r.intakeType && `Intake ${r.intakeType} ${r.intakeAmt || ''}`.trim(), r.intakeRoute && `via ${r.intakeRoute}`,
                    r.outputUrine && `Urine ${r.outputUrine}`, r.outputBM && `BM ${r.outputBM}`, r.outputEmesis && `Emesis ${r.outputEmesis}`,
                  ].filter(Boolean).join(', ')}
                </p>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={acceptExtractedRows} className="text-xs font-semibold text-white bg-[#2F3E4E] px-3 py-1.5 rounded-lg hover:bg-[#7A8F79] transition">Add to Tables</button>
              <button type="button" onClick={discardExtractedRows} className="text-xs text-[#7A8F79]">Discard</button>
            </div>
          </div>
        )}
      </div>

      {showCompileConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowCompileConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-[#2F3E4E] mb-2">Compile will regenerate your note</p>
            <p className="text-xs text-[#7A8F79] leading-relaxed mb-3">
              Shift Notes already has content. Compiling creates a fresh version from every entry you&apos;ve recorded so far — after it runs, you&apos;ll choose what to do with it:
            </p>
            <ul className="text-xs text-[#7A8F79] leading-relaxed mb-4 space-y-1.5 list-disc pl-4">
              <li><strong className="text-[#2F3E4E]">Replace Shift Notes</strong> — overwrites what&apos;s currently there with the new compiled text.</li>
              <li><strong className="text-[#2F3E4E]">Append</strong> — adds the new text after what&apos;s already there, keeping your existing content.</li>
            </ul>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowCompileConfirm(false)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:border-[#7A8F79] transition">
                Cancel
              </button>
              <button type="button" onClick={runCompile} className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Vitals</p>
          <div className="flex justify-end">
            <button type="button" onClick={() => setVitals(rows => [...rows, { ...EMPTY_VITAL }])} className="text-xs font-semibold text-[#7A8F79]">+ Add Row</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                <th className={th}>Time</th><th className={th}>Temp</th><th className={th}>HR</th><th className={th}>RR</th>
                <th className={th}>Skin</th><th className={th}>O2 Flow</th><th className={th}>O2 Route</th><th className={th}>O2 %</th>
                <th className={th}>Lung Sounds</th><th className={th}>Tx Needed</th><th className={th}>Suction</th><th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {vitals.map((v, i) => (
                <tr key={i} className="border-b border-[#F4F6F5]">
                  <td className="p-1"><input className={cellInp} value={v.time || ''} onChange={e => updateVital(i, 'time', e.target.value)} /></td>
                  <td className="p-1"><input className={cellInp} value={v.temp || ''} onChange={e => updateVital(i, 'temp', e.target.value)} /></td>
                  <td className="p-1"><input className={cellInp} value={v.hr || ''} onChange={e => updateVital(i, 'hr', e.target.value)} /></td>
                  <td className="p-1"><input className={cellInp} value={v.rr || ''} onChange={e => updateVital(i, 'rr', e.target.value)} /></td>
                  <td className="p-1"><input className={cellInp} value={v.skin || ''} onChange={e => updateVital(i, 'skin', e.target.value)} /></td>
                  <td className="p-1"><input className={cellInp} value={v.o2Flow || ''} onChange={e => updateVital(i, 'o2Flow', e.target.value)} /></td>
                  <td className="p-1">
                    <select className={cellInp} value={v.o2Route || ''} onChange={e => updateVital(i, 'o2Route', e.target.value)}>
                      <option value="">—</option>
                      {O2_ROUTES.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td className="p-1"><input className={cellInp} value={v.o2Percent || ''} onChange={e => updateVital(i, 'o2Percent', e.target.value)} /></td>
                  <td className="p-1"><input className={cellInp} value={v.lungSounds || ''} onChange={e => updateVital(i, 'lungSounds', e.target.value)} /></td>
                  <td className="p-1">
                    <select className={cellInp} value={v.txNeeded || ''} onChange={e => updateVital(i, 'txNeeded', e.target.value)}>
                      <option value="">—</option>
                      {TX_NEEDED.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td className="p-1"><input className={cellInp} value={v.suction || ''} onChange={e => updateVital(i, 'suction', e.target.value)} /></td>
                  <td className="p-1">
                    {vitals.length > 1 && <button type="button" onClick={() => setVitals(rows => rows.filter((_, idx) => idx !== i))} className="text-red-500 text-xs">✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Intake / Output</p>
          <div className="flex justify-end">
            <button type="button" onClick={() => setIntakeOutput(rows => [...rows, { ...EMPTY_IO }])} className="text-xs font-semibold text-[#7A8F79]">+ Add Row</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                <th className={th}>Time</th><th className={th}>Intake Type</th><th className={th}>Intake Amt</th><th className={th}>Intake Route</th>
                <th className={th}>Output Urine</th><th className={th}>Output BM</th><th className={th}>Output Emesis</th><th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {intakeOutput.map((r, i) => (
                <tr key={i} className="border-b border-[#F4F6F5]">
                  <td className="p-1"><input className={cellInp} value={r.time || ''} onChange={e => updateIO(i, 'time', e.target.value)} /></td>
                  <td className="p-1"><input className={cellInp} value={r.intakeType || ''} onChange={e => updateIO(i, 'intakeType', e.target.value)} /></td>
                  <td className="p-1"><input className={cellInp} value={r.intakeAmt || ''} onChange={e => updateIO(i, 'intakeAmt', e.target.value)} /></td>
                  <td className="p-1">
                    <select className={cellInp} value={r.intakeRoute || ''} onChange={e => updateIO(i, 'intakeRoute', e.target.value)}>
                      <option value="">—</option>
                      {INTAKE_ROUTES.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td className="p-1"><input className={cellInp} value={r.outputUrine || ''} onChange={e => updateIO(i, 'outputUrine', e.target.value)} /></td>
                  <td className="p-1"><input className={cellInp} value={r.outputBM || ''} onChange={e => updateIO(i, 'outputBM', e.target.value)} /></td>
                  <td className="p-1"><input className={cellInp} value={r.outputEmesis || ''} onChange={e => updateIO(i, 'outputEmesis', e.target.value)} /></td>
                  <td className="p-1">
                    {intakeOutput.length > 1 && <button type="button" onClick={() => setIntakeOutput(rows => rows.filter((_, idx) => idx !== i))} className="text-red-500 text-xs">✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <div>
          <label className={lbl}>Arrival Findings</label>
          <textarea rows={3} className={`${inp} resize-none`} value={arrivalFindings} onChange={e => setArrivalFindings(e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Shift Notes</label>
          <textarea rows={8} className={`${inp} resize-none`} value={shiftNotes} onChange={e => setShiftNotes(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="button" onClick={saveDraft} disabled={saving} className="bg-[#2F3E4E] text-white px-5 py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Draft'}
        </button>
        {saved && <span className="text-sm font-medium text-green-600">✓ Saved</span>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        {!confirmingSign ? (
          <button type="button" onClick={() => setConfirmingSign(true)} disabled={!shiftNotes.trim()} className="bg-[#2F3E4E] text-white px-5 py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
            Sign &amp; Lock This Note
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[#7A8F79]">Signing locks this note permanently and uses your stored signature. It can no longer be edited.</p>
            {signError && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{signError}</p>}
            <div className="flex items-center gap-3">
              <button type="button" onClick={signAndLock} disabled={signing} className="bg-[#2F3E4E] text-white px-5 py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                {signing ? 'Signing…' : 'Confirm & Sign'}
              </button>
              <button type="button" onClick={() => setConfirmingSign(false)} className="text-sm text-[#7A8F79]">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        {!confirmingDelete ? (
          <button type="button" onClick={() => setConfirmingDelete(true)} className="text-xs font-semibold text-red-600 border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg">
            Delete Draft
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button type="button" onClick={deleteDraft} disabled={deleting} className="bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              {deleting ? 'Deleting…' : 'Confirm Delete'}
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)} className="text-sm text-[#7A8F79]">Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}
