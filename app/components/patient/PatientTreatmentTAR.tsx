'use client'

import { useEffect, useMemo, useState } from 'react'
import { computeViewRange, dateKey as toDateKey, shiftAnchor } from '../../../lib/calendarViewRange'

// The digital Treatment Administration Record — a per-treatment, per-day
// grid (paper TAR, digitized). Simpler than the MAR: one initial per
// treatment per day, not per scheduled clock time — a treatment is either
// done that day or it isn't, no dosing times to track. Mirrors
// PatientMedicationMAR.tsx's grid/modal pattern and mobile-scroll treatment.

type TarStatus = 'done' | 'refused' | 'omitted'

type TarEntry = {
  id?: string
  scheduledDate: string
  status: TarStatus | 'pending'
  omissionReason: string | null
  initialedByUserId: string | null
  initialedByRole: string | null
  initialedByDisplayNameSnapshot: string | null
  notes: string | null
}

type TarTreatment = {
  id: string
  treatmentName: string
  instructions: string | null
  frequency: string | null
  slots: Record<string, TarEntry>
}

const STATUS_STYLE: Record<TarStatus, { bg: string; text: string }> = {
  done: { bg: '#DCFCE7', text: '#15803D' },
  refused: { bg: '#FEE2E2', text: '#B91C1C' },
  omitted: { bg: '#FEF3C7', text: '#92400E' },
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function dayHeaderParts(dateKeyStr: string): { weekday: string; day: string } {
  const d = new Date(`${dateKeyStr}T00:00:00`)
  return { weekday: d.toLocaleDateString('en-US', { weekday: 'short' }), day: String(d.getDate()) }
}

type Draft = {
  treatmentId: string
  treatmentName: string
  scheduledDate: string
  entryId: string | null
  status: TarStatus
  omissionReason: string
  notes: string
  initialedByUserId: string | null
  initialedByDisplayNameSnapshot: string | null
}

const inputCls = 'border border-[#D9E1E8] p-2 rounded-lg text-sm w-full focus:ring-2 focus:ring-[#7A8F79] focus:outline-none'

export default function PatientTreatmentTAR({
  basePath,
  currentUserId,
  canManage,
}: {
  basePath: string
  currentUserId: string
  canManage: boolean
}) {
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [days, setDays] = useState<string[]>([])
  const [treatments, setTreatments] = useState<TarTreatment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newInstructions, setNewInstructions] = useState('')
  const [newFrequency, setNewFrequency] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  const range = useMemo(() => computeViewRange(view, anchorDate), [view, anchorDate])
  const startKey = useMemo(() => toDateKey(range.start), [range])
  const endKey = useMemo(() => toDateKey(range.end), [range])

  const rangeLabel = view === 'week'
    ? `${range.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${range.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : anchorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  function load() {
    setLoading(true)
    fetch(`${basePath}/treatment-administrations?start=${startKey}&end=${endKey}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setDays(data.days || [])
        setTreatments(data.treatments || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey, endKey])

  function openSlot(t: TarTreatment, scheduledDate: string, entry?: TarEntry) {
    const existing = entry && entry.status !== 'pending' ? entry : null
    setError('')
    setDraft({
      treatmentId: t.id,
      treatmentName: t.treatmentName,
      scheduledDate,
      entryId: existing?.id || null,
      status: (existing?.status as TarStatus) || 'done',
      omissionReason: existing?.omissionReason || '',
      notes: existing?.notes || '',
      initialedByUserId: existing?.initialedByUserId || null,
      initialedByDisplayNameSnapshot: existing?.initialedByDisplayNameSnapshot || null,
    })
  }

  async function saveDraft() {
    if (!draft) return
    if (draft.status !== 'done' && !draft.omissionReason.trim()) {
      setError('A reason is required when refused or omitted.')
      return
    }
    setSaving(true)
    setError('')
    const body = {
      treatmentId: draft.treatmentId,
      scheduledDate: draft.scheduledDate,
      status: draft.status,
      omissionReason: draft.omissionReason,
      notes: draft.notes,
    }
    const url = draft.entryId ? `${basePath}/treatment-administrations/${draft.entryId}` : `${basePath}/treatment-administrations`
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
    const res = await fetch(`${basePath}/treatment-administrations/${draft.entryId}`, { method: 'DELETE', credentials: 'include' })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Failed to delete.')
      return
    }
    setDraft(null)
    load()
  }

  async function addTreatment(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAddSaving(true)
    const res = await fetch(`${basePath}/treatments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ treatmentName: newName, instructions: newInstructions, frequency: newFrequency }),
    })
    setAddSaving(false)
    if (res.ok) {
      setNewName(''); setNewInstructions(''); setNewFrequency('')
      setShowAdd(false)
      load()
    }
  }

  const canEditDraft = !!draft && canManage && (!draft.entryId || draft.initialedByUserId === currentUserId)

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
        {canManage && (
          <button
            onClick={() => setShowAdd(s => !s)}
            className="text-xs font-semibold bg-[#2F3E4E] text-white px-3 py-1.5 rounded-full hover:bg-[#7A8F79] transition"
          >
            {showAdd ? 'Cancel' : '+ Add Treatment'}
          </button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={addTreatment} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-[#7A8F79]">Treatment Name</label>
            <input required className={inputCls} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Wound care — left heel" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#7A8F79]">Instructions (optional)</label>
            <textarea className={inputCls} rows={2} value={newInstructions} onChange={e => setNewInstructions(e.target.value)} placeholder="Cleanse and redress, check for signs of infection" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#7A8F79]">Frequency (optional)</label>
            <input className={inputCls} value={newFrequency} onChange={e => setNewFrequency(e.target.value)} placeholder="e.g. Daily, Every shift" />
          </div>
          <button type="submit" disabled={addSaving} className="text-sm font-semibold bg-[#2F3E4E] text-white px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50">
            {addSaving ? 'Saving…' : 'Add Treatment'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm p-5">
        {loading ? (
          <p className="text-sm text-[#7A8F79]">Loading…</p>
        ) : treatments.length === 0 ? (
          <p className="text-sm text-[#7A8F79]">No active treatment orders on file.</p>
        ) : (
          <>
            <p className="md:hidden text-[10px] font-semibold text-[#7A8F79] mb-2">Swipe to see more days →</p>
            <div className="relative">
              <div className="overflow-x-auto">
                <table className="border-collapse text-sm min-w-full">
                  <thead>
                    <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                      <th className="p-2 text-left sticky left-0 bg-white min-w-[180px]">Treatment</th>
                      {days.map(d => {
                        const { weekday, day } = dayHeaderParts(d)
                        return <th key={d} className="p-2 text-center min-w-[64px]">{weekday}<br /><span className="text-[#2F3E4E] font-bold">{day}</span></th>
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {treatments.map(t => (
                      <tr key={t.id} className="border-b border-[#F4F6F5]">
                        <td className="p-2 align-top sticky left-0 bg-white">
                          <p className="font-semibold text-[#2F3E4E]">{t.treatmentName}</p>
                          {t.frequency && <p className="text-[10px] text-[#7A8F79]">{t.frequency}</p>}
                        </td>
                        {days.map(d => {
                          const entry = t.slots[d]
                          const pending = !entry || entry.status === 'pending'
                          return (
                            <td key={d} className="p-1 text-center">
                              <button
                                onClick={() => canManage && openSlot(t, d, entry)}
                                disabled={!canManage}
                                title={!pending ? (entry!.initialedByDisplayNameSnapshot || '') : 'Pending'}
                                className={`w-9 h-9 rounded-lg text-[10px] font-bold ${pending ? 'border border-dashed border-[#D9E1E8] text-[#D9E1E8] hover:border-[#7A8F79] hover:text-[#7A8F79]' : ''} ${!canManage ? 'cursor-default' : ''}`}
                                style={!pending ? { background: STATUS_STYLE[entry!.status as TarStatus].bg, color: STATUS_STYLE[entry!.status as TarStatus].text } : undefined}
                              >
                                {pending ? '—' : entry!.status !== 'done' ? '!' : initialsOf(entry!.initialedByDisplayNameSnapshot || '')}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
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
              <p className="text-sm font-bold text-[#2F3E4E]">{draft.treatmentName}</p>
              <p className="text-xs text-[#7A8F79]">
                {new Date(`${draft.scheduledDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            </div>

            {draft.initialedByDisplayNameSnapshot && (
              <p className="text-[10px] text-[#7A8F79] bg-[#F4F6F5] rounded-lg px-2 py-1.5">
                Initialed by <span className="font-semibold">{draft.initialedByDisplayNameSnapshot}</span>
              </p>
            )}

            <div className="flex gap-2">
              {(['done', 'refused', 'omitted'] as const).map(s => (
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

            {draft.status !== 'done' && (
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
