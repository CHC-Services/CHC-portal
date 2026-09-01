'use client'

import { useEffect, useState } from 'react'
import { inp, lbl } from './types'

type Window = { start: string; end: string }

type Template = {
  id: string
  nurseId: string | null
  label: string | null
  startTimeOfDay: string
  durationHours: number
  recurrence: string
  daysOfWeek: number[]
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Same math PatientShiftTemplates.tsx uses for its own start/end time inputs.
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
function fmtTimeOfDay(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}
function summarizeDays(t: Template) {
  if (t.recurrence === 'daily') return 'Daily'
  return [...t.daysOfWeek].sort((a, b) => a - b).map(d => DAY_LABELS[d]).join('/')
}

const emptyWindow = (): Window => ({ start: '07:00', end: '19:00' })

// The coverage NEED, as opposed to who's assigned to fill it — sits above
// PatientShiftTemplates.tsx (unchanged, still how you assign a specific
// nurse to a window). Saving here creates one open (no nurseId) ShiftTemplate
// per window entered; the reconciliation pass in lib/shiftReconciliation.ts
// is what then carves an assigned template/shift's coverage out of whatever
// open windows it overlaps, so this never has to know about assignments
// itself — it only ever describes the need.
export default function PatientCoveragePlan({
  patientId, canManage,
}: {
  patientId: string
  canManage: boolean
}) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState<'same' | 'varying'>('same')
  const [startsOn, setStartsOn] = useState('')
  const [sameWindows, setSameWindows] = useState<Window[]>([emptyWindow()])
  const [perDayWindows, setPerDayWindows] = useState<Record<number, Window[]>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    fetch(`/api/patient/${patientId}/shift-templates`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setTemplates((data.templates || []).filter((t: Template) => t.nurseId === null))
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [patientId])

  function resetForm() {
    setAdding(false); setError(''); setMode('same'); setStartsOn('')
    setSameWindows([emptyWindow()]); setPerDayWindows({})
  }

  function addWindow(day?: number) {
    if (day === undefined) {
      setSameWindows(w => [...w, emptyWindow()])
    } else {
      setPerDayWindows(p => ({ ...p, [day]: [...(p[day] || []), emptyWindow()] }))
    }
  }
  function removeWindow(index: number, day?: number) {
    if (day === undefined) {
      setSameWindows(w => w.filter((_, i) => i !== index))
    } else {
      setPerDayWindows(p => ({ ...p, [day]: (p[day] || []).filter((_, i) => i !== index) }))
    }
  }
  function updateWindow(index: number, field: 'start' | 'end', value: string, day?: number) {
    if (day === undefined) {
      setSameWindows(w => w.map((win, i) => i === index ? { ...win, [field]: value } : win))
    } else {
      setPerDayWindows(p => ({
        ...p,
        [day]: (p[day] || []).map((win, i) => i === index ? { ...win, [field]: value } : win),
      }))
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!startsOn) { setError('Pick a start date.'); return }

    // Build the list of (recurrence, daysOfWeek, window) combos to create —
    // one open ShiftTemplate per entry.
    const toCreate: { recurrence: 'daily' | 'weekly'; daysOfWeek: number[]; window: Window }[] = []
    if (mode === 'same') {
      const valid = sameWindows.filter(w => w.start && w.end)
      if (valid.length === 0) { setError('Add at least one coverage window.'); return }
      for (const window of valid) toCreate.push({ recurrence: 'daily', daysOfWeek: [], window })
    } else {
      let any = false
      for (let day = 0; day < 7; day++) {
        for (const window of (perDayWindows[day] || []).filter(w => w.start && w.end)) {
          any = true
          toCreate.push({ recurrence: 'weekly', daysOfWeek: [day], window })
        }
      }
      if (!any) { setError('Add at least one coverage window on at least one day.'); return }
    }

    setSaving(true)
    for (const entry of toCreate) {
      await fetch(`/api/patient/${patientId}/shift-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nurseId: null,
          startTimeOfDay: entry.window.start,
          durationHours: computeDurationHours(entry.window.start, entry.window.end),
          recurrence: entry.recurrence,
          daysOfWeek: entry.daysOfWeek,
          activeFrom: new Date(startsOn).toISOString(),
          activeUntil: null,
          notes: null,
        }),
      })
    }
    setSaving(false)
    resetForm()
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this coverage window? This permanently removes it.')) return
    await fetch(`/api/patient/${patientId}/shift-templates/${id}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  if (loading) return null
  if (!canManage && templates.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Coverage Needed</p>
          <p className="text-xs text-[#7A8F79] mt-0.5">The windows of time this patient needs a nurse — assign specific nurses below.</p>
        </div>
        {canManage && (
          <button onClick={() => (adding ? resetForm() : setAdding(true))} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
            {adding ? 'Cancel' : '+ Add Coverage Plan'}
          </button>
        )}
      </div>

      {canManage && adding && (
        <form onSubmit={submit} className="space-y-3 bg-[#F4F6F5] rounded-xl p-4">
          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

          <div>
            <label className={lbl}>Starts</label>
            <input type="date" className={`${inp} w-48`} value={startsOn} onChange={e => setStartsOn(e.target.value)} required />
          </div>

          <div className="flex gap-2">
            {(['same', 'varying'] as const).map(m => (
              <button
                key={m} type="button"
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition ${
                  mode === m ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'
                }`}
              >
                {m === 'same' ? 'Same schedule every day' : 'Different schedule per day'}
              </button>
            ))}
          </div>

          {mode === 'same' ? (
            <div className="space-y-2">
              {sameWindows.map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="time" className={inp} value={w.start} onChange={e => updateWindow(i, 'start', e.target.value)} />
                  <span className="text-xs text-[#7A8F79]">to</span>
                  <input type="time" className={inp} value={w.end} onChange={e => updateWindow(i, 'end', e.target.value)} />
                  <button type="button" onClick={() => removeWindow(i)} className="text-xs text-red-500 hover:text-red-700 transition">Remove</button>
                </div>
              ))}
              <button type="button" onClick={() => addWindow()} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
                + Add Coverage
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {DAY_LABELS.map((label, day) => (
                <div key={day} className="border-t border-[#D9E1E8] pt-2 first:border-t-0 first:pt-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#7A8F79] mb-1">{label}</p>
                  <div className="space-y-2">
                    {(perDayWindows[day] || []).map((w, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="time" className={inp} value={w.start} onChange={e => updateWindow(i, 'start', e.target.value, day)} />
                        <span className="text-xs text-[#7A8F79]">to</span>
                        <input type="time" className={inp} value={w.end} onChange={e => updateWindow(i, 'end', e.target.value, day)} />
                        <button type="button" onClick={() => removeWindow(i, day)} className="text-xs text-red-500 hover:text-red-700 transition">Remove</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addWindow(day)} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
                      + Add Coverage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button type="submit" disabled={saving} className="bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Coverage Plan'}
          </button>
        </form>
      )}

      {templates.length === 0 ? (
        <p className="text-xs text-[#7A8F79] italic">No coverage windows defined yet.</p>
      ) : (
        <div className="space-y-1.5">
          {templates.map(t => (
            <div key={t.id} className="flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2">
              <p className="text-sm text-[#2F3E4E] font-semibold">
                {t.label ? `${t.label} · ` : ''}{summarizeDays(t)} · {fmtTimeOfDay(t.startTimeOfDay)}–{fmtTimeOfDay(computeEndTimeOfDay(t.startTimeOfDay, t.durationHours))}
              </p>
              {canManage && (
                <button onClick={() => remove(t.id)} className="text-xs text-red-500 hover:text-red-700 transition">Delete</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
