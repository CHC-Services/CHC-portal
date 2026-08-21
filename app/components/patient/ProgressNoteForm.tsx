'use client'

import { useEffect, useState } from 'react'
import { lbl } from './types'
import SpellCheckButton, { SpellcheckFlag } from '../SpellCheckButton'
import { checkText } from '../../../lib/medicalSpellcheck'
import { loadCustomTerms, addCustomTerm } from '../../../lib/spellcheckClient'

export type ProgressNoteVitalRow = {
  time: string | null
  temp: string | null
  hr: string | null
  rr: string | null
  skin: string | null
  o2Flow: string | null
  o2Route: string | null
  o2Percent: string | null
  lungSounds: string | null
  txNeeded: string | null
  suction: string | null
}

export type ProgressNoteIntakeOutputRow = {
  time: string | null
  intakeType: string | null
  intakeAmt: string | null
  intakeRoute: string | null
  outputUrine: string | null
  outputBM: string | null
  outputEmesis: string | null
}

export type ProgressNoteAddendumDTO = {
  id: string
  text: string
  authorRole: string
  authorDisplayName: string
  signatureUrl: string
  signedAt: string
}

export type ProgressNoteDTO = {
  id: string
  patientId: string
  authorUserId: string
  authorRole: string
  serviceDate: string
  shiftStartTime: string | null
  shiftEndTime: string | null
  totalHours: number | null
  arrivalFindings: string | null
  shiftNotes: string | null
  signedAt: string | null
  signatureImageKey: string | null
  voidedAt: string | null
  voidedByUserId: string | null
  voidReason: string | null
  vitals: ProgressNoteVitalRow[]
  intakeOutput: ProgressNoteIntakeOutputRow[]
  addenda: ProgressNoteAddendumDTO[]
  authorDisplayName?: string
}

const O2_ROUTES = ['AirVo', 'HME', 'O2 Tank', 'Passy Muir', 'POC', 'Vent', 'Room Air']
const TX_NEEDED = ['Yes', 'No']
const INTAKE_ROUTES = ['Oral', 'G-Tube', 'J-Tube', 'GJ-Split', 'NG-Tube', 'IV']

const EMPTY_VITAL: ProgressNoteVitalRow = { time: null, temp: null, hr: null, rr: null, skin: null, o2Flow: null, o2Route: null, o2Percent: null, lungSounds: null, txNeeded: null, suction: null }
const EMPTY_IO: ProgressNoteIntakeOutputRow = { time: null, intakeType: null, intakeAmt: null, intakeRoute: null, outputUrine: null, outputBM: null, outputEmesis: null }

const cellInp = 'w-full min-w-[4.5rem] border border-[#D9E1E8] rounded px-1.5 py-1 text-xs text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79]'
const th = 'px-1.5 py-1 text-left text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] whitespace-nowrap'

function toDateInputValue(iso: string) {
  return iso ? iso.slice(0, 10) : ''
}

