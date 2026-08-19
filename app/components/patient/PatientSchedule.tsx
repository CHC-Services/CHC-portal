'use client'

import { useEffect, useState } from 'react'
import { inp, lbl } from './types'

type Shift = {
  id: string
  nurseId: string | null
  startTime: string
  endTime: string
  status: string
  notes: string | null
}

type Appointment = {
  id: string
  title: string
  location: string | null
  provider: string | null
  startTime: string
  endTime: string | null
  status: string
  notes: string | null
}

type NurseOption = { id: string; displayName: string; firstName?: string; lastName?: string }

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function nurseName(nurses: NurseOption[], nurseId: string | null) {
  if (!nurseId) return null
  const n = nurses.find(x => x.id === nurseId)
  return n ? (n.lastName ? `${n.firstName?.[0] || ''}. ${n.lastName}` : n.displayName) : 'Unknown'
}

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-teal-100 text-teal-700',
  coverage_needed: 'bg-amber-100 text-amber-700',
  assigned: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-[#F4F6F5] text-[#7A8F79]',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  coverage_needed: 'coverage needed',
}

export default function PatientSchedule({
  patientId, basePath, availableNurses,
}: {
  patientId: string
  basePath: string // '/api/admin' or '/api/family'
  availableNurses: NurseOption[]
}) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  const [addingShift, setAddingShift] = useState(false)
  const [shiftNurseId, setShiftNurseId] = useState('')
  const [shiftStart, setShiftStart] = useState('')
  const [shiftEnd, setShiftEnd] = useState('')
  const [shiftNotes, setShiftNotes] = useState('')
  const [savingShift, setSavingShift] = useState(false)

  const [addingAppt, setAddingAppt] = useState(false)
  const [apptTitle, setApptTitle] = useState('')
  const [apptLocation, setApptLocation] = useState('')
  const [apptProvider, setApptProvider] = useState('')
  const [apptStart, setApptStart] = useState('')
  const [apptEnd, setApptEnd] = useState('')
  const [apptNotes, setApptNotes] = useState('')
  const [savingAppt, setSavingAppt] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([
      fetch(`${basePath}/shifts?patientId=${patientId}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${basePath}/appointments?patientId=${patientId}`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([s, a]) => {
      setShifts((s.shifts || []).filter((x: Shift) => x.status !== 'cancelled'))
      setAppointments((a.appointments || []).filter((x: Appointment) => x.status !== 'cancelled'))
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [patientId, basePath])

  async function submitShift(e: React.FormEvent) {
    e.preventDefault()
    if (!shiftStart || !shiftEnd) return
    setSavingShift(true)
    const res = await fetch(`${basePath}/shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        patientId,
        nurseId: shiftNurseId || null,
        startTime: new Date(shiftStart).toISOString(),
        endTime: new Date(shiftEnd).toISOString(),
        notes: shiftNotes || null,
      }),
    })
    setSavingShift(false)
    if (res.ok) {
      setAddingShift(false); setShiftNurseId(''); setShiftStart(''); setShiftEnd(''); setShiftNotes('')
      load()
    }
  }

  async function cancelShift(id: string) {
    await fetch(`${basePath}/shifts/${id}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  // Unassign the nurse without cancelling the shift outright — returns it to
  // coverage_needed so another linked nurse can claim it.
  async function releaseShift(id: string) {
    await fetch(`${basePath}/shifts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nurseId: null, status: 'coverage_needed' }),
    })
    load()
  }

  async function submitAppointment(e: React.FormEvent) {
    e.preventDefault()
    if (!apptTitle || !apptStart) return
    setSavingAppt(true)
    const res = await fetch(`${basePath}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        patientId,
        title: apptTitle,
        location: apptLocation || null,
        provider: apptProvider || null,
        startTime: new Date(apptStart).toISOString(),
        endTime: apptEnd ? new Date(apptEnd).toISOString() : null,
        notes: apptNotes || null,
      }),
    })
    setSavingAppt(false)
    if (res.ok) {
      setAddingAppt(false); setApptTitle(''); setApptLocation(''); setApptProvider(''); setApptStart(''); setApptEnd(''); setApptNotes('')
      load()
    }
  }

  async function cancelAppointment(id: string) {
    await fetch(`${basePath}/appointments/${id}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  if (loading) return <p className="text-sm text-[#7A8F79]">Loading schedule…</p>

  return (
    <div className="space-y-6">

      {/* Shifts */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Shifts</p>
          <button onClick={() => setAddingShift(a => !a)} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
            {addingShift ? 'Cancel' : '+ New Shift'}
          </button>
        </div>

        {addingShift && (
          <form onSubmit={submitShift} className="space-y-3 bg-[#F4F6F5] rounded-xl p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Nurse (leave blank for open shift)</label>
                <select className={inp} value={shiftNurseId} onChange={e => setShiftNurseId(e.target.value)}>
                  <option value="">— Open shift —</option>
                  {availableNurses.map(n => (
                    <option key={n.id} value={n.id}>{n.lastName ? `${n.firstName} ${n.lastName}` : n.displayName}</option>
                  ))}
                </select>
              </div>
              <div />
              <div>
                <label className={lbl}>Start</label>
                <input type="datetime-local" className={inp} value={shiftStart} onChange={e => setShiftStart(e.target.value)} required />
              </div>
              <div>
                <label className={lbl}>End</label>
                <input type="datetime-local" className={inp} value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} required />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Notes</label>
                <textarea rows={2} className={`${inp} resize-none`} value={shiftNotes} onChange={e => setShiftNotes(e.target.value)} />
              </div>
            </div>
            <button type="submit" disabled={savingShift} className="bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50">
              {savingShift ? 'Saving…' : 'Create Shift'}
            </button>
          </form>
        )}

        {shifts.length === 0 ? (
          <p className="text-xs text-[#7A8F79] italic">No shifts scheduled.</p>
        ) : (
          <div className="space-y-1.5">
            {shifts.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm text-[#2F3E4E] font-semibold">
                    {fmtDateTime(s.startTime)} – {fmtDateTime(s.endTime)}
                  </p>
                  <p className="text-xs text-[#7A8F79]">{nurseName(availableNurses, s.nurseId) || 'Unassigned — open'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[s.status] || ''}`}>{STATUS_LABEL[s.status] || s.status}</span>
                  {s.status === 'assigned' && (
                    <button onClick={() => releaseShift(s.id)} className="text-xs text-amber-600 hover:text-amber-800 transition">Release</button>
                  )}
                  {s.status !== 'completed' && (
                    <button onClick={() => cancelShift(s.id)} className="text-xs text-red-500 hover:text-red-700 transition">Cancel</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointments */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Appointments</p>
          <button onClick={() => setAddingAppt(a => !a)} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
            {addingAppt ? 'Cancel' : '+ New Appointment'}
          </button>
        </div>

        {addingAppt && (
          <form onSubmit={submitAppointment} className="space-y-3 bg-[#F4F6F5] rounded-xl p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Title</label>
                <input className={inp} value={apptTitle} onChange={e => setApptTitle(e.target.value)} placeholder="e.g. Cardiology follow-up" required />
              </div>
              <div>
                <label className={lbl}>Location</label>
                <input className={inp} value={apptLocation} onChange={e => setApptLocation(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Provider</label>
                <input className={inp} value={apptProvider} onChange={e => setApptProvider(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Start</label>
                <input type="datetime-local" className={inp} value={apptStart} onChange={e => setApptStart(e.target.value)} required />
              </div>
              <div>
                <label className={lbl}>End (optional)</label>
                <input type="datetime-local" className={inp} value={apptEnd} onChange={e => setApptEnd(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Notes</label>
                <textarea rows={2} className={`${inp} resize-none`} value={apptNotes} onChange={e => setApptNotes(e.target.value)} />
              </div>
            </div>
            <button type="submit" disabled={savingAppt} className="bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50">
              {savingAppt ? 'Saving…' : 'Create Appointment'}
            </button>
          </form>
        )}

        {appointments.length === 0 ? (
          <p className="text-xs text-[#7A8F79] italic">No appointments scheduled.</p>
        ) : (
          <div className="space-y-1.5">
            {appointments.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm text-[#2F3E4E] font-semibold">{a.title}</p>
                  <p className="text-xs text-[#7A8F79]">
                    {fmtDateTime(a.startTime)}{a.endTime ? ` – ${fmtDateTime(a.endTime)}` : ''}
                    {a.location ? ` · ${a.location}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[a.status] || ''}`}>{a.status}</span>
                  {a.status !== 'completed' && (
                    <button onClick={() => cancelAppointment(a.id)} className="text-xs text-red-500 hover:text-red-700 transition">Cancel</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
