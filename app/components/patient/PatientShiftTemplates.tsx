'use client'

import { useEffect, useState } from 'react'
import { inp, lbl } from './types'

type Template = {
  id: string
  nurseId: string | null
  startTimeOfDay: string
  durationHours: number
  recurrence: string
  daysOfWeek: number[]
  activeFrom: string
  activeUntil: string | null
  notes: string | null
  isActive: boolean
}

type NurseOption = { id: string; displayName: string; firstName?: string; lastName?: string }

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DURATIONS = [4, 8, 12]

function nurseName(nurses: NurseOption[], nurseId: string | null) {
  if (!nurseId) return 'Open — unassigned'
  const n = nurses.find(x => x.id === nurseId)
  return n ? (n.lastName ? `${n.firstName} ${n.lastName}` : n.displayName) : 'Unknown'
}

function fmtTimeOfDay(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function summarizeDays(t: Template) {
  if (t.recurrence === 'daily') return 'Daily'
  return [...t.daysOfWeek].sort((a, b) => a - b).map(d => DAY_LABELS[d]).join('/')
}

// Recurring shift-generation rules for one patient — sits above the ad-hoc
// Shifts panel on app/patient/[id]/schedule. Admin/guardian (canManage) get
// the create form + pause/delete controls; nurses see the same list
// read-only, matching how the ad-hoc Shifts panel already gates editing.
export default function PatientShiftTemplates({
  patientId, availableNurses, canManage,
}: {
  patientId: string
  availableNurses: NurseOption[]
  canManage: boolean
}) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  const [adding, setAdding] = useState(false)
  const [nurseId, setNurseId] = useState('')
  const [startTimeOfDay, setStartTimeOfDay] = useState('07:00')
  const [durationHours, setDurationHours] = useState(8)
  const [recurrence, setRecurrence] = useState<'daily' | 'weekly'>('weekly')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([])
  const [activeFrom, setActiveFrom] = useState('')
  const [activeUntil, setActiveUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    fetch(`/api/patient/${patientId}/shift-templates`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setTemplates(data.templates || []); setLoading(false) })
  }

  useEffect(() => { load() }, [patientId])

  function toggleDay(d: number) {
    setDaysOfWeek(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!activeFrom) return
    if (recurrence === 'weekly' && daysOfWeek.length === 0) {
      setError('Pick at least one day of the week.')
      return
    }
    setSaving(true)
    const res = await fetch(`/api/patient/${patientId}/shift-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        nurseId: nurseId || null,
        startTimeOfDay,
        durationHours,
        recurrence,
        daysOfWeek,
        activeFrom: new Date(activeFrom).toISOString(),
        activeUntil: activeUntil ? new Date(activeUntil).toISOString() : null,
        notes: notes || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setAdding(false)
      setNurseId(''); setStartTimeOfDay('07:00'); setDurationHours(8)
      setRecurrence('weekly'); setDaysOfWeek([]); setActiveFrom(''); setActiveUntil(''); setNotes('')
      load()
    } else {
      const body = await res.json().catch(() => null)
      setError(body?.error || 'Could not save template.')
    }
  }

  async function toggleActive(t: Template) {
    await fetch(`/api/patient/${patientId}/shift-templates/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isActive: !t.isActive }),
    })
    load()
  }

  async function remove(id: string) {
    await fetch(`/api/patient/${patientId}/shift-templates/${id}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  if (loading) return null
  if (!canManage && templates.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Recurring Templates</p>
        {canManage && (
          <button onClick={() => setAdding(a => !a)} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
            {adding ? 'Cancel' : '+ New Template'}
          </button>
        )}
      </div>

      {canManage && adding && (
        <form onSubmit={submit} className="space-y-3 bg-[#F4F6F5] rounded-xl p-4">
          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Nurse (leave blank for open shifts)</label>
              <select className={inp} value={nurseId} onChange={e => setNurseId(e.target.value)}>
                <option value="">— Open —</option>
                {availableNurses.map(n => (
                  <option key={n.id} value={n.id}>{n.lastName ? `${n.firstName} ${n.lastName}` : n.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Shift-Change Start Time</label>
              <input type="time" className={inp} value={startTimeOfDay} onChange={e => setStartTimeOfDay(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className={lbl}>Duration</label>
            <div className="flex gap-2">
              {DURATIONS.map(h => (
                <button
                  key={h} type="button"
                  onClick={() => setDurationHours(h)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition ${
                    durationHours === h ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'
                  }`}
                >
                  {h}hr
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={lbl}>Recurrence</label>
            <div className="flex gap-2 mb-2">
              {(['daily', 'weekly'] as const).map(r => (
                <button
                  key={r} type="button"
                  onClick={() => setRecurrence(r)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold border capitalize transition ${
                    recurrence === r ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {recurrence === 'weekly' && (
              <div className="flex gap-1.5 flex-wrap">
                {DAY_LABELS.map((label, d) => (
                  <button
                    key={d} type="button"
                    onClick={() => toggleDay(d)}
                    className={`w-10 h-9 rounded-lg text-xs font-semibold border transition ${
                      daysOfWeek.includes(d) ? 'bg-[#7A8F79] text-white border-[#7A8F79]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Starts</label>
              <input type="date" className={inp} value={activeFrom} onChange={e => setActiveFrom(e.target.value)} required />
            </div>
            <div>
              <label className={lbl}>Ends (optional)</label>
              <input type="date" className={inp} value={activeUntil} onChange={e => setActiveUntil(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={lbl}>Notes</label>
            <textarea rows={2} className={`${inp} resize-none`} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <button type="submit" disabled={saving} className="bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50">
            {saving ? 'Saving…' : 'Create Template'}
          </button>
        </form>
      )}

      {templates.length === 0 ? (
        <p className="text-xs text-[#7A8F79] italic">No recurring templates.</p>
      ) : (
        <div className="space-y-1.5">
          {templates.map(t => (
            <div key={t.id} className={`flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2 ${!t.isActive ? 'opacity-50' : ''}`}>
              <div>
                <p className="text-sm text-[#2F3E4E] font-semibold">
                  {summarizeDays(t)} · {fmtTimeOfDay(t.startTimeOfDay)}–{fmtTimeOfDay(`${(parseInt(t.startTimeOfDay.split(':')[0]) + t.durationHours) % 24}:${t.startTimeOfDay.split(':')[1]}`)}
                </p>
                <p className="text-xs text-[#7A8F79]">
                  {nurseName(availableNurses, t.nurseId)} · from {fmtDate(t.activeFrom)}{t.activeUntil ? ` to ${fmtDate(t.activeUntil)}` : ''}
                  {!t.isActive && ' · Paused'}
                </p>
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleActive(t)} className="text-xs text-amber-600 hover:text-amber-800 transition">
                    {t.isActive ? 'Pause' : 'Resume'}
                  </button>
                  <button onClick={() => remove(t.id)} className="text-xs text-red-500 hover:text-red-700 transition">Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