export default function ProgressNoteForm({
  note, basePath, profileHref, onSaved, onSigned, onDeleted,
}: {
  note: ProgressNoteDTO
  basePath: string // '/api/nurse' or '/api/admin'
  profileHref: string // '/nurse/profile' or '/admin/profile' — where to set up a signature
  onSaved: (note: ProgressNoteDTO) => void
  onSigned: (note: ProgressNoteDTO) => void
  onDeleted: () => void
}) {
  const [serviceDate, setServiceDate] = useState(toDateInputValue(note.serviceDate))
  const [shiftStartTime, setShiftStartTime] = useState(note.shiftStartTime || '')
  const [shiftEndTime, setShiftEndTime] = useState(note.shiftEndTime || '')
  const [totalHours, setTotalHours] = useState(note.totalHours != null ? String(note.totalHours) : '')
  const [arrivalFindings, setArrivalFindings] = useState(note.arrivalFindings || '')
  const [shiftNotes, setShiftNotes] = useState(note.shiftNotes || '')
  const [vitals, setVitals] = useState<ProgressNoteVitalRow[]>(note.vitals.length ? note.vitals : [{ ...EMPTY_VITAL }])
  const [intakeOutput, setIntakeOutput] = useState<ProgressNoteIntakeOutputRow[]>(note.intakeOutput.length ? note.intakeOutput : [{ ...EMPTY_IO }])

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [signatureUrl, setSignatureUrl] = useState<string | null | undefined>(undefined)
  const [confirmingSign, setConfirmingSign] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState('')

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`${basePath}/signature`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setSignatureUrl(d.signatureUrl ?? null))
      .catch(() => setSignatureUrl(null))
  }, [basePath])

  async function checkSpelling(text: string): Promise<SpellcheckFlag[]> {
    const customTerms = await loadCustomTerms()
    return checkText(text, customTerms)
  }

  function updateVital(i: number, field: keyof ProgressNoteVitalRow, value: string) {
    setVitals(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value || null } : r))
  }
  function updateIO(i: number, field: keyof ProgressNoteIntakeOutputRow, value: string) {
    setIntakeOutput(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value || null } : r))
  }

  async function saveDraft() {
    setSaving(true); setError(''); setSaved(false)
    const res = await fetch(`${basePath}/progress-notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        serviceDate: new Date(serviceDate).toISOString(),
        shiftStartTime: shiftStartTime || null,
        shiftEndTime: shiftEndTime || null,
        totalHours: totalHours === '' ? null : Number(totalHours),
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
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Failed to save.')
    }
  }

  async function signAndLock() {
    setSigning(true); setSignError('')
    // Ensure the latest edits are saved before locking the note.
    await saveDraft()
    const res = await fetch(`${basePath}/progress-notes/${note.id}/sign`, {
      method: 'POST',
      credentials: 'include',
    })
    setSigning(false)
    if (res.ok) {
      const body = await res.json()
      onSigned(body.note)
    } else {
      const body = await res.json().catch(() => ({}))
      setSignError(body.error || 'Failed to sign.')
    }
  }

  async function deleteDraft() {
    setDeleting(true)
    const res = await fetch(`${basePath}/progress-notes/${note.id}`, { method: 'DELETE', credentials: 'include' })
    setDeleting(false)
    if (res.ok) onDeleted()
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Shift Details</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className={lbl}>Service Date</label>
            <input type="date" className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Shift Start</label>
            <input className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" placeholder="08:00 AM" value={shiftStartTime} onChange={e => setShiftStartTime(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Shift End</label>
            <input className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" placeholder="08:00 PM" value={shiftEndTime} onChange={e => setShiftEndTime(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Total Hours</label>
            <input type="number" step="0.25" className="w-24 border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" value={totalHours} onChange={e => setTotalHours(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Vitals</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#D9E1E8]">
                <th className={th}>Time</th>
                <th className={th}>Temp</th>
                <th className={th}>HR</th>
                <th className={th}>RR</th>
                <th className={th}>Skin</th>
                <th className={th}>O2 Flow</th>
                <th className={th}>O2 Route</th>
                <th className={th}>O2 %</th>
                <th className={th}>Lung Sounds</th>
                <th className={th}>Tx Needed</th>
                <th className={th}>Suction</th>
                <th className={th}></th>
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
                    {vitals.length > 1 && (
                      <button type="button" onClick={() => setVitals(rows => rows.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setVitals(rows => [...rows, { ...EMPTY_VITAL }])} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">+ Add Row</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Intake / Output</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#D9E1E8]">
                <th className={th}>Time</th>
                <th className={th}>Intake Type</th>
                <th className={th}>Intake Amt</th>
                <th className={th}>Intake Route</th>
                <th className={th}>Output Urine</th>
                <th className={th}>Output BM</th>
                <th className={th}>Output Emesis</th>
                <th className={th}></th>
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
                    {intakeOutput.length > 1 && (
                      <button type="button" onClick={() => setIntakeOutput(rows => rows.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setIntakeOutput(rows => [...rows, { ...EMPTY_IO }])} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">+ Add Row</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <label className={lbl}>Arrival Findings</label>
          <textarea spellCheck={false} rows={3} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] resize-none focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" value={arrivalFindings} onChange={e => setArrivalFindings(e.target.value)} />
          <SpellCheckButton text={arrivalFindings} onReplace={setArrivalFindings} onCheck={checkSpelling} onAddToDictionary={addCustomTerm} />
        </div>
        <div>
          <label className={lbl}>Shift Notes</label>
          <textarea spellCheck={false} rows={8} className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] resize-none focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" value={shiftNotes} onChange={e => setShiftNotes(e.target.value)} />
          <SpellCheckButton text={shiftNotes} onReplace={setShiftNotes} onCheck={checkSpelling} onAddToDictionary={addCustomTerm} />
        </div>
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="button" onClick={saveDraft} disabled={saving} className="bg-[#2F3E4E] text-white px-6 py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Draft'}
        </button>
        {saved && <span className="text-sm font-medium text-green-600">✓ Saved</span>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Sign &amp; Lock</p>
        <p className="text-xs text-[#7A8F79]">Signing locks this note permanently — it can no longer be edited. Shift notes must be filled out first.</p>

        {signatureUrl === undefined ? (
          <p className="text-xs text-[#7A8F79]">Checking for a stored signature…</p>
        ) : signatureUrl === null ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            You don&apos;t have a stored signature yet. <a href={profileHref} className="font-semibold underline">Add one on your profile page</a> before signing.
          </p>
        ) : !confirmingSign ? (
          <button
            type="button"
            onClick={() => setConfirmingSign(true)}
            disabled={!shiftNotes.trim()}
            className="bg-[#2F3E4E] text-white px-6 py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
          >
            Sign &amp; Lock This Note
          </button>
        ) : (
          <div className="space-y-3">
            <div className="border border-[#D9E1E8] rounded-lg bg-[#F4F6F5] p-4 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signatureUrl} alt="Your signature" className="max-h-24" />
            </div>
            {signError && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{signError}</p>}
            <div className="flex items-center gap-3">
              <button type="button" onClick={signAndLock} disabled={signing} className="bg-[#2F3E4E] text-white px-6 py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                {signing ? 'Signing…' : 'Confirm & Sign'}
              </button>
              <button type="button" onClick={() => setConfirmingSign(false)} className="border border-[#D9E1E8] text-[#7A8F79] px-6 py-2 rounded-xl text-sm font-semibold hover:bg-white transition">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
        {!confirmingDelete ? (
          <button type="button" onClick={() => setConfirmingDelete(true)} className="text-xs font-semibold text-red-600 border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition">
            Delete Draft
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-red-600">Permanently deletes this draft — it can&apos;t be undone.</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={deleteDraft} disabled={deleting} className="bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Confirm Delete'}
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="text-sm text-[#7A8F79] hover:text-[#2F3E4E] transition">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
