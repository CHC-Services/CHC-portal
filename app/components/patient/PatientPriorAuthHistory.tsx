'use client'

import { useState } from 'react'
import { inp, lbl } from './types'

export type PatientPA = {
  id: string
  paNumber: string
  paStartDate: string | null
  paEndDate: string | null
  highTech: boolean
  createdAt: string
}

// Puts the PA whose window contains today first (marked active); everything else
// newest-to-oldest by end date, regardless of the order they were entered.
function prioritizePAs(pas: PatientPA[]): PatientPA[] {
  const today = new Date().toISOString().slice(0, 10)
  const withinWindow = (pa: PatientPA) =>
    (!pa.paStartDate || pa.paStartDate <= today) && (!pa.paEndDate || pa.paEndDate >= today)

  const active = pas.filter(withinWindow)
  const current = active.length
    ? active.reduce((a, b) => (b.paStartDate || '') > (a.paStartDate || '') ? b : a)
    : null

  const rest = pas
    .filter(pa => pa !== current)
    .sort((a, b) => (b.paEndDate || '9999-99-99').localeCompare(a.paEndDate || '9999-99-99'))

  return current ? [current, ...rest] : rest
}

export default function PatientPriorAuthHistory({
  priorAuths, canEdit, onAdd, onEdit, onDelete,
}: {
  priorAuths: PatientPA[]
  canEdit: boolean
  onAdd: (pa: { paNumber: string; paStartDate: string; paEndDate: string; highTech: boolean }) => Promise<{ ok: boolean; error?: string }>
  onEdit: (paId: string, pa: { paNumber: string; paStartDate: string; paEndDate: string; highTech: boolean }) => Promise<{ ok: boolean; error?: string }>
  onDelete: (paId: string) => Promise<void>
}) {
  const [showAddPA, setShowAddPA] = useState(false)
  const [newPA, setNewPA] = useState({ paNumber: '', paStartDate: '', paEndDate: '', highTech: false })
  const [savingPA, setSavingPA] = useState(false)
  const [paError, setPaError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPA, setEditPA] = useState({ paNumber: '', paStartDate: '', paEndDate: '', highTech: false })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  async function handleAddPA(e: React.FormEvent) {
    e.preventDefault()
    if (!newPA.paNumber.trim()) return
    setSavingPA(true); setPaError('')
    const result = await onAdd(newPA)
    setSavingPA(false)
    if (result.ok) {
      setNewPA({ paNumber: '', paStartDate: '', paEndDate: '', highTech: false })
      setShowAddPA(false)
    } else {
      setPaError(result.error || 'Failed to save.')
    }
  }

  function startEdit(pa: PatientPA) {
    setShowAddPA(false)
    setEditingId(pa.id)
    setEditPA({ paNumber: pa.paNumber, paStartDate: pa.paStartDate || '', paEndDate: pa.paEndDate || '', highTech: pa.highTech })
    setEditError('')
  }

  async function handleEditPA(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId || !editPA.paNumber.trim()) return
    setSavingEdit(true); setEditError('')
    const result = await onEdit(editingId, editPA)
    setSavingEdit(false)
    if (result.ok) {
      setEditingId(null)
    } else {
      setEditError(result.error || 'Failed to save.')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-[#D9E1E8]">
        <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E]">Prior Authorization History</p>
        {canEdit && (
          <button onClick={() => { setShowAddPA(v => !v); setPaError(''); setEditingId(null) }}
            className="text-[10px] font-semibold text-[#7A8F79] border border-[#D9E1E8] px-2 py-0.5 rounded hover:bg-[#F4F6F5] transition">
            {showAddPA ? 'Cancel' : '+ Add PA'}
          </button>
        )}
      </div>

      {showAddPA && (
        <form onSubmit={handleAddPA} className="bg-[#F4F6F5] rounded-xl p-3 mb-3 space-y-2">
          <div>
            <label className={lbl}>PA Number</label>
            <input required value={newPA.paNumber} onChange={e => setNewPA(p => ({ ...p, paNumber: e.target.value }))}
              placeholder="Authorization number" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Start Date</label>
              <input type="date" value={newPA.paStartDate} onChange={e => setNewPA(p => ({ ...p, paStartDate: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>End Date</label>
              <input type="date" value={newPA.paEndDate} onChange={e => setNewPA(p => ({ ...p, paEndDate: e.target.value }))} className={inp} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={newPA.highTech} onChange={e => setNewPA(p => ({ ...p, highTech: e.target.checked }))} className="accent-[#7A8F79] w-4 h-4" />
            <span className="text-sm text-[#2F3E4E] font-semibold">High-Tech designation</span>
          </label>
          {paError && <p className="text-xs text-red-500">{paError}</p>}
          <button type="submit" disabled={savingPA}
            className="w-full bg-[#2F3E4E] text-white text-sm font-semibold py-1.5 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50">
            {savingPA ? 'Saving…' : 'Save PA'}
          </button>
        </form>
      )}

      {priorAuths.length === 0 ? (
        <p className="text-xs text-[#7A8F79] italic">No prior authorizations on file.</p>
      ) : (
        <div className="space-y-2">
          {prioritizePAs(priorAuths).map((pa) => {
            const today = new Date().toISOString().slice(0, 10)
            const isCurrent = (!pa.paStartDate || pa.paStartDate <= today) && (!pa.paEndDate || pa.paEndDate >= today)
            const isExpired = !isCurrent && !!pa.paEndDate && pa.paEndDate < today
            if (editingId === pa.id) {
              return (
                <form key={pa.id} onSubmit={handleEditPA} className="bg-[#F4F6F5] rounded-xl p-3 space-y-2">
                  <div>
                    <label className={lbl}>PA Number</label>
                    <input required value={editPA.paNumber} onChange={e => setEditPA(p => ({ ...p, paNumber: e.target.value }))}
                      placeholder="Authorization number" className={inp} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={lbl}>Start Date</label>
                      <input type="date" value={editPA.paStartDate} onChange={e => setEditPA(p => ({ ...p, paStartDate: e.target.value }))} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>End Date</label>
                      <input type="date" value={editPA.paEndDate} onChange={e => setEditPA(p => ({ ...p, paEndDate: e.target.value }))} className={inp} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editPA.highTech} onChange={e => setEditPA(p => ({ ...p, highTech: e.target.checked }))} className="accent-[#7A8F79] w-4 h-4" />
                    <span className="text-sm text-[#2F3E4E] font-semibold">High-Tech designation</span>
                  </label>
                  {editError && <p className="text-xs text-red-500">{editError}</p>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={savingEdit}
                      className="flex-1 bg-[#2F3E4E] text-white text-sm font-semibold py-1.5 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50">
                      {savingEdit ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}
                      className="px-3 text-sm font-semibold text-[#7A8F79] border border-[#D9E1E8] rounded-lg hover:bg-white transition">
                      Cancel
                    </button>
                  </div>
                </form>
              )
            }
            return (
              <div key={pa.id} className={`rounded-xl border px-3 py-2.5 ${isCurrent ? 'border-[#7A8F79] bg-[#f4f9f4]' : 'border-[#D9E1E8]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-[#2F3E4E] font-mono uppercase">{pa.paNumber}</span>
                      {isCurrent && <span className="text-[9px] font-bold uppercase bg-[#7A8F79] text-white px-1.5 py-0.5 rounded-full">Active</span>}
                      {pa.highTech && <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Hi-Tech</span>}
                      {isExpired && <span className="text-[9px] font-bold uppercase bg-[#F4F6F5] text-[#7A8F79] px-1.5 py-0.5 rounded-full">Expired</span>}
                    </div>
                    <p className="text-[10px] text-[#7A8F79] mt-0.5">
                      {pa.paStartDate || '?'} — {pa.paEndDate || 'Present'}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => startEdit(pa)}
                        className="text-[10px] text-[#7A8F79] hover:text-[#2F3E4E] font-semibold transition">
                        Edit
                      </button>
                      <button onClick={() => onDelete(pa.id)}
                        className="text-[10px] text-red-400 hover:text-red-600 font-semibold transition">
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
