'use client'

import { useEffect, useMemo, useState } from 'react'
import { computeViewRange, dateKey as toDateKey, shiftAnchor } from '../../../lib/calendarViewRange'

// The digital Medication Administration Record — a per-medication,
// per-scheduled-time, per-day grid (paper MAR, digitized). Slots are
// computed on read server-side; this component just renders whatever the
// GET returns and posts a mark/edit/delete on interaction. Kept a real table
// on mobile too (List vs. card UI convention) — horizontal scroll + fade
// hint, same pattern as QuickNoteForm.tsx's Vitals/IO tables.

type MarStatus = 'given' | 'refused' | 'omitted'

type MarEntry = {
  id?: string
  scheduledDate: string
  scheduledTimeOfDay: string | null
  status: MarStatus | 'pending'
  omissionReason: string | null
  administeredByUserId: string | null
  administeredByRole: string | null
  administeredByDisplayNameSnapshot: string | null
  administeredAt: string | null
  // The administering person's saved e-initial (app/nurse|admin/profile),
  // presigned server-side — when present, the grid shows this drawn mark
  // instead of the computed two-letter fallback (initialsOf below).
  initialsImageUrl: string | null
  documentedByUserId?: string
  documentedByRole?: string
  documentedByDisplayNameSnapshot?: string
  notes: string | null
}

type MarMedication = {
  id: string
  medicationName: string
  dose: string | null
  doseUnit: string | null
  frequency: string | null
  route: string | null
  isPrn: boolean
  scheduleTimes: { id: string; timeOfDay: string }[]
  slots: Record<string, Record<string, MarEntry>>
  prnEntries: Record<string, MarEntry[]>
}

export type MarRosterEntry = { userId: string; name: string; role: 'nurse' | 'guardian' }

const STATUS_STYLE: Record<MarStatus, { bg: string; text: string }> = {
  given: { bg: '#DCFCE7', text: '#15803D' },
  refused: { bg: '#FEE2E2', text: '#B91C1C' },
  omitted: { bg: '#FEF3C7', text: '#92400E' },
}

// Mirrors lib/medicationAdministrationActor.ts's FAMILY_GENERIC_ID — kept as
// a literal here since that module pulls in prisma and can't be imported
// into a client component. Keep both in sync.
const FAMILY_GENERIC_ID = 'family'

// Any guardian-attributed given dose — a specifically named linked guardian
// or the generic "some family member" option — renders as a plain orange
// "fam" badge on the grid instead of that person's initials, so family-
// administered doses read distinctly from nurse-administered ones at a glance.
function isFamilyGiven(entry: MarEntry | undefined): boolean {
  return !!entry && entry.status === 'given' && entry.administeredByRole === 'guardian'
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// A "given" entry's mark — the administering person's saved drawn e-initial
// (entry.initialsImageUrl) when they have one on file, falling back to the
// computed two-letter initials otherwise. Caller still handles pending/
// refused/omitted/family states, which never show this mark.
function InitialsMark({ entry }: { entry: MarEntry }) {
  if (entry.initialsImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={entry.initialsImageUrl} alt={entry.administeredByDisplayNameSnapshot || 'Initials'} className="w-5 h-5 object-contain mx-auto" />
    )
  }
  return <>{initialsOf(entry.administeredByDisplayNameSnapshot || '')}</>
}

function formatTimeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

function dayHeaderParts(dateKeyStr: string): { weekday: string; day: string } {
  const d = new Date(`${dateKeyStr}T00:00:00`)
  return { weekday: d.toLocaleDateString('en-US', { weekday: 'short' }), day: String(d.getDate()) }
}

