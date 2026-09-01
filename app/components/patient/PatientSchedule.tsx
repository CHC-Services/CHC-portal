'use client'

import { useEffect, useState } from 'react'
import { inp, lbl } from './types'

type Shift = {
  id: string
  nurseId: string | null
  templateId: string | null
  startTime: string
  endTime: string
  status: string
  notes: string | null
}

// datetime-local inputs need "YYYY-MM-DDTHH:MM" in local time, not a raw ISO string.
function toLocalInputValue(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type NurseOption = { id: string; displayName: string; firstName?: string; lastName?: string }

type ClaimRequest = {
  id: string
  requestedStart: string
  requestedEnd: string
  nurse: { id: string; displayName: string; firstName?: string; lastName?: string }
}

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

// Shift scheduling only — appointments moved to AppointmentForm.tsx once
// the appointment feature outgrew sharing this component (all-day/multi-day
// spans, reminders, channel picker).
export default function PatientSchedule({
  patientId, basePath, availableNurses, canManage = true,
}: {
  patientId: string
  basePath: string // always '/api/patient/{id}' today (its one caller) — kept as a prop rather than hardcoded in case a future admin-only bulk view wants to reuse this component against a different endpoint
  availableNurses: NurseOption[]
  // Gates create/edit/cancel controls. Defaults true (existing admin/family
  // embeds are unaffected) — the new shared /patient/[id]/schedule page
  // passes this from lib/permissions.ts so e.g. a nurse without shift-create
  // authority sees a read-only list instead of doomed-to-404 buttons.
  canManage?: boolean
}) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)

  const [addingShift, setAddingShift] = useState(false)
  const [shiftNurseId, setShiftNurseId] = useState('')
  const [shiftStart, setShiftStart] = useState('')
  const [shiftEnd, setShiftEnd] = useState('')
  const [shiftNotes, setShiftNotes] = useState('')
  const [savingShift, setSavingShift] = useState(false)

  // Occurrence-scoped edit/delete for template-generated shifts — "this
  // shift only" / "this and future" / "entire series", mirroring the
  // standard calendar-app pattern. Ad-hoc (non-template) shifts skip the
  // scope prompt entirely and act immediately, same as before.
  const [cancelScopeFor, setCancelScopeFor] = useState<string | null>(null) // shift id
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
  const [editScope, setEditScope] = useState<'this' | 'future'>('this')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Pending partial-shift-claim requests — only ever non-empty when this
  // patient has partialShiftClaimsRequireApproval on (see
  // app/components/patient/PatientNotifications.tsx's "Shift Coverage"
  // toggle and app/api/nurse/shifts/[id]/claim-portion/route.ts).
  const [claimRequests, setClaimRequests] = useState<ClaimRequest[]>([])
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null)

  function loadClaimRequests() {
    if (!canManage) return
    fetch(`/api/patient/${patientId}/shift-claim-requests`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setClaimRequests(d.requests || []))
      .catch(() => {})
  }

  useEffect(() => { loadClaimRequests() }, [patientId, canManage])

  async function resolveClaimRequest(id: string, action: 'approve' | 'reject') {
    setResolvingRequestId(id)
    await fetch(`/api/patient/${patientId}/shift-claim-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action }),
    })
    setResolvingRequestId(null)
    loadClaimRequests()
    load()
  }

  function load() {
    setLoading(true)
    fetch(`${basePath}/shifts?patientId=${patientId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(s => {
        setShifts((s.shifts || []).filter((x: Shift) => x.status !== 'cancelled'))
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

  function onCancelClick(s: Shift) {
    if (s.templateId) setCancelScopeFor(s.id)
    else cancelShift(s.id)
  }

  async function cancelWithScope(s: Shift, scope: 'this' | 'future' | 'series') {
    setCancelScopeFor(null)
    if (scope === 'series') {
      await fetch(`/api/patient/${patientId}/shift-templates/${s.templateId}`, { method: 'DELETE', credentials: 'include' })
    } else {
      await fetch(`${basePath}/shift-templates/${s.templateId}/occurrences/${s.id}?scope=${scope}`, { method: 'DELETE', credentials: 'include' })
    }
    load()
  }

  function startEdit(s: Shift) {
    setEditingShiftId(s.id)
    setEditScope('this')
    setEditStart(toLocalInputValue(s.startTime))
    setEditEnd(toLocalInputValue(s.endTime))
    setEditNotes(s.notes || '')
  }

  async function submitEdit(s: Shift) {
    if (!editStart || !editEnd) return
    setSavingEdit(true)
    if (s.templateId && editScope === 'future') {
      // "This and future" edits the recurring pattern itself (wall-clock
      // time-of-day + duration), not one instant — the split point comes
      // from this occurrence server-side, not from the edited date.
      const start = new Date(editStart)
      const end = new Date(editEnd)
      const startTimeOfDay = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
      let minutes = (end.getTime() - start.getTime()) / 60_000
      if (minutes <= 0) minutes += 24 * 60
      const durationHours = Math.round((minutes / 60) * 100) / 100
      await fetch(`${basePath}/shift-templates/${s.templateId}/occurrences/${s.id}?scope=future`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ startTimeOfDay, durationHours, notes: editNotes || null }),
      })
    } else {
      const url = s.templateId
        ? `${basePath}/shift-templates/${s.templateId}/occurrences/${s.id}?scope=this`
        : `${basePath}/shifts/${s.id}`
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          startTime: new Date(editStart).toISOString(),
          endTime: new Date(editEnd).toISOString(),
          notes: editNotes || null,
        }),
      })
    }
    setSavingEdit(false)
    setEditingShiftId(null)
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

  if (loading) return <p className="text-sm text-[#7A8F79]">Loading schedule…</p>

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
      {canManage && claimRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-bold uppercase tracking-widest text-amber-700">Pending Shift Requests</p>
          {claimRequests.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
              <div>
                <p className="text-sm text-[#2F3E4E] font-semibold">
                  {nurseName([r.nurse], r.nurse.id)} wants {fmtDateTime(r.requestedStart)} – {fmtDateTime(r.requestedEnd)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => resolveClaimRequest(r.id, 'approve')}
                  disabled={resolvingRequestId === r.id}
                  className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => resolveClaimRequest(r.id, 'reject')}
                  disabled={resolvingRequestId === r.id}
                  className="text-xs font-semibold text-red-500 hover:text-red-700 transition disabled:opacity-50"
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Shifts</p>
        {canManage && (
          <button onClick={() => setAddingShift(a => !a)} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
            {addingShift ? 'Cancel' : '+ New Shift'}
          </button>
        )}
      </div>

      {canManage && addingShift && (
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
              <p className="text-[10px] text-[#7A8F79] mt-1">Open = claimable only by this patient's own linked nurses, not a wider pool.</p>
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
            <div key={s.id} className="bg-[#F4F6F5] rounded-lg px-3 py-2 space-y-2">
              {editingShiftId === s.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={lbl}>Start</label>
                      <input type="datetime-local" className={inp} value={editStart} onChange={e => setEditStart(e.target.value)} />
                    </div>
                    <div>
                      <label className={lbl}>End</label>
                      <input type="datetime-local" className={inp} value={editEnd} onChange={e => setEditEnd(e.target.value)} />
                    </div>
                  </div>
                  <textarea rows={2} className={`${inp} resize-none w-full`} placeholder="Notes" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                  {s.templateId && (
                    <div className="flex gap-2">
                      {(['this', 'future'] as const).map(scope => (
                        <button
                          key={scope} type="button"
                          onClick={() => setEditScope(scope)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                            editScope === scope ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'
                          }`}
                        >
                          {scope === 'this' ? 'This shift only' : 'This and future'}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => submitEdit(s)} disabled={savingEdit} className="bg-[#2F3E4E] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50">
                      {savingEdit ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingShiftId(null)} className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] transition">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#2F3E4E] font-semibold">
                      {fmtDateTime(s.startTime)} – {fmtDateTime(s.endTime)}
                      {s.templateId && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79]">↻ Recurring</span>}
                    </p>
                    <p className="text-xs text-[#7A8F79]">{nurseName(availableNurses, s.nurseId) || 'Unassigned — open'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[s.status] || ''}`}>{STATUS_LABEL[s.status] || s.status}</span>
                    {canManage && s.status === 'assigned' && (
                      <button onClick={() => releaseShift(s.id)} className="text-xs text-amber-600 hover:text-amber-800 transition">Release</button>
                    )}
                    {canManage && s.status !== 'completed' && (
                      <button onClick={() => startEdit(s)} className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] transition">Edit</button>
                    )}
                    {canManage && s.status !== 'completed' && (
                      <button onClick={() => onCancelClick(s)} className="text-xs text-red-500 hover:text-red-700 transition">Cancel</button>
                    )}
                  </div>
                </div>
              )}

              {cancelScopeFor === s.id && (
                <div className="flex items-center gap-2 border-t border-[#D9E1E8] pt-2">
                  <span className="text-xs text-[#7A8F79]">Cancel:</span>
                  <button onClick={() => cancelWithScope(s, 'this')} className="text-xs font-semibold text-red-500 hover:text-red-700 transition">This shift only</button>
                  <button onClick={() => cancelWithScope(s, 'future')} className="text-xs font-semibold text-red-500 hover:text-red-700 transition">This and future</button>
                  <button onClick={() => cancelWithScope(s, 'series')} className="text-xs font-semibold text-red-500 hover:text-red-700 transition">Entire series</button>
                  <button onClick={() => setCancelScopeFor(null)} className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] transition ml-auto">Nevermind</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
