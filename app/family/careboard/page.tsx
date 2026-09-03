'use client'

import { useEffect, useMemo, useState } from 'react'
import { computeViewRange, daysBetween, dateKey } from '../../../lib/calendarViewRange'
import { medicationReminderDate } from '../../../lib/medicationReminders'

// CareBoard — a glanceable, low-clutter weekly summary meant to be left open
// on a household screen (tablet propped in the kitchen, a browser tab left
// up), not actively navigated like the rest of the portal. Per the
// CareBoard architecture notes: "Household Display" scope only — date/time,
// assigned nurse, shift times, appointment title/time, coverage-needed
// indicators, and reminders — no dosages, insurance IDs, or other clinical
// detail. The full unlock-for-more-detail "Authorized Clinical Mode" from
// those notes is explicitly not built here; this page is read-only and
// stays behind the guardian's normal login, same as the rest of /family.

type CalItem = {
  id: string
  source: string
  title: string
  date: string
  endDate?: string
  patientId?: string
  patientName?: string
  category: string
  status?: string
  nurseName?: string
}

type FamilyMedication = {
  id: string
  medicationName: string
  lastFillDate: string
  daySupply: number
  refillsRemaining: number | null
  active: boolean
}

type FamilyPatient = {
  id: string
  firstName: string
  lastName: string
  medications: FamilyMedication[]
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const REFRESH_MS = 5 * 60 * 1000 // 5 minutes — this page is meant to sit open unattended

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function isCoverageNeeded(status: string | undefined): boolean {
  return status === 'open' || status === 'coverage_needed'
}

export default function FamilyCareBoardPage() {
  const [now, setNow] = useState(new Date())
  const [items, setItems] = useState<CalItem[]>([])
  const [patients, setPatients] = useState<FamilyPatient[]>([])
  const [loading, setLoading] = useState(true)

  // Live clock — ticks every 30s, plenty for a "what time is it" glance
  // without redrawing every second on a screen left on all day.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const range = useMemo(() => computeViewRange('week', new Date()), [])
  const days = useMemo(() => daysBetween(range.start, range.end), [range])

  function load() {
    const params = new URLSearchParams({ start: range.start.toISOString(), end: range.end.toISOString() })
    Promise.all([
      fetch(`/api/family/calendar?${params}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { items: [] }),
      fetch('/api/family/medications', { credentials: 'include' }).then(r => r.ok ? r.json() : { patients: [] }),
    ]).then(([cal, meds]) => {
      setItems(cal.items || [])
      setPatients(meds.patients || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // Re-fetch periodically since this is meant to stay open, not be
    // reloaded by hand — a shift claimed or a reminder cleared elsewhere
    // should show up here on its own within a few minutes.
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end])

  const shifts = items.filter(i => i.category === 'shift')
  const appointments = items.filter(i => i.category === 'appointment')

  // One card per linked patient — a family with just one loved one in care
  // gets a single wide card; more than one still reads fine stacked.
  const patientIds = useMemo(() => {
    const ids = new Set<string>()
    for (const i of items) if (i.patientId) ids.add(i.patientId)
    for (const p of patients) ids.add(p.id)
    return [...ids]
  }, [items, patients])

  const nameFor = (patientId: string): string => {
    const fromItem = items.find(i => i.patientId === patientId)?.patientName
    if (fromItem) return fromItem
    const p = patients.find(p => p.id === patientId)
    return p ? `${p.firstName} ${p.lastName}` : 'Patient'
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-10 pl-0 md:pl-0">
      <div className="max-w-6xl">
        {/* Header — live clock, meant to be readable from across the room */}
        <div className="flex items-end justify-between flex-wrap gap-3 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-[#2F3E4E]">
              <span className="text-[#7A8F79] italic">Care</span>Board
            </h1>
            <p className="text-base text-[#7A8F79] mt-1">This week&apos;s care schedule, at a glance.</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#2F3E4E]">{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
            <p className="text-sm text-[#7A8F79]">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        {loading ? (
          <p className="text-base text-[#7A8F79] text-center py-16">Loading…</p>
        ) : patientIds.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <p className="text-lg text-[#2F3E4E] font-semibold">No linked patients yet</p>
            <p className="text-sm text-[#7A8F79] mt-1">Contact the care team if this doesn&apos;t look right.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {patientIds.map(patientId => {
              const patientShifts = shifts.filter(s => s.patientId === patientId)
              const patientAppts = appointments.filter(a => a.patientId === patientId)
              const patient = patients.find(p => p.id === patientId)
              const dueMeds = (patient?.medications || [])
                .filter(m => m.active)
                .map(m => ({ ...m, reminderDate: medicationReminderDate(new Date(m.lastFillDate), m.daySupply, m.refillsRemaining) }))
                .filter(m => m.reminderDate.getTime() <= range.end.getTime())
                .sort((a, b) => a.reminderDate.getTime() - b.reminderDate.getTime())

              return (
                <div key={patientId} className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
                  <h2 className="text-2xl font-bold text-[#2F3E4E] mb-5">{nameFor(patientId)}</h2>

                  <div className="grid md:grid-cols-3 gap-6">
                    {/* This Week's Shifts */}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3">This Week&apos;s Shifts</p>
                      {days.map(day => {
                        const key = dateKey(day)
                        const dayShifts = patientShifts.filter(s => dateKey(new Date(s.date)) === key)
                        const isToday = key === dateKey(new Date())
                        return (
                          <div key={key} className={`flex items-start gap-3 py-2 border-b border-[#F4F6F5] last:border-0 ${isToday ? 'bg-[#F4F6F5] -mx-2 px-2 rounded-lg' : ''}`}>
                            <span className={`text-sm font-bold w-10 shrink-0 ${isToday ? 'text-[#2F3E4E]' : 'text-[#7A8F79]'}`}>
                              {WEEKDAY_LABELS[day.getDay()]}
                            </span>
                            <div className="flex-1 min-w-0">
                              {dayShifts.length === 0 ? (
                                <span className="text-sm text-[#D9E1E8]">—</span>
                              ) : dayShifts.map(s => (
                                <div key={s.id} className="text-sm">
                                  {isCoverageNeeded(s.status) ? (
                                    <span className="font-bold text-red-600">⚠ Coverage Needed</span>
                                  ) : (
                                    <span className="text-[#2F3E4E] font-semibold">{s.nurseName || 'Assigned'}</span>
                                  )}
                                  <span className="text-[#7A8F79] ml-1.5">
                                    {fmtTime(s.date)}{s.endDate ? ` – ${fmtTime(s.endDate)}` : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Appointments */}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3">Appointments</p>
                      {patientAppts.length === 0 ? (
                        <p className="text-sm text-[#7A8F79] italic">None this week.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {patientAppts.map(a => (
                            <div key={a.id} className="text-sm">
                              <p className="text-[#2F3E4E] font-semibold">{a.title}</p>
                              <p className="text-[#7A8F79]">
                                {new Date(a.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                {' · '}{fmtTime(a.date)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Medication Reminders — name + due date only, no dose/route/clinical detail */}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3">Medication Reminders</p>
                      {dueMeds.length === 0 ? (
                        <p className="text-sm text-[#7A8F79] italic">Nothing due this week.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {dueMeds.map(m => {
                            const overdue = m.reminderDate.getTime() <= now.getTime()
                            return (
                              <div key={m.id} className="text-sm flex items-center justify-between gap-2">
                                <span className="text-[#2F3E4E] font-semibold truncate">💊 {m.medicationName}</span>
                                <span className={overdue ? 'font-bold text-red-600' : 'text-[#7A8F79]'}>
                                  {m.reminderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