function isoToTimeOfDay(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function nowTimeOfDay(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

type Draft = {
  medicationId: string
  medicationName: string
  scheduledDate: string
  scheduledTimeOfDay: string | null
  entryId: string | null
  status: MarStatus
  administeredByUserId: string
  administeredTimeOfDay: string
  omissionReason: string
  notes: string
  administeredByDisplayNameSnapshot: string | null
  documentedByDisplayNameSnapshot: string | null
  documentedByUserId: string | null
}

const inputCls = 'border border-[#D9E1E8] p-2 rounded-lg text-sm w-full focus:ring-2 focus:ring-[#7A8F79] focus:outline-none'

export default function PatientMedicationMAR({
  basePath,
  currentUserId,
  currentUserRole,
  canAttributeToOthers,
  roster,
}: {
  basePath: string
  currentUserId: string
  currentUserRole: string
  canAttributeToOthers: boolean
  roster: MarRosterEntry[]
}) {
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [days, setDays] = useState<string[]>([])
  const [medications, setMedications] = useState<MarMedication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const range = useMemo(() => computeViewRange(view, anchorDate), [view, anchorDate])
  const startKey = useMemo(() => toDateKey(range.start), [range])
  const endKey = useMemo(() => toDateKey(range.end), [range])

  const rangeLabel = view === 'week'
    ? `${range.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${range.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : anchorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  function load() {
    setLoading(true)
    fetch(`${basePath}/medication-administrations?start=${startKey}&end=${endKey}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setDays(data.days || [])
        setMedications(data.medications || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey, endKey])

  function openSlot(med: MarMedication, scheduledDate: string, scheduledTimeOfDay: string | null, entry?: MarEntry) {
    const existing = entry && entry.status !== 'pending' ? entry : null
    setError('')
    setDraft({
      medicationId: med.id,
      medicationName: med.medicationName,
      scheduledDate,
      scheduledTimeOfDay,
      entryId: existing?.id || null,
      status: (existing?.status as MarStatus) || 'given',
      // A generic-family entry has no real administeredByUserId in the DB
      // (see FAMILY_GENERIC_ID) — detect it via role instead so reopening it
      // re-selects "Family/Caregiver" rather than silently falling back to self.
      administeredByUserId: existing?.administeredByUserId
        || (existing?.administeredByRole === 'guardian' ? FAMILY_GENERIC_ID : currentUserId),
      // Defaults to this slot's scheduled time, not the current wall-clock
      // time — a dose given on schedule but charted later (the normal case)
      // shouldn't have to be manually corrected away from "right now" every
      // time. Only a PRN entry (scheduledTimeOfDay null — no prescribed time
      // to default to) or a still-blank scheduled slot falls back to now.
      administeredTimeOfDay: existing?.administeredAt
        ? isoToTimeOfDay(existing.administeredAt)
        : (scheduledTimeOfDay || nowTimeOfDay()),
      omissionReason: existing?.omissionReason || '',
      notes: existing?.notes || '',
      administeredByDisplayNameSnapshot: existing?.administeredByDisplayNameSnapshot || null,
      documentedByDisplayNameSnapshot: existing?.documentedByDisplayNameSnapshot || null,
      documentedByUserId: existing?.documentedByUserId || null,
    })
  }

  async function saveDraft() {
    if (!draft) return
    if (draft.status !== 'given' && !draft.omissionReason.trim()) {
      setError('A reason is required when refused or omitted.')
      return
    }
    setSaving(true)
    setError('')
    const body = {
      medicationId: draft.medicationId,
      scheduledDate: draft.scheduledDate,
      scheduledTimeOfDay: draft.scheduledTimeOfDay,
      status: draft.status,
      administeredByUserId: draft.administeredByUserId,
      administeredTimeOfDay: draft.administeredTimeOfDay,
      omissionReason: draft.omissionReason,
      notes: draft.notes,
    }
    const url = draft.entryId ? `${basePath}/medication-administrations/${draft.entryId}` : `${basePath}/medication-administrations`
    const res = await fetch(url, {
      method: draft.entryId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Failed to save.')
      return
    }
    setDraft(null)
    load()
  }

  async function deleteDraft() {
    if (!draft?.entryId) return
    setSaving(true)
    const res = await fetch(`${basePath}/medication-administrations/${draft.entryId}`, { method: 'DELETE', credentials: 'include' })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Failed to delete.')
      return
    }
    setDraft(null)
    load()
  }

  const canEditDraft = !!draft && (!draft.entryId || draft.documentedByUserId === currentUserId || currentUserRole === 'admin')

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1">
          {(['week', 'month'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${view === v ? 'bg-[#2F3E4E] text-white' : 'bg-[#F4F6F5] text-[#7A8F79] hover:bg-[#D9E1E8]'}`}
            >
              {v === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAnchorDate(d => shiftAnchor(view, d, -1))} className="w-7 h-7 rounded-full bg-[#F4F6F5] text-[#2F3E4E] hover:bg-[#D9E1E8] transition text-sm font-bold">‹</button>
          <button onClick={() => setAnchorDate(new Date())} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition px-2">Today</button>
          <button onClick={() => setAnchorDate(d => shiftAnchor(view, d, 1))} className="w-7 h-7 rounded-full bg-[#F4F6F5] text-[#2F3E4E] hover:bg-[#D9E1E8] transition text-sm font-bold">›</button>
          <span className="text-sm font-semibold text-[#2F3E4E] ml-1">{rangeLabel}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5">
        {loading ? (
          <p className="text-sm text-[#7A8F79]">Loading…</p>
        ) : medications.length === 0 ? (
          <p className="text-sm text-[#7A8F79]">No active medications on file.</p>
        ) : (
          <>
            <p className="md:hidden text-[10px] font-semibold text-[#7A8F79] mb-2">Swipe to see more days →</p>
            <div className="relative">
              <div className="overflow-x-auto">
                <table className="border-collapse text-sm min-w-full">
                  <thead>
                    <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                      <th className="p-2 text-left sticky left-0 bg-white min-w-[160px]">Medication</th>
                      <th className="p-2 text-left min-w-[80px]">Time</th>
                      {days.map(d => {
                        const { weekday, day } = dayHeaderParts(d)
                        return <th key={d} className="p-2 text-center min-w-[64px]">{weekday}<br /><span className="text-[#2F3E4E] font-bold">{day}</span></th>
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {medications.map(med => med.isPrn ? (
                      <tr key={med.id} className="border-b border-[#F4F6F5]">
                        <td className="p-2 align-top sticky left-0 bg-white">
                          <p className="font-semibold text-[#2F3E4E]">{med.medicationName}</p>
                          {(med.dose || med.doseUnit) && <p className="text-[10px] text-[#7A8F79]">{med.dose} {med.doseUnit}</p>}
                        </td>
                        <td className="p-2 align-top text-[#7A8F79] text-xs">PRN</td>
                        {days.map(d => (
                          <td key={d} className="p-1 align-top text-center">
                            <div className="flex flex-col items-center gap-1">
                              {(med.prnEntries[d] || []).map(entry => {
                                const family = isFamilyGiven(entry)
                                return (
                                  <button
                                    key={entry.id}
                                    onClick={() => openSlot(med, d, null, entry)}
                                    title={entry.administeredByDisplayNameSnapshot || ''}
                                    className={`w-7 h-7 rounded-full text-[10px] font-bold ${family ? 'border-2 border-orange-500 text-orange-500 bg-transparent' : ''}`}
                                    style={!family ? { background: STATUS_STYLE[entry.status as MarStatus].bg, color: STATUS_STYLE[entry.status as MarStatus].text } : undefined}
                                  >
                                    {entry.status !== 'given' ? '!' : family ? 'fam' : <InitialsMark entry={entry} />}
                                  </button>
                                )
                              })}
                              <button
                                onClick={() => openSlot(med, d, null)}
                                className="w-7 h-7 rounded-full border border-dashed border-[#D9E1E8] text-[#7A8F79] text-xs hover:bg-[#F4F6F5]"
                              >
                                +
                              </button>
                            </div>
                          </td>
                        ))}
                      </tr>
                    ) : med.scheduleTimes.map((st, idx) => (
                      <tr key={`${med.id}-${st.id}`} className="border-b border-[#F4F6F5]">
                        {idx === 0 && (
                          <td className="p-2 align-top sticky left-0 bg-white" rowSpan={med.scheduleTimes.length}>
                            <p className="font-semibold text-[#2F3E4E]">{med.medicationName}</p>
                            {(med.dose || med.doseUnit) && <p className="text-[10px] text-[#7A8F79]">{med.dose} {med.doseUnit}</p>}
                          </td>
                        )}
                        <td className="p-2 align-top text-[#7A8F79] text-xs whitespace-nowrap">{formatTimeLabel(st.timeOfDay)}</td>
                        {days.map(d => {
                          const entry = med.slots[d]?.[st.timeOfDay]
                          const pending = !entry || entry.status === 'pending'
                          const family = isFamilyGiven(entry)
                          return (
                            <td key={d} className="p-1 text-center">
                              <button
                                onClick={() => openSlot(med, d, st.timeOfDay, entry)}
                                title={!pending ? (entry!.administeredByDisplayNameSnapshot || '') : 'Pending'}
                                className={`w-9 h-9 text-[10px] font-bold ${family ? 'rounded-full border-2 border-orange-500 text-orange-500 bg-transparent' : 'rounded-lg'} ${pending ? 'border border-dashed border-[#D9E1E8] text-[#D9E1E8] hover:border-[#7A8F79] hover:text-[#7A8F79]' : ''}`}
                                style={!pending && !family ? { background: STATUS_STYLE[entry!.status as MarStatus].bg, color: STATUS_STYLE[entry!.status as MarStatus].text } : undefined}
                              >
                                {pending ? '—' : entry!.status !== 'given' ? '!' : family ? 'fam' : <InitialsMark entry={entry!} />}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
            </div>
          </>
        )}
      </div>

      {draft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !saving && setDraft(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <p className="text-sm font-bold text-[#2F3E4E]">{draft.medicationName}</p>
              <p className="text-xs text-[#7A8F79]">
                {new Date(`${draft.scheduledDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                {draft.scheduledTimeOfDay ? ` · ${formatTimeLabel(draft.scheduledTimeOfDay)}` : ' · As needed (PRN)'}
              </p>
            </div>

            {(draft.administeredByDisplayNameSnapshot && draft.documentedByDisplayNameSnapshot && draft.administeredByDisplayNameSnapshot !== draft.documentedByDisplayNameSnapshot) && (
              <p className="text-[10px] text-[#7A8F79] bg-[#F4F6F5] rounded-lg px-2 py-1.5">
                Given by <span className="font-semibold">{draft.administeredByDisplayNameSnapshot}</span> · documented by <span className="font-semibold">{draft.documentedByDisplayNameSnapshot}</span>
              </p>
            )}

            <div className="flex gap-2">
              {(['given', 'refused', 'omitted'] as const).map(s => (
                <button
                  key={s}
                  disabled={!canEditDraft}
                  onClick={() => setDraft(d => d && { ...d, status: s })}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition ${draft.status === s ? '' : 'bg-[#F4F6F5] text-[#7A8F79] hover:bg-[#D9E1E8]'}`}
                  style={draft.status === s ? { background: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].text } : undefined}
                >
                  {s}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-semibold text-[#7A8F79]">Administered by</label>
              {canAttributeToOthers ? (
                <select
                  disabled={!canEditDraft}
                  className={inputCls}
                  value={draft.administeredByUserId}
                  onChange={e => setDraft(d => d && { ...d, administeredByUserId: e.target.value })}
                >
                  <option value={currentUserId}>Myself</option>
                  <option value={FAMILY_GENERIC_ID}>Family/Caregiver (unspecified)</option>
                  {roster.filter(r => r.userId !== currentUserId).map(r => (
                    <option key={r.userId} value={r.userId}>{r.name} ({r.role === 'nurse' ? 'Nurse' : 'Family'})</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-[#2F3E4E] mt-1">You</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-[#7A8F79]">Time given</label>
              <input
                type="time"
                disabled={!canEditDraft}
                className={inputCls}
                value={draft.administeredTimeOfDay}
                onChange={e => setDraft(d => d && { ...d, administeredTimeOfDay: e.target.value })}
              />
            </div>

            {draft.status !== 'given' && (
              <div>
                <label className="text-xs font-semibold text-[#7A8F79]">Reason</label>
                <textarea
                  disabled={!canEditDraft}
                  className={inputCls}
                  rows={2}
                  value={draft.omissionReason}
                  onChange={e => setDraft(d => d && { ...d, omissionReason: e.target.value })}
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-[#7A8F79]">Notes (optional)</label>
              <textarea
                disabled={!canEditDraft}
                className={inputCls}
                rows={2}
                value={draft.notes}
                onChange={e => setDraft(d => d && { ...d, notes: e.target.value })}
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex items-center justify-between pt-1">
              <div>
                {draft.entryId && canEditDraft && (
                  <button onClick={deleteDraft} disabled={saving} className="text-xs font-semibold text-red-500">Delete</button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDraft(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-[#7A8F79] hover:bg-[#F4F6F5]">Cancel</button>
                {canEditDraft && (
                  <button onClick={saveDraft} disabled={saving} className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#2F3E4E] text-white hover:bg-[#7A8F79] transition">
                    {saving ? '…' : 'Save'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
