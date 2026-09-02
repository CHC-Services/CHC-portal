'use client'

import { useEffect, useRef, useState } from 'react'
import { inp, lbl } from './types'
import DateInput from '../DateInput'

type Appointment = {
  id: string
  title: string
  location: string | null
  description: string | null
  startTime: string
  endTime: string | null
  allDay: boolean
  status: string
  reminderChannel: string
  reminders: { id: string; offsetDays: number }[]
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-[#F4F6F5] text-[#7A8F79]',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-red-100 text-red-700',
}

const CHANNELS = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'both', label: 'Both' },
  { value: 'none', label: 'None' },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// "2026-08-25" parses as UTC midnight in JS (ISO date-only strings), which
// can land on the wrong calendar day once converted to a non-UTC local
// timezone for display — building the Date from y/m/d components instead
// interprets it as local midnight, matching how lib/calendarViewRange.ts
// treats every other date-only value in this app.
function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Appointment scheduling — split out from PatientSchedule.tsx once
// appointments outgrew that shared mini-form: all-day/multi-day spans,
// day-level reminder offsets (this app's Vercel plan only allows daily
// crons, see app/api/cron/appointment-reminders — no hour/minute precision
// yet), and a per-appointment Text/Email/Both/None reminder channel.
export default function AppointmentForm({
  patientId, canManage = true, onCreated,
}: {
  patientId: string
  canManage?: boolean
  // Fires after a successful create — lets a wrapping page (e.g. the
  // cross-patient "+ Add Appointment" modal on myCalendar) refresh its own
  // feed / close itself without this component knowing anything about that.
  onCreated?: () => void
}) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [apptDate, setApptDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reminders, setReminders] = useState<number[]>([1])
  const [reminderChannel, setReminderChannel] = useState('both')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const endDateRef = useRef<HTMLInputElement>(null)
  const startTimeRef = useRef<HTMLInputElement>(null)

  function load() {
    setLoading(true)
    fetch(`/api/patient/${patientId}/appointments`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setAppointments((data.appointments || []).filter((a: Appointment) => a.status !== 'cancelled'))
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [patientId])

  function resetForm() {
    setTitle(''); setLocation(''); setDescription(''); setAllDay(false)
    setApptDate(''); setStartTime(''); setEndTime(''); setEndDate('')
    setReminders([1]); setReminderChannel('both'); setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim() || !apptDate) { setError('Title and date are required.'); return }

    let startIso: string
    let endIso: string | null
    if (allDay) {
      startIso = parseDateOnly(apptDate).toISOString()
      endIso = parseDateOnly(endDate || apptDate).toISOString()
    } else {
      if (!startTime) { setError('Start time is required.'); return }
      startIso = new Date(`${apptDate}T${startTime}`).toISOString()
      endIso = endTime ? new Date(`${apptDate}T${endTime}`).toISOString() : null
    }

    setSaving(true)
    const res = await fetch(`/api/patient/${patientId}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: title.trim(),
        location: location.trim() || null,
        notes: description.trim() || null,
        allDay,
        startTime: startIso,
        endTime: endIso,
        reminderChannel,
        reminders,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setAdding(false)
      resetForm()
      load()
      onCreated?.()
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Failed to save appointment.')
    }
  }

  async function cancelAppointment(id: string) {
    await fetch(`/api/patient/${patientId}/appointments/${id}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  function addReminder() {
    setReminders(rows => [...rows, 1])
  }
  function updateReminder(i: number, days: number) {
    setReminders(rows => rows.map((r, idx) => idx === i ? days : r))
  }
  function removeReminder(i: number) {
    setReminders(rows => rows.filter((_, idx) => idx !== i))
  }

  if (loading) return <p className="text-sm text-[#7A8F79]">Loading appointments…</p>

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Appointments</p>
        {canManage && (
          <button onClick={() => setAdding(a => !a)} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
            {adding ? 'Cancel' : '+ New Appointment'}
          </button>
        )}
      </div>

      {canManage && adding && (
        <form onSubmit={submit} className="space-y-3 bg-[#F4F6F5] rounded-xl p-4">
          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

          <div>
            <label className={lbl}>Title</label>
            <input className={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Cardiology follow-up" required />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="allDay" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="accent-[#7A8F79] w-4 h-4" />
            <label htmlFor="allDay" className="text-sm text-[#2F3E4E] font-semibold cursor-pointer">All-day event (can span multiple days)</label>
          </div>

          {allDay ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Start Date</label>
                <DateInput className={inp} value={apptDate} onChange={e => setApptDate(e.target.value)} required nextRef={endDateRef} />
              </div>
              <div>
                <label className={lbl}>End Date (optional — leave blank for a single day)</label>
                <DateInput ref={endDateRef} className={inp} value={endDate} min={apptDate || undefined} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Date</label>
                <DateInput className={inp} value={apptDate} onChange={e => setApptDate(e.target.value)} required nextRef={startTimeRef} />
              </div>
              <div>
                <label className={lbl}>Start Time</label>
                <input ref={startTimeRef} type="time" className={inp} value={startTime} onChange={e => setStartTime(e.target.value)} required />
              </div>
              <div>
                <label className={lbl}>End Time (optional)</label>
                <input type="time" className={inp} value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <label className={lbl}>Location</label>
            <input className={inp} value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Description</label>
            <textarea rows={2} className={`${inp} resize-none`} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div>
            <label className={lbl}>Reminders</label>
            <div className="space-y-2">
              {reminders.map((days, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    className={`${inp} w-20`}
                    value={days}
                    onChange={e => updateReminder(i, Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                  <span className="text-xs text-[#7A8F79] whitespace-nowrap">day{days === 1 ? '' : 's'} before</span>
                  {reminders.length > 1 && (
                    <button type="button" onClick={() => removeReminder(i)} className="text-red-500 text-xs">✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addReminder} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">
                + Add Reminder
              </button>
            </div>
            <p className="text-[10px] text-[#7A8F79] mt-1">Reminders are day-level only for now (checked once daily), not exact-time.</p>
          </div>

          <div>
            <label className={lbl}>Reminder Channel</label>
            <div className="flex gap-2">
              {CHANNELS.map(c => (
                <button
                  key={c.value} type="button"
                  onClick={() => setReminderChannel(c.value)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition ${reminderChannel === c.value ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'border-[#D9E1E8] text-[#7A8F79] hover:bg-white'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} className="bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50">
            {saving ? 'Saving…' : 'Create Appointment'}
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
                  {a.allDay
                    ? (a.endTime && fmtDate(a.endTime) !== fmtDate(a.startTime) ? `${fmtDate(a.startTime)} – ${fmtDate(a.endTime)}` : `${fmtDate(a.startTime)} · All day`)
                    : `${fmtDateTime(a.startTime)}${a.endTime ? ` – ${fmtDateTime(a.endTime)}` : ''}`}
                  {a.location ? ` · ${a.location}` : ''}
                </p>
                {a.reminders.length > 0 && a.reminderChannel !== 'none' && (
                  <p className="text-[10px] text-[#7A8F79] mt-0.5">
                    Reminders: {a.reminders.map(r => `${r.offsetDays}d`).join(', ')} before · {CHANNELS.find(c => c.value === a.reminderChannel)?.label}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[a.status] || ''}`}>{a.status}</span>
                {canManage && a.status !== 'completed' && (
                  <button onClick={() => cancelAppointment(a.id)} className="text-xs text-red-500 hover:text-red-700 transition">Cancel</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
