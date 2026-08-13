'use client'

import { useEffect, useRef, useState } from 'react'

type DirectoryUser = { id: string; name: string; role: string }
type PatientOption = { id: string; name: string }

const inp = 'w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'
const lbl = 'block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1'

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', nurse: 'Nurse', provider: 'Provider', guardian: 'Family' }

function RecipientPicker({ directory, value, onChange }: { directory: DirectoryUser[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id])
  }

  const filtered = directory.filter(u => u.name.toLowerCase().includes(filter.toLowerCase()))
  const selectedNames = directory.filter(u => value.includes(u.id)).map(u => u.name)

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} className={`${inp} text-left flex items-center justify-between`}>
        <span className={value.length ? '' : 'text-[#aab]'}>
          {value.length ? selectedNames.join(', ') : 'Select recipients…'}
        </span>
        <span className="text-[#7A8F79] text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-[#D9E1E8] rounded-lg shadow-lg p-2">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search…"
            className={`${inp} mb-2`}
          />
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {filtered.length === 0 && <p className="text-xs text-[#7A8F79] italic px-2 py-1">No matches.</p>}
            {filtered.map(u => (
              <label key={u.id} className="flex items-center gap-2 text-sm text-[#2F3E4E] px-2 py-1 rounded hover:bg-[#F4F6F5] cursor-pointer">
                <input type="checkbox" checked={value.includes(u.id)} onChange={() => toggle(u.id)} className="accent-[#7A8F79] w-4 h-4" />
                {u.name} <span className="text-[10px] text-[#7A8F79] uppercase">({ROLE_LABEL[u.role] || u.role})</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MessageComposeModal({
  onClose, onSent, patients, initialRecipientIds, initialSubject, initialBody, initialInReplyToId, draftId,
}: {
  onClose: () => void
  onSent: () => void
  patients?: PatientOption[]
  initialRecipientIds?: string[]
  initialSubject?: string
  initialBody?: string
  initialInReplyToId?: string
  draftId?: string
}) {
  const [directory, setDirectory] = useState<DirectoryUser[]>([])
  const [recipientIds, setRecipientIds] = useState<string[]>(initialRecipientIds || [])
  const [subject, setSubject] = useState(initialSubject || '')
  const [body, setBody] = useState(initialBody || '')
  const [careTeamPatientId, setCareTeamPatientId] = useState('')
  const [loadingCareTeam, setLoadingCareTeam] = useState(false)
  const [sending, setSending] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/messages/directory', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setDirectory(d.directory || []))
  }, [])

  async function loadCareTeam() {
    if (!careTeamPatientId) return
    setLoadingCareTeam(true)
    const res = await fetch(`/api/messages/care-team/${careTeamPatientId}`, { credentials: 'include' })
    setLoadingCareTeam(false)
    if (res.ok) {
      const data = await res.json()
      const ids: string[] = (data.recipients || []).map((r: { id: string }) => r.id)
      setRecipientIds(prev => [...new Set([...prev, ...ids])])
    }
  }

  async function submit(isDraft: boolean) {
    if (!isDraft) {
      if (recipientIds.length === 0) { setError('Select at least one recipient.'); return }
      if (!body.trim()) { setError('Message can\'t be empty.'); return }
    }
    setError('')
    isDraft ? setSavingDraft(true) : setSending(true)
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        recipientIds, subject: subject || undefined, body,
        patientId: careTeamPatientId || undefined,
        isDraft, draftId, inReplyToId: initialInReplyToId,
      }),
    })
    setSavingDraft(false)
    setSending(false)
    if (res.ok) {
      onSent()
      onClose()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Failed to send.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[#2F3E4E] mb-4">New Message</h2>

        {error && <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>}

        <div className="space-y-3 mb-4">
          <div>
            <label className={lbl}>To</label>
            <RecipientPicker directory={directory} value={recipientIds} onChange={setRecipientIds} />
          </div>

          {patients && patients.length > 0 && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className={lbl}>Message a Patient&apos;s Care Team</label>
                <select value={careTeamPatientId} onChange={e => setCareTeamPatientId(e.target.value)} className={inp}>
                  <option value="">Select a patient…</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <button
                type="button"
                onClick={loadCareTeam}
                disabled={!careTeamPatientId || loadingCareTeam}
                className="border border-[#D9E1E8] text-[#7A8F79] px-3 py-2 rounded-lg text-sm font-semibold hover:bg-[#F4F6F5] transition disabled:opacity-40"
              >
                {loadingCareTeam ? '…' : 'Add Team'}
              </button>
            </div>
          )}

          <div>
            <label className={lbl}>Subject (optional)</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} className={inp} />
          </div>

          <div>
            <label className={lbl}>Message</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} className={inp} />
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="border border-[#D9E1E8] text-[#7A8F79] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#F4F6F5] transition">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={sending || savingDraft}
            className="border border-[#D9E1E8] text-[#7A8F79] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#F4F6F5] transition disabled:opacity-40"
          >
            {savingDraft ? 'Saving…' : 'Save Draft'}
          </button>
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={sending || savingDraft}
            className="flex-1 bg-[#2F3E4E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
