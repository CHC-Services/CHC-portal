'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AdminNav from '../../components/AdminNav'
import { payCycleDateLabel } from '../../../lib/medicaidPayCycle'

type StatusCode = { code: string; description: string }
type Nurse = { id: string; displayName: string }
type MedicaidClaim = {
  id: string
  nurseId: string
  patientCtrlNum: string
  payerCtrlNum: string | null
  dosStart: string
  dosStop: string
  totalCharge: number
  paidAmount: number | null
  processedDate: string | null
  statusCodes: string[]
  estPayCycle: number | null
  notes: string | null
  nurse?: { displayName: string }
}

const BLANK_FORM = {
  nurseId: '',
  patientCtrlNum: '',
  payerCtrlNum: '',
  dosStart: '',
  dosStop: '',
  totalCharge: '',
  paidAmount: '',
  processedDate: '',
  statusCodes: [] as string[],
  estPayCycle: '',
  notes: '',
}

// Anchor stored in system settings; fallback to hardcoded anchor
const ANCHOR_CYCLE = 2540
const ANCHOR_DATE  = '2026-05-14'

function cycleToLabel(cycle: string | number): string {
  const n = typeof cycle === 'string' ? parseInt(cycle) : cycle
  if (!n || isNaN(n)) return ''
  return payCycleDateLabel(n, ANCHOR_CYCLE, ANCHOR_DATE)
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export default function AdminMedicaidPage() {
  const router = useRouter()
  const [nurses, setNurses] = useState<Nurse[]>([])
  const [claims, setClaims] = useState<MedicaidClaim[]>([])
  const [statusCodes, setStatusCodes] = useState<StatusCode[]>([])
  const [loading, setLoading] = useState(true)

  // Claim form
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [codeInput, setCodeInput] = useState('')
  const [codeSuggestions, setCodeSuggestions] = useState<StatusCode[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Filter
  const [filterNurse, setFilterNurse] = useState('')

  // Status code management
  const [tab, setTab] = useState<'claims' | 'codes'>('claims')
  const [newCode, setNewCode] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [codeError, setCodeError] = useState('')
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [editingDesc, setEditingDesc] = useState('')

  const codeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/nurses', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/medicaid/claims', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/medicaid/status-codes', { credentials: 'include' }).then(r => r.json()),
    ]).then(([n, c, s]) => {
      if (Array.isArray(n)) setNurses(n)
      if (Array.isArray(c)) setClaims(c)
      if (Array.isArray(s)) setStatusCodes(s)
      setLoading(false)
    }).catch(() => { router.push('/login') })
  }, [router])

  // ── Code autocomplete ─────────────────────────────────────────────────────
  function onCodeInput(val: string) {
    setCodeInput(val)
    if (!val.trim()) { setCodeSuggestions([]); return }
    const q = val.trim().toUpperCase()
    setCodeSuggestions(statusCodes.filter(s =>
      s.code.toUpperCase().startsWith(q) || s.description.toLowerCase().includes(val.toLowerCase())
    ).slice(0, 6))
  }

  function addCode(code: string) {
    const upper = code.trim().toUpperCase()
    if (!upper || form.statusCodes.includes(upper)) { setCodeInput(''); setCodeSuggestions([]); return }
    setForm(f => ({ ...f, statusCodes: [...f.statusCodes, upper] }))
    setCodeInput('')
    setCodeSuggestions([])
    codeInputRef.current?.focus()
  }

  function removeCode(code: string) {
    setForm(f => ({ ...f, statusCodes: f.statusCodes.filter(c => c !== code) }))
  }

  // ── Claim submit ──────────────────────────────────────────────────────────
  async function submitClaim(e: React.FormEvent) {
    e.preventDefault()
    setFormError(''); setFormSuccess('')
    if (!form.nurseId) { setFormError('Select a provider.'); return }
    if (!form.patientCtrlNum.trim()) { setFormError('Patient Ctrl # is required.'); return }
    if (!form.dosStart || !form.dosStop) { setFormError('DOS Start and Stop are required.'); return }
    if (!form.totalCharge) { setFormError('Total Charge is required.'); return }

    setSubmitting(true)
    const url = editingId ? `/api/admin/medicaid/claims/${editingId}` : '/api/admin/medicaid/claims'
    const method = editingId ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...form,
        estPayCycle: form.estPayCycle ? parseInt(form.estPayCycle) : null,
        totalCharge: parseFloat(form.totalCharge),
        paidAmount: form.paidAmount ? parseFloat(form.paidAmount) : null,
      }),
    })
    setSubmitting(false)

    if (res.ok) {
      setFormSuccess(editingId ? 'Claim updated.' : 'Claim added.')
      setForm({ ...BLANK_FORM })
      setEditingId(null)
      const updated = await fetch('/api/admin/medicaid/claims', { credentials: 'include' }).then(r => r.json())
      if (Array.isArray(updated)) setClaims(updated)
    } else {
      const data = await res.json()
      setFormError(data.error || 'Save failed.')
    }
  }

  function startEdit(claim: MedicaidClaim) {
    setEditingId(claim.id)
    setForm({
      nurseId:       claim.nurseId,
      patientCtrlNum: claim.patientCtrlNum,
      payerCtrlNum:  claim.payerCtrlNum || '',
      dosStart:      claim.dosStart.slice(0, 10),
      dosStop:       claim.dosStop.slice(0, 10),
      totalCharge:   String(claim.totalCharge),
      paidAmount:    claim.paidAmount != null ? String(claim.paidAmount) : '',
      processedDate: claim.processedDate ? claim.processedDate.slice(0, 10) : '',
      statusCodes:   claim.statusCodes,
      estPayCycle:   claim.estPayCycle != null ? String(claim.estPayCycle) : '',
      notes:         claim.notes || '',
    })
    setFormError(''); setFormSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteClaim(id: string) {
    if (!confirm('Delete this Medicaid claim?')) return
    await fetch(`/api/admin/medicaid/claims/${id}`, { method: 'DELETE', credentials: 'include' })
    setClaims(c => c.filter(x => x.id !== id))
  }

  // ── Status code management ────────────────────────────────────────────────
  async function addStatusCode(e: React.FormEvent) {
    e.preventDefault()
    setCodeError('')
    const res = await fetch('/api/admin/medicaid/status-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code: newCode, description: newDesc }),
    })
    if (res.ok) {
      const record = await res.json()
      setStatusCodes(c => [...c, record].sort((a, b) => a.code.localeCompare(b.code)))
      setNewCode(''); setNewDesc('')
    } else {
      const data = await res.json()
      setCodeError(data.error || 'Failed to add code.')
    }
  }

  async function saveCodeEdit(code: string) {
    const res = await fetch(`/api/admin/medicaid/status-codes/${code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ description: editingDesc }),
    })
    if (res.ok) {
      setStatusCodes(c => c.map(s => s.code === code ? { ...s, description: editingDesc } : s))
      setEditingCode(null)
    }
  }

  async function deleteStatusCode(code: string) {
    if (!confirm(`Delete status code ${code}?`)) return
    await fetch(`/api/admin/medicaid/status-codes/${code}`, { method: 'DELETE', credentials: 'include' })
    setStatusCodes(c => c.filter(s => s.code !== code))
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const filtered = filterNurse ? claims.filter(c => c.nurseId === filterNurse) : claims
  const totalCharge = filtered.reduce((s, c) => s + c.totalCharge, 0)
  const totalPaid   = filtered.reduce((s, c) => s + (c.paidAmount ?? 0), 0)
  const pendingCount = filtered.filter(c => !c.statusCodes.some(sc => ['F1', 'F2'].includes(sc))).length

  function codeLabel(code: string) {
    return statusCodes.find(s => s.code === code)?.description || code
  }

  if (loading) return <div className="min-h-screen bg-[#D9E1E8] flex items-center justify-center text-[#7A8F79]">Loading…</div>

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        <div className="mb-2">
          <AdminNav />
          <h1 className="text-3xl font-bold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">ad</span>Medicaid
          </h1>
          <p className="text-sm text-[#7A8F79] mt-1">Medicaid claim tracking — manually entered per submission</p>
        </div>

        {/* ── Stats bar ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Charged', value: `$${totalCharge.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
            { label: 'Total Paid',    value: `$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
            { label: 'Pending',       value: `${pendingCount} claim${pendingCount !== 1 ? 's' : ''}` },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm p-4 text-center">
              <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">{s.label}</p>
              <p className="text-2xl font-bold text-[#2F3E4E] mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex gap-2">
          {(['claims', 'codes'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${tab === t ? 'bg-[#2F3E4E] text-white' : 'bg-white text-[#2F3E4E] border border-[#D9E1E8] hover:border-[#7A8F79]'}`}
            >
              {t === 'claims' ? 'Claims' : 'Status Codes'}
            </button>
          ))}
        </div>

        {tab === 'claims' && (
          <>
            {/* ── Claim entry form ────────────────────────────────────── */}
            <form onSubmit={submitClaim}>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="bg-[#2F3E4E] px-6 py-4">
                  <h2 className="text-base font-bold text-white">{editingId ? 'Edit Claim' : 'Add New Claim'}</h2>
                  <p className="text-xs text-[#D9E1E8] mt-0.5">Enter Medicaid claim details from your submission confirmation.</p>
                </div>

                <div className="p-6 space-y-5">

                  {/* Provider */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Provider</label>
                      <select
                        value={form.nurseId}
                        onChange={e => setForm(f => ({ ...f, nurseId: e.target.value }))}
                        required
                        className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] bg-white focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                      >
                        <option value="">— Select provider —</option>
                        {nurses.filter((n: any) => !n.isDemo).map(n => (
                          <option key={n.id} value={n.id}>{n.displayName}</option>
                        ))}
                      </select>
                    </div>

                    {/* Control numbers */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Patient Ctrl #</label>
                        <input
                          type="text" value={form.patientCtrlNum}
                          onChange={e => setForm(f => ({ ...f, patientCtrlNum: e.target.value }))}
                          placeholder="e.g. 123456789"
                          className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Payer Ctrl #</label>
                        <input
                          type="text" value={form.payerCtrlNum}
                          onChange={e => setForm(f => ({ ...f, payerCtrlNum: e.target.value }))}
                          placeholder="Optional"
                          className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* DOS + Amounts */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">DOS Start</label>
                      <input type="date" value={form.dosStart} onChange={e => setForm(f => ({ ...f, dosStart: e.target.value }))}
                        className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">DOS Stop</label>
                      <input type="date" value={form.dosStop} onChange={e => setForm(f => ({ ...f, dosStop: e.target.value }))}
                        className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Total Charge</label>
                      <input type="number" step="0.01" min="0" value={form.totalCharge}
                        onChange={e => setForm(f => ({ ...f, totalCharge: e.target.value }))}
                        placeholder="0.00"
                        className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Paid Amount</label>
                      <input type="number" step="0.01" min="0" value={form.paidAmount}
                        onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                    </div>
                  </div>

                  {/* Processed date + Pay cycle */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Processed Date</label>
                      <input type="date" value={form.processedDate}
                        onChange={e => setForm(f => ({ ...f, processedDate: e.target.value }))}
                        className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Est Pay Cycle</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number" value={form.estPayCycle}
                          onChange={e => setForm(f => ({ ...f, estPayCycle: e.target.value }))}
                          placeholder="e.g. 2541"
                          className="w-32 border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                        />
                        {form.estPayCycle && (
                          <span className="text-sm font-semibold text-[#7A8F79]">
                            → {cycleToLabel(form.estPayCycle)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#7A8F79] mt-1">Cycle number auto-resolves to payment week date</p>
                    </div>
                  </div>

                  {/* Status codes */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Claim Status Codes</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {form.statusCodes.map(code => (
                        <span key={code} className="flex items-center gap-1.5 bg-[#2F3E4E] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                          {code}
                          <button type="button" onClick={() => removeCode(code)} className="text-[#D9E1E8] hover:text-white leading-none text-base">×</button>
                        </span>
                      ))}
                    </div>
                    <div className="relative">
                      <input
                        ref={codeInputRef}
                        type="text"
                        value={codeInput}
                        onChange={e => onCodeInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (codeInput.trim()) addCode(codeInput) } }}
                        placeholder="Type a code and press Enter (e.g. F1, A3)"
                        className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                      />
                      {codeSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-[#D9E1E8] rounded-lg shadow-lg z-20 mt-1 overflow-hidden">
                          {codeSuggestions.map(s => (
                            <button
                              key={s.code}
                              type="button"
                              onClick={() => addCode(s.code)}
                              className="w-full text-left px-4 py-2.5 hover:bg-[#f4f6f5] transition border-b border-[#D9E1E8] last:border-0"
                            >
                              <span className="text-xs font-bold text-[#2F3E4E]">{s.code}</span>
                              <span className="text-xs text-[#7A8F79] ml-2">{s.description}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Notes</label>
                    <textarea
                      value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2} placeholder="Optional internal notes"
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none"
                    />
                  </div>

                  {formError && <p className="text-sm text-red-500 font-medium">{formError}</p>}
                  {formSuccess && <p className="text-sm text-green-600 font-semibold">✓ {formSuccess}</p>}

                  <div className="flex items-center gap-3">
                    <button
                      type="submit" disabled={submitting}
                      className="bg-[#2F3E4E] text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-[#7A8F79] transition disabled:opacity-50 text-sm"
                    >
                      {submitting ? 'Saving…' : editingId ? 'Update Claim' : 'Add Claim'}
                    </button>
                    {editingId && (
                      <button type="button" onClick={() => { setEditingId(null); setForm({ ...BLANK_FORM }); setFormError(''); setFormSuccess('') }}
                        className="px-5 py-2.5 rounded-xl border border-[#D9E1E8] text-sm font-semibold text-[#7A8F79] hover:border-[#7A8F79] transition">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </form>

            {/* ── Claims table ──────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-[#2F3E4E] px-6 py-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-white">Submitted Claims</h2>
                <select
                  value={filterNurse} onChange={e => setFilterNurse(e.target.value)}
                  className="border border-[#4a5a6a] bg-[#3d4f5e] text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                >
                  <option value="">All Providers</option>
                  {nurses.map(n => <option key={n.id} value={n.id}>{n.displayName}</option>)}
                </select>
              </div>

              {filtered.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#7A8F79]">No claims yet. Add one above.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#f4f6f5] border-b border-[#D9E1E8]">
                        {['Provider', 'Patient Ctrl #', 'Payer Ctrl #', 'DOS', 'Charged', 'Paid', 'Processed', 'Pay Cycle', 'Status Codes', ''].map(h => (
                          <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-[#7A8F79] whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9E1E8]">
                      {filtered.map(claim => (
                        <tr key={claim.id} className="hover:bg-[#fafbfa] transition">
                          <td className="px-3 py-3 text-xs font-semibold text-[#2F3E4E] whitespace-nowrap">{claim.nurse?.displayName ?? nurses.find(n => n.id === claim.nurseId)?.displayName ?? '—'}</td>
                          <td className="px-3 py-3 text-xs font-mono text-[#2F3E4E]">{claim.patientCtrlNum}</td>
                          <td className="px-3 py-3 text-xs font-mono text-[#7A8F79]">{claim.payerCtrlNum || '—'}</td>
                          <td className="px-3 py-3 text-xs text-[#7A8F79] whitespace-nowrap">
                            {fmt(claim.dosStart)} – {fmt(claim.dosStop)}
                          </td>
                          <td className="px-3 py-3 text-xs font-semibold text-[#2F3E4E]">${claim.totalCharge.toFixed(2)}</td>
                          <td className="px-3 py-3 text-xs font-semibold text-green-700">{claim.paidAmount != null ? `$${claim.paidAmount.toFixed(2)}` : '—'}</td>
                          <td className="px-3 py-3 text-xs text-[#7A8F79] whitespace-nowrap">{claim.processedDate ? fmt(claim.processedDate) : '—'}</td>
                          <td className="px-3 py-3 text-xs whitespace-nowrap">
                            {claim.estPayCycle ? (
                              <span className="font-semibold text-[#2F3E4E]">{claim.estPayCycle} <span className="text-[#7A8F79] font-normal">({cycleToLabel(claim.estPayCycle)})</span></span>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              {claim.statusCodes.map(code => (
                                <span key={code} title={codeLabel(code)} className="bg-[#2F3E4E] text-white text-[10px] font-bold px-2 py-0.5 rounded-full cursor-help">
                                  {code}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => startEdit(claim)} className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] font-semibold transition">Edit</button>
                              <button onClick={() => deleteClaim(claim.id)} className="text-xs text-red-400 hover:text-red-600 font-semibold transition">Del</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'codes' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-[#2F3E4E] px-6 py-4">
              <h2 className="text-base font-bold text-white">Claim Status Code Library</h2>
              <p className="text-xs text-[#D9E1E8] mt-0.5">Codes auto-suggest when entering claims. Add or remove as needed.</p>
            </div>

            {/* Add new code */}
            <form onSubmit={addStatusCode} className="p-5 border-b border-[#D9E1E8]">
              <div className="flex gap-3 items-end">
                <div className="w-28">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Code</label>
                  <input type="text" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())}
                    placeholder="e.g. F3"
                    className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Description</label>
                  <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                    placeholder="Full description text"
                    className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] placeholder-[#7A8F79]/50 focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                </div>
                <button type="submit"
                  className="bg-[#2F3E4E] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#7A8F79] transition whitespace-nowrap">
                  Add Code
                </button>
              </div>
              {codeError && <p className="mt-2 text-xs text-red-500 font-semibold">{codeError}</p>}
            </form>

            {/* Code list */}
            <div className="divide-y divide-[#D9E1E8]">
              {statusCodes.map(s => (
                <div key={s.code} className="px-5 py-3 flex items-start gap-4 hover:bg-[#fafbfa] transition">
                  <span className="w-14 shrink-0 text-sm font-bold text-[#2F3E4E] mt-0.5">{s.code}</span>
                  {editingCode === s.code ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        value={editingDesc}
                        onChange={e => setEditingDesc(e.target.value)}
                        className="flex-1 border border-[#D9E1E8] rounded-lg px-3 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                      />
                      <button onClick={() => saveCodeEdit(s.code)} className="text-xs font-semibold text-green-600 hover:text-green-800 transition">Save</button>
                      <button onClick={() => setEditingCode(null)} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <p className="flex-1 text-sm text-[#7A8F79]">{s.description}</p>
                      <div className="flex items-center gap-3 shrink-0">
                        <button onClick={() => { setEditingCode(s.code); setEditingDesc(s.description) }}
                          className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] font-semibold transition">Edit</button>
                        <button onClick={() => deleteStatusCode(s.code)}
                          className="text-xs text-red-400 hover:text-red-600 font-semibold transition">Remove</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
