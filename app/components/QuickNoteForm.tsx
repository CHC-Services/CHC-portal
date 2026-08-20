'use client'

import { useState } from 'react'

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

export type QuickNoteDTO = {
  id: string
  patientLabel: string
  shiftStartTime: string | null
  shiftEndTime: string | null
  totalHours: number | null
  arrivalFindings: string | null
  shiftNotes: string | null
  signedAt: string | null
  vitals: VitalRow[]
  intakeOutput: IORow[]
}

const O2_ROUTES = ['AirVo', 'HME', 'O2 Tank', 'Passy Muir', 'POC', 'Vent', 'Room Air']
const TX_NEEDED = ['Yes', 'No']
const INTAKE_ROUTES = ['Oral', 'G-Tube', 'J-Tube', 'GJ-Split', 'NG-Tube', 'IV']

const EMPTY_VITAL: VitalRow = { time: null, temp: null, hr: null, rr: null, skin: null, o2Flow: null, o2Route: null, o2Percent: null, lungSounds: null, txNeeded: null, suction: null }
const EMPTY_IO: IORow = { time: null, intakeType: null, intakeAmt: null, intakeRoute: null, outputUrine: null, outputBM: null, outputEmesis: null }

const inp = 'w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'
const lbl = 'block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1'
const cellInp = 'w-full min-w-[4.5rem] border border-[#D9E1E8] rounded px-1.5 py-1 text-xs text-[#2F3E4E] focus:outline-none focus:ring-1 focus:ring-[#7A8F79]'
const th = 'px-1.5 py-1 text-left text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] whitespace-nowrap'

export default function QuickNoteForm({
  token, note, onSaved, onSigned, onDeleted,
}: {
  token: string
  note: QuickNoteDTO
  onSaved: (note: QuickNoteDTO) => void
  onSigned: () => void
  onDeleted: () => void
}) {
  const [shiftStartTime, setShiftStartTime] = useState(note.shiftStartTime || '')
  const [shiftEndTime, setShiftEndTime] = useState(note.shiftEndTime || '')
  const [totalHours, setTotalHours] = useState(note.totalHours != null ? String(note.totalHours) : '')
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

  function headers() {
    return { 'Content-Type': 'application/json', 'X-Quick-Access-Token': token }
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
      headers: headers(),
      body: JSON.stringify({
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
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Shift Start</label>
            <input className={inp} placeholder="08:00 AM" value={shiftStartTime} onChange={e => setShiftStartTime(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Shift End</label>
            <input className={inp} placeholder="08:00 PM" value={shiftEndTime} onChange={e => setShiftEndTime(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Total Hours</label>
            <input type="number" step="0.25" className={inp} value={totalHours} onChange={e => setTotalHours(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Vitals</p>
          <button type="button" onClick={() => setVitals(rows => [...rows, { ...EMPTY_VITAL }])} className="text-xs font-semibold text-[#7A8F79]">+ Add Row</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#D9E1E8]">
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
          <button type="button" onClick={() => setIntakeOutput(rows => [...rows, { ...EMPTY_IO }])} className="text-xs font-semibold text-[#7A8F79]">+ Add Row</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#D9E1E8]">
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
