'use client'

import { useEffect, useRef, useState } from 'react'
import { inp, lbl } from './types'
import DateInput from '../DateInput'

type Template = {
  id: string
  nurseId: string | null
  label: string | null
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

// Duration isn't picked directly — it's computed from the start/end time
// inputs, so shifts of any length (2hr, 5hr, etc.) are representable, not
// just a fixed 4/8/12hr set.
function computeDurationHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let minutes = (eh * 60 + em) - (sh * 60 + sm)
  if (minutes <= 0) minutes += 24 * 60 // crosses midnight
  return Math.round((minutes / 60) * 100) / 100
}

function computeEndTimeOfDay(startTimeOfDay: string, durationHours: number): string {
  const [h, m] = startTimeOfDay.split(':').map(Number)
  const totalMin = (h * 60 + m + Math.round(durationHours * 60)) % (24 * 60)
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
}

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

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// "By month" creation mode — lets a user pick a whole calendar month (e.g.
// "every Tue/Wed in September") instead of hand-picking activeFrom/activeUntil
// dates. Produces the same plain 'YYYY-MM-DD' strings the date-range inputs
// already feed into activeFrom/activeUntil state, so nothing downstream
// (submit, validation) needs to know which mode built them.
function upcomingMonthOptions(count = 12): { value: string; label: string }[] {
  const now = new Date()
  const opts: { value: string; label: string }[] = []
  for (let i = 0; i < count; i++) {
    const m = now.getMonth() + i
    const targetYear = now.getFullYear() + Math.floor(m / 12)
    const targetMonth = m % 12
    opts.push({ value: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`, label: `${MONTH_NAMES[targetMonth]} ${targetYear}` })
  }
  return opts
}

function monthBounds(yyyyMm: string): { from: string; until: string } {
  const [y, m] = yyyyMm.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate() // day 0 of next month = last day of this one
  return { from: `${yyyyMm}-01`, until: `${yyyyMm}-${String(lastDay).padStart(2, '0')}` }
}

// Drives the "Repeat for {Month} ->" quick action on an existing template —
// always extends to the end of the calendar month right after wherever its
// activeUntil currently sits (or today, if it somehow has none), regardless
// of whether that end date happens to already be month-aligned. Pure
// UTC-integer math, not local Date/toLocaleDateString, so it can't drift a
// day near a month boundary depending on the browser's timezone.
function nextRepeatTarget(activeUntil: string | null): { dateStr: string; monthLabel: string } {
  const base = activeUntil ? new Date(activeUntil) : new Date()
  const y = base.getUTCFullYear()
  const m = base.getUTCMonth()
  const targetMonth = (m + 1) % 12
  const targetYear = y + Math.floor((m + 1) / 12)
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return {
    dateStr: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    monthLabel: MONTH_NAMES[targetMonth],
  }
}

// Whole-calendar-day difference (UTC-based, not local) between a template's
// activeUntil and today — drives the "Expiring soon"/"Expired" indicator so
// there's actually a visible cue to click Repeat/Extend before shifts
// silently stop generating.
function daysUntilExpiry(activeUntil: string | null): number | null {
  if (!activeUntil) return null
  const target = new Date(activeUntil)
  const now = new Date()
  const targetKey = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  const todayKey = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((targetKey - todayKey) / 86_400_000)
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nurseId, setNurseId] = useState('')
  const [label, setLabel] = useState('')
  const [startTimeOfDay, setStartTimeOfDay] = useState('07:00')
  const [endTimeOfDay, setEndTimeOfDay] = useState('15:00')
  const [recurrence, setRecurrence] = useState<'daily' | 'weekly'>('weekly')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([])
  const [dateMode, setDateMode] = useState<'range' | 'month'>('range')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [activeFrom, setActiveFrom] = useState('')
  const [activeUntil, setActiveUntil] = useState('')
  const activeUntilRef = useRef<HTMLInputElement>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [repeatingId, setRepeatingId] = useState<string | null>(null)

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

  function resetForm() {
    setAdding(false); setEditingId(null); setError('')
    setNurseId(''); setLabel(''); setStartTimeOfDay('07:00'); setEndTimeOfDay('15:00')
    setRecurrence('weekly'); setDaysOfWeek([]); setActiveFrom(''); setActiveUntil(''); setNotes('')
    setDateMode('range'); setSelectedMonth('')
  }

  function handleMonthSelect(value: string) {
    setSelectedMonth(value)
    if (!value) { setActiveFrom(''); setActiveUntil(''); return }
    const { from, until } = monthBounds(value)
    setActiveFrom(from)
    setActiveUntil(until)
  }

  // Same PATCH the full edit form already uses (see submit()) — just a
  // single-field body, so no new endpoint was needed. The route re-
  // materializes forward on its own once activeUntil moves.
  async function repeatForNextMonth(t: Template) {
    setRepeatingId(t.id)
    const { dateStr } = nextRepeatTarget(t.activeUntil)
    await fetch(`/api/patient/${patientId}/shift-templates/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ activeUntil: new Date(dateStr).toISOString() }),
    })
    setRepeatingId(null)
    load()
  }

  // Doubles as "entire series" edit — clicking Edit on a template row
  // pre-fills this same form and PATCHes that template on submit, which
  // re-materializes forward (see the [templateId] PATCH route), covering the
  // "edit all instances" scope. "This occurrence" / "this and future" scopes
  // are handled per-shift down in PatientSchedule.tsx instead.
  function startEdit(t: Template) {
    setEditingId(t.id)
    setNurseId(t.nurseId || '')
    setLabel(t.label || '')
    setStartTimeOfDay(t.startTimeOfDay)
    setEndTimeOfDay(computeEndTimeOfDay(t.startTimeOfDay, t.durationHours))
    setRecurrence(t.recurrence as 'daily' | 'weekly')
    setDaysOfWeek(t.daysOfWeek)
    setActiveFrom(t.activeFrom.slice(0, 10))
    setActiveUntil(t.activeUntil ? t.activeUntil.slice(0, 10) : '')
    setNotes(t.notes || '')
    setDateMode('range'); setSelectedMonth('')
    setError('')
    setAdding(true)
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
    const res = await fetch(
      editingId ? `/api/patient/${patientId}/shift-templates/${editingId}` : `/api/patient/${patientId}/shift-templates`,
      {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nurseId: nurseId || null,
          label: label || null,
          startTimeOfDay,
          durationHours: computeDurationHours(startTimeOfDay, endTimeOfDay),
          recurrence,
          daysOfWeek,
          activeFrom: new Date(activeFrom).toISOString(),
          activeUntil: activeUntil ? new Date(activeUntil).toISOString() : null,
          notes: notes || null,
        }),
      }
    )
    setSaving(false)
    if (res.ok) {
      resetForm()
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
    if (!confirm('Delete this template? This permanently removes it — use Pause instead if you just want to stop it temporarily.')) return
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
          <button onClick={() => (adding ? resetForm() : setAdding(true))} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
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
              <p className="text-[10px] text-[#7A8F79] mt-1">Open = claimable only by this patient's own linked nurses, not a wider pool.</p>
            </div>
            <div>
              <label className={lbl}>Label</label>
              <input type="text" className={inp} placeholder="e.g. Jane's weekday days" value={label} onChange={e => setLabel(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Start Time</label>
              <input type="time" className={inp} value={startTimeOfDay} onChange={e => setStartTimeOfDay(e.target.value)} required />
            </div>
            <div>
              <label className={lbl}>End Time</label>
              <input type="time" className={inp} value={endTimeOfDay} onChange={e => setEndTimeOfDay(e.target.value)} required />
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

          <div>
            <label className={lbl}>Active Dates</label>
            <div className="flex gap-2 mb-2">
              {(['range', 'month'] as const).map(mode => (
                <button
                  key={mode} type="button"
                  onClick={() => setDateMode(mode)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition ${
                    dateMode === mode ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'
                  }`}
                >
                  {mode === 'range' ? 'Specific Dates' : 'By Month'}
                </button>
              ))}
            </div>

            {dateMode === 'range' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Starts</label>
                  <DateInput className={inp} value={activeFrom} onChange={e => setActiveFrom(e.target.value)} required nextRef={activeUntilRef} />
                </div>
                <div>
                  <label className={lbl}>Ends (optional)</label>
                  <DateInput ref={activeUntilRef} className={inp} value={activeUntil} onChange={e => setActiveUntil(e.target.value)} />
                  <p className="text-[10px] text-[#7A8F79] mt-1">Leave blank to auto-end after 4 months.</p>
                </div>
              </div>
            ) : (
              <div>
                <select className={inp} value={selectedMonth} onChange={e => handleMonthSelect(e.target.value)} required>
                  <option value="">— Select a month —</option>
                  {upcomingMonthOptions().map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {activeFrom && activeUntil && (
                  <p className="text-[10px] text-[#7A8F79] mt-1">
                    Covers {fmtDate(activeFrom)} – {fmtDate(activeUntil)}. Use the recurrence above to pick which days within the month (e.g. every Tue/Wed, or every day). Once the month is over, use the Repeat for {nextRepeatTarget(activeUntil).monthLabel} button on the list below to carry the same schedule forward.
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={lbl}>Notes</label>
            <textarea rows={2} className={`${inp} resize-none`} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <button type="submit" disabled={saving} className="bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50">
            {saving ? 'Saving…' : editingId ? 'Update Template' : 'Create Template'}
          </button>
        </form>
      )}

      {templates.length === 0 ? (
        <p className="text-xs text-[#7A8F79] italic">No recurring templates.</p>
      ) : (
        <div className="space-y-1.5">
          {templates.map(t => {
            const expiry = daysUntilExpiry(t.activeUntil)
            const repeatTarget = nextRepeatTarget(t.activeUntil)
            return (
              <div key={t.id} className={`flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2 ${!t.isActive ? 'opacity-50' : ''}`}>
                <div>
                  <p className="text-sm text-[#2F3E4E] font-semibold">
                    {t.label ? `${t.label} · ` : ''}{summarizeDays(t)} · {fmtTimeOfDay(t.startTimeOfDay)}–{fmtTimeOfDay(computeEndTimeOfDay(t.startTimeOfDay, t.durationHours))}
                  </p>
                  <p className="text-xs text-[#7A8F79]">
                    {nurseName(availableNurses, t.nurseId)} · from {fmtDate(t.activeFrom)}{t.activeUntil ? ` to ${fmtDate(t.activeUntil)}` : ''}
                    {expiry !== null && expiry < 0 && <span className="text-red-600 font-semibold"> · Expired</span>}
                    {expiry !== null && expiry >= 0 && expiry <= 14 && (
                      <span className="text-amber-600 font-semibold"> · Expires {expiry === 0 ? 'today' : `in ${expiry}d`}</span>
                    )}
                    {!t.isActive && ' · Paused'}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(t)} className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] transition">Edit</button>
                    <button
                      onClick={() => repeatForNextMonth(t)}
                      disabled={repeatingId === t.id}
                      className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition disabled:opacity-50"
                    >
                      {repeatingId === t.id ? '…' : `Repeat for ${repeatTarget.monthLabel} →`}
                    </button>
                    <button onClick={() => toggleActive(t)} className="text-xs text-amber-600 hover:text-amber-800 transition">
                      {t.isActive ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => remove(t.id)} className="text-xs text-red-500 hover:text-red-700 transition">Delete</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
