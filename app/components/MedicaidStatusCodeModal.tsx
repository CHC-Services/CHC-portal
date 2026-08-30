'use client'

import { useState } from 'react'

type StatusCode = {
  code: string
  description: string
  active: boolean
  outcome: string | null
}

const OUTCOME_STYLE: Record<string, string> = {
  Pay: 'bg-green-50 text-green-700',
  Deny: 'bg-red-50 text-red-700',
  Neutral: 'bg-[#F4F6F5] text-[#7A8F79]',
}

// Payer-specific claim status code reference (F1, 3, F2, 483, ...) — a small,
// admin-curated list (unlike the ~1,600-row X12 CARC/RARC table CarcLookupModal
// covers), so this is list+filter rather than server-side search, plus inline
// admin CRUD since there's no separate management page for it. Claim.remarkCodes
// is a free-text, comma-separated field admin fills in per claim; this table is
// what resolves those codes into descriptions on the claim card.
export default function MedicaidStatusCodeModal({ showAdminTools }: { showAdminTools?: boolean }) {
  const [open, setOpen] = useState(false)
  const [codes, setCodes] = useState<StatusCode[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ description: '', active: true, outcome: '' })
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ code: '', description: '', outcome: '' })
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    fetch('/api/medicaid-status-codes', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCodes(data) })
      .finally(() => setLoading(false))
  }

  function openModal() {
    setOpen(true)
    load()
  }

  function close() {
    setOpen(false)
    setFilter('')
    setEditingCode(null)
    setShowAddForm(false)
    setError('')
  }

  function startEdit(c: StatusCode) {
    setEditingCode(c.code)
    setEditForm({ description: c.description, active: c.active, outcome: c.outcome || '' })
  }

  async function saveEdit(code: string) {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/admin/medicaid/status-codes/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(editForm),
    })
    setSaving(false)
    if (res.ok) { setEditingCode(null); load() } else { setError('Failed to save.') }
  }

  async function deleteCode(code: string) {
    if (!confirm(`Delete status code "${code}"?`)) return
    await fetch(`/api/admin/medicaid/status-codes/${encodeURIComponent(code)}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/medicaid/status-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(addForm),
    })
    setSaving(false)
    if (res.ok) {
      setAddForm({ code: '', description: '', outcome: '' })
      setShowAddForm(false)
      load()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Failed to add.')
    }
  }

  const filtered = codes.filter(c =>
    !filter.trim() ||
    c.code.toLowerCase().includes(filter.toLowerCase()) ||
    c.description.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <>
      <button
        onClick={openModal}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#D9E1E8] text-[#7A8F79] hover:border-[#7A8F79] hover:text-[#2F3E4E] transition"
      >
        🔍 Look up Status Code
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16" onClick={close}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[75vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[#D9E1E8]">
              <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E] mb-2">Medicaid Claim Status Codes</p>
              <input
                autoFocus
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filter by code or description…"
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {loading && <p className="text-sm text-[#7A8F79] italic p-4">Loading…</p>}
              {!loading && filtered.length === 0 && (
                <p className="text-sm text-[#7A8F79] italic p-4">No matching codes.</p>
              )}
              {!loading && filtered.map(c => (
                <div key={c.code} className="p-3 border-b border-[#F4F6F5] last:border-b-0">
                  {editingCode === c.code ? (
                    <div className="space-y-2">
                      <textarea
                        value={editForm.description}
                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                        rows={2}
                        className="w-full border border-[#D9E1E8] p-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <select
                          value={editForm.outcome}
                          onChange={e => setEditForm(f => ({ ...f, outcome: e.target.value }))}
                          className="h-[30px] border border-[#D9E1E8] rounded-lg px-2 text-xs text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                        >
                          <option value="">No outcome</option>
                          <option value="Pay">Pay</option>
                          <option value="Deny">Deny</option>
                          <option value="Neutral">Neutral</option>
                        </select>
                        <label className="flex items-center gap-1 text-xs text-[#2F3E4E]">
                          <input type="checkbox" checked={editForm.active} onChange={e => setEditForm(f => ({ ...f, active: e.target.checked }))} className="accent-[#7A8F79]" />
                          Active
                        </label>
                        <button onClick={() => saveEdit(c.code)} disabled={saving} className="ml-auto text-xs font-semibold text-white bg-[#2F3E4E] px-3 py-1 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50">
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingCode(null)} className="text-xs font-semibold text-[#7A8F79] px-2">Cancel</button>
                      </div>
                      {error && <p className="text-[10px] text-red-600">{error}</p>}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono font-bold text-sm text-[#2F3E4E]">{c.code}</span>
                        {c.outcome && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${OUTCOME_STYLE[c.outcome] || 'bg-[#F4F6F5] text-[#7A8F79]'}`}>{c.outcome}</span>
                        )}
                        {!c.active && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Deactivated</span>
                        )}
                        {showAdminTools && (
                          <span className="ml-auto flex items-center gap-2">
                            <button onClick={() => startEdit(c)} className="text-[10px] font-semibold text-[#7A8F79] hover:text-[#2F3E4E]">Edit</button>
                            <button onClick={() => deleteCode(c.code)} className="text-[10px] font-semibold text-red-500 hover:text-red-700">Delete</button>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#2F3E4E] leading-relaxed">{c.description}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
            {showAdminTools && (
              <div className="p-3 border-t border-[#D9E1E8] bg-[#F4F6F5]">
                {!showAddForm ? (
                  <button onClick={() => setShowAddForm(true)} className="w-full rounded-lg py-2 text-sm font-semibold text-white bg-[#2F3E4E] hover:bg-[#7A8F79] transition">
                    + Add Status Code
                  </button>
                ) : (
                  <form onSubmit={submitAdd} className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        required value={addForm.code} onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))}
                        placeholder="Code (e.g. F3)"
                        className="w-24 border border-[#D9E1E8] p-2 rounded-lg text-xs uppercase focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                      />
                      <select
                        value={addForm.outcome}
                        onChange={e => setAddForm(f => ({ ...f, outcome: e.target.value }))}
                        className="flex-1 border border-[#D9E1E8] p-2 rounded-lg text-xs text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                      >
                        <option value="">No outcome</option>
                        <option value="Pay">Pay</option>
                        <option value="Deny">Deny</option>
                        <option value="Neutral">Neutral</option>
                      </select>
                    </div>
                    <textarea
                      required value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                      rows={2} placeholder="Description"
                      className="w-full border border-[#D9E1E8] p-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none"
                    />
                    {error && <p className="text-[10px] text-red-600">{error}</p>}
                    <div className="flex gap-2">
                      <button type="submit" disabled={saving} className="flex-1 rounded-lg py-1.5 text-xs font-semibold text-white bg-[#2F3E4E] hover:bg-[#7A8F79] transition disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => { setShowAddForm(false); setError('') }} className="text-xs font-semibold text-[#7A8F79] px-3">Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            )}
            <div className="p-3 border-t border-[#D9E1E8]">
              <button onClick={close} className="w-full rounded-lg py-2 text-sm font-semibold border border-[#D9E1E8] text-[#7A8F79] hover:border-[#7A8F79]">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
