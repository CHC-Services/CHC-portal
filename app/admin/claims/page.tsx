'use client'

import React, { useState, useEffect, useRef, Fragment, useMemo } from 'react'
import AdminNav from '../../components/AdminNav'
import { payCycleDateLabel } from '../../../lib/medicaidPayCycle'

// 3-segment MM / DD / YYYY date input.
// Auto-advances: MM→DD on 2 digits, DD→YYYY on 2 digits, YYYY→nextRef on 4 digits.
// Backspace on empty segment retreats to previous segment.
// "/" on MM or DD also advances (with zero-padding).
const SmartDateInput = React.forwardRef<
  HTMLInputElement,
  {
    value: string
    onChange: (val: string) => void
    nextRef?: React.RefObject<HTMLInputElement | null>
    className?: string
  }
>(({ onChange, nextRef }, ref) => {
  const [mm, setMm] = useState('')
  const [dd, setDd] = useState('')
  const [yyyy, setYyyy] = useState('')
  const mmRef  = useRef<HTMLInputElement>(null)
  const ddRef  = useRef<HTMLInputElement>(null)
  const yyyyRef = useRef<HTMLInputElement>(null)

  React.useImperativeHandle(ref, () => mmRef.current!)

  function emit(m: string, d: string, y: string) {
    onChange(m.length === 2 && d.length === 2 && y.length === 4 ? `${y}-${m}-${d}` : '')
  }

  const seg = 'w-full text-center border border-[#D9E1E8] rounded px-1 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'

  return (
    <div className="flex items-center gap-1">
      {/* Month */}
      <input
        ref={mmRef}
        type="text" inputMode="numeric" maxLength={2} placeholder="MM"
        value={mm}
        className={`w-10 ${seg}`}
        onChange={e => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 2)
          setMm(v); emit(v, dd, yyyy)
          if (v.length === 2) ddRef.current?.focus()
        }}
        onKeyDown={e => {
          if ((e.key === '/' || e.key === 'Tab') && mm) {
            e.preventDefault()
            const padded = mm.padStart(2, '0'); setMm(padded); emit(padded, dd, yyyy)
            ddRef.current?.focus()
          }
        }}
      />
      <span className="text-[#7A8F79] text-sm select-none">/</span>
      {/* Day */}
      <input
        ref={ddRef}
        type="text" inputMode="numeric" maxLength={2} placeholder="DD"
        value={dd}
        className={`w-10 ${seg}`}
        onChange={e => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 2)
          setDd(v); emit(mm, v, yyyy)
          if (v.length === 2) yyyyRef.current?.focus()
        }}
        onKeyDown={e => {
          if (e.key === 'Backspace' && !dd) { e.preventDefault(); mmRef.current?.focus() }
          if ((e.key === '/' || e.key === 'Tab') && dd) {
            e.preventDefault()
            const padded = dd.padStart(2, '0'); setDd(padded); emit(mm, padded, yyyy)
            yyyyRef.current?.focus()
          }
        }}
      />
      <span className="text-[#7A8F79] text-sm select-none">/</span>
      {/* Year */}
      <input
        ref={yyyyRef}
        type="text" inputMode="numeric" maxLength={4} placeholder="YYYY"
        value={yyyy}
        className={`w-16 ${seg}`}
        onChange={e => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
          setYyyy(v); emit(mm, dd, v)
          if (v.length === 4 && nextRef?.current) {
            setTimeout(() => nextRef.current!.focus(), 10)
          }
        }}
        onKeyDown={e => {
          if (e.key === 'Backspace' && !yyyy) { e.preventDefault(); ddRef.current?.focus() }
        }}
      />
    </div>
  )
})
SmartDateInput.displayName = 'SmartDateInput'

// ─── Types ───────────────────────────────────────────────────────────────────

type EobDoc = {
  id: string
  fileName: string
  claimId: string   // = Claim.id (DB UUID)
  nurseId: string
}

type CommercialClaim = {
  id: string
  nurseId: string
  claimId: string | null
  providerName: string | null
  dosStart: string | null
  dosStop: string | null
  totalBilled: number | null
  claimStage: string | null
  submitDate: string | null
  primaryPayer: string | null
  primaryAllowedAmt: number | null
  primaryPaidAmt: number | null
  primaryPaidDate: string | null
  primaryPaidTo: string | null
  primaryCheckNum: string | null
  secondaryPayer: string | null
  secondaryAllowedAmt: number | null
  secondaryPaidAmt: number | null
  secondaryPaidDate: string | null
  secondaryPaidTo: string | null
  secondaryCheckNum: string | null
  totalReimbursed: number | null
  remainingBalance: number | null
  dateFullyFinalized: string | null
  resubmissionOf: string | null
  processingNotes: string | null
  nurse: { displayName: string; accountNumber: string | null }
}

type MedicaidClaimRow = {
  id: string
  nurseId: string
  patientCtrlNum: string
  payerCtrlNum: string | null
  dosStart: string | null
  dosStop: string | null
  totalCharge: number
  paidAmount: number | null
  processedDate: string | null
  statusCodes: string[]
  estPayCycle: number | null
  notes: string | null
  nurse?: { displayName: string; accountNumber?: string | null }
}

type UnifiedClaim =
  | (CommercialClaim & { _type: 'commercial' })
  | (MedicaidClaimRow & { _type: 'medicaid' })

type AuditLog = {
  id: string
  claimType: string
  commercialId: string | null
  medicaidId: string | null
  snapshot: Record<string, unknown>
  savedAt: string
  savedBy: string
}

type CommercialFormState = {
  claimId: string
  providerName: string
  dosStart: string
  dosStop: string
  totalBilled: string
  claimStage: string
  submitDate: string
  primaryPayer: string
  primaryAllowedAmt: string
  primaryPaidAmt: string
  primaryPaidDate: string
  primaryPaidTo: string
  primaryCheckNum: string
  secondaryPayer: string
  secondaryAllowedAmt: string
  secondaryPaidAmt: string
  secondaryPaidDate: string
  secondaryPaidTo: string
  secondaryCheckNum: string
  totalReimbursed: string
  remainingBalance: string
  dateFullyFinalized: string
  resubmissionOf: string
  processingNotes: string
}

type MedicaidFormState = {
  patientCtrlNum: string
  payerCtrlNum: string
  dosStart: string
  dosStop: string
  totalCharge: string
  paidAmount: string
  processedDate: string
  statusCodes: string[]
  estPayCycle: string
  notes: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(val: number | null, prefix = '') {
  if (val == null) return '—'
  return `${prefix}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function fmtDOS(start: string | null, stop: string | null): string {
  if (!start) return '—'
  const s = new Date(start)
  const e = stop ? new Date(stop) : null
  const mon    = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' })
  const day    = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'UTC', day: 'numeric' })
  const yr     = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric' })
  const monDay = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
  const full   = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
  if (!e) return full(s)
  if (s.getUTCFullYear() !== e.getUTCFullYear()) return `${full(s)}–${full(e)}`
  if (s.getUTCMonth() !== e.getUTCMonth()) return `${monDay(s)}–${monDay(e)}, ${yr(e)}`
  return `${mon(s)} ${day(s)}–${day(e)}, ${yr(s)}`
}

function toDateStr(val: string | null): string {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function isMedicaidPayer(payer: string | null): boolean {
  return !!payer && payer.toLowerCase().includes('medicaid')
}

// ─── Components ──────────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return <span className="text-[#7A8F79] text-xs">—</span>
  const s = stage.toLowerCase()
  const color =
    s === 'paid' || s === 'finalized' ? 'bg-green-100 text-green-800' :
    s === 'denied' || s === 'rejected' ? 'bg-red-100 text-red-800' :
    s === 'pending' ? 'bg-yellow-100 text-yellow-800' :
    s.includes('submitted') || s === 'resubmitted' ? 'bg-blue-100 text-blue-800' :
    s === 'info requested' ? 'bg-orange-100 text-orange-800' :
    s === 'info sent' ? 'bg-orange-50 text-orange-700' :
    s === 'appealed' ? 'bg-purple-100 text-purple-800' :
    'bg-gray-900 text-gray-200'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{stage}</span>
}

// Parse CSV — handles quoted fields containing commas
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  function splitLine(line: string): string[] {
    const result: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    result.push(cur.trim())
    return result
  }

  const headers = splitLine(lines[0]).map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = splitLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
}

type ClaimGroup = { primary: CommercialClaim; originals: CommercialClaim[] }

function groupClaims(claims: CommercialClaim[]): ClaimGroup[] {
  const superseded = new Set(claims.filter(c => c.resubmissionOf).map(c => c.resubmissionOf!))
  const byClaimId = new Map(claims.filter(c => c.claimId).map(c => [c.claimId!, c]))
  const groups: ClaimGroup[] = []
  for (const c of claims) {
    if (superseded.has(c.claimId || '')) continue
    const originals: CommercialClaim[] = []
    let current = c
    const seen = new Set<string>()
    while (current.resubmissionOf && byClaimId.has(current.resubmissionOf) && !seen.has(current.resubmissionOf)) {
      seen.add(current.resubmissionOf)
      const orig = byClaimId.get(current.resubmissionOf)!
      originals.push(orig)
      current = orig
    }
    groups.push({ primary: c, originals })
  }
  return groups
}

function LinkButton({ claim, onLinked }: { claim: CommercialClaim; onLinked: () => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(claim.resubmissionOf || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/admin/claims/${claim.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ resubmissionOf: value.trim() || null })
    })
    setSaving(false)
    setOpen(false)
    onLinked()
  }

  return (
    <div className="inline-block">
      {open ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Original claim ID"
            className="border border-[#D9E1E8] rounded px-2 py-0.5 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
          />
          <button onClick={save} disabled={saving} className="text-xs bg-[#7A8F79] text-white px-2 py-0.5 rounded hover:bg-[#2F3E4E] transition disabled:opacity-50">
            {saving ? '…' : 'Save'}
          </button>
          <button onClick={() => setOpen(false)} className="text-xs text-[#7A8F79] hover:text-[#2F3E4E]">✕</button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          title={claim.resubmissionOf ? `Linked to #${claim.resubmissionOf}` : 'Link as resubmission'}
          className={`text-xs px-2 py-0.5 rounded border transition ${claim.resubmissionOf ? 'border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100' : 'border-[#D9E1E8] text-[#7A8F79] hover:border-[#7A8F79]'}`}
        >
          {claim.resubmissionOf ? `↳ #${claim.resubmissionOf}` : '🔗 Link'}
        </button>
      )}
    </div>
  )
}

// ─── Form Initializers ────────────────────────────────────────────────────────

function initCommercialForm(c: CommercialClaim): CommercialFormState {
  return {
    claimId: c.claimId || '',
    providerName: c.providerName || '',
    dosStart: toDateStr(c.dosStart),
    dosStop: toDateStr(c.dosStop),
    totalBilled: c.totalBilled != null ? String(c.totalBilled) : '',
    claimStage: c.claimStage || '',
    submitDate: toDateStr(c.submitDate),
    primaryPayer: c.primaryPayer || '',
    primaryAllowedAmt: c.primaryAllowedAmt != null ? String(c.primaryAllowedAmt) : '',
    primaryPaidAmt: c.primaryPaidAmt != null ? String(c.primaryPaidAmt) : '',
    primaryPaidDate: toDateStr(c.primaryPaidDate),
    primaryPaidTo: c.primaryPaidTo || '',
    primaryCheckNum: c.primaryCheckNum || '',
    secondaryPayer: c.secondaryPayer || '',
    secondaryAllowedAmt: c.secondaryAllowedAmt != null ? String(c.secondaryAllowedAmt) : '',
    secondaryPaidAmt: c.secondaryPaidAmt != null ? String(c.secondaryPaidAmt) : '',
    secondaryPaidDate: toDateStr(c.secondaryPaidDate),
    secondaryPaidTo: c.secondaryPaidTo || '',
    secondaryCheckNum: c.secondaryCheckNum || '',
    totalReimbursed: c.totalReimbursed != null ? String(c.totalReimbursed) : '',
    remainingBalance: c.remainingBalance != null ? String(c.remainingBalance) : '',
    dateFullyFinalized: toDateStr(c.dateFullyFinalized),
    resubmissionOf: c.resubmissionOf || '',
    processingNotes: c.processingNotes || '',
  }
}

function initMedicaidForm(c: MedicaidClaimRow): MedicaidFormState {
  return {
    patientCtrlNum: c.patientCtrlNum || '',
    payerCtrlNum: c.payerCtrlNum || '',
    dosStart: toDateStr(c.dosStart),
    dosStop: toDateStr(c.dosStop),
    totalCharge: String(c.totalCharge),
    paidAmount: c.paidAmount != null ? String(c.paidAmount) : '',
    processedDate: toDateStr(c.processedDate),
    statusCodes: [...(c.statusCodes || [])],
    estPayCycle: c.estPayCycle != null ? String(c.estPayCycle) : '',
    notes: c.notes || '',
  }
}

// ─── ClaimDetailModal ─────────────────────────────────────────────────────────

function ClaimDetailModal({
  claim,
  eobDocs,
  uploading,
  deletingId,
  medicaidStatusCodes,
  onClose,
  onSaved,
  onEobUpload,
  onEobDelete,
  onReloadClaims,
}: {
  claim: UnifiedClaim
  eobDocs: EobDoc[]
  uploading: boolean
  deletingId: string | null
  medicaidStatusCodes: { code: string; description: string }[]
  onClose: () => void
  onSaved: (updated: UnifiedClaim) => void
  onEobUpload: (file: File) => void
  onEobDelete: (docId: string) => void
  onReloadClaims: () => void
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'eobs' | 'history'>('details')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [mCodeInput, setMCodeInput] = useState('')
  const [mCodeSuggestions, setMCodeSuggestions] = useState<{ code: string; description: string }[]>([])

  const [cForm, setCForm] = useState<CommercialFormState>(() =>
    initCommercialForm(claim as CommercialClaim)
  )
  const [mForm, setMForm] = useState<MedicaidFormState>(() =>
    initMedicaidForm(claim as MedicaidClaimRow)
  )
  const [originalJSON] = useState(() =>
    claim._type === 'commercial'
      ? JSON.stringify(initCommercialForm(claim as CommercialClaim))
      : JSON.stringify(initMedicaidForm(claim as MedicaidClaimRow))
  )

  async function handleClose() {
    if (saveStatus === 'saving') return
    const changed = claim._type === 'commercial'
      ? JSON.stringify(cForm) !== originalJSON
      : JSON.stringify(mForm) !== originalJSON
    if (changed) {
      setSaveStatus('saving')
      try {
        if (claim._type === 'commercial') {
          const res = await fetch(`/api/admin/claims/${claim.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              claimId: cForm.claimId || null,
              providerName: cForm.providerName || null,
              dosStart: cForm.dosStart || null,
              dosStop: cForm.dosStop || null,
              totalBilled: cForm.totalBilled || null,
              claimStage: cForm.claimStage || null,
              submitDate: cForm.submitDate || null,
              primaryPayer: cForm.primaryPayer || null,
              primaryAllowedAmt: cForm.primaryAllowedAmt || null,
              primaryPaidAmt: cForm.primaryPaidAmt || null,
              primaryPaidDate: cForm.primaryPaidDate || null,
              primaryPaidTo: cForm.primaryPaidTo || null,
              primaryCheckNum: cForm.primaryCheckNum || null,
              secondaryPayer: cForm.secondaryPayer || null,
              secondaryAllowedAmt: cForm.secondaryAllowedAmt || null,
              secondaryPaidAmt: cForm.secondaryPaidAmt || null,
              secondaryPaidDate: cForm.secondaryPaidDate || null,
              secondaryPaidTo: cForm.secondaryPaidTo || null,
              secondaryCheckNum: cForm.secondaryCheckNum || null,
              totalReimbursed: cForm.totalReimbursed || null,
              remainingBalance: cForm.remainingBalance || null,
              dateFullyFinalized: cForm.dateFullyFinalized || null,
              resubmissionOf: cForm.resubmissionOf || null,
              processingNotes: cForm.processingNotes || null,
            }),
          })
          if (res.ok) {
            setSaveStatus('saved')
            onSaved({ ...claim, ...cForm } as unknown as UnifiedClaim)
          } else {
            setSaveStatus('error')
          }
        } else {
          const res = await fetch(`/api/admin/medicaid/claims/${claim.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              patientCtrlNum: mForm.patientCtrlNum,
              payerCtrlNum: mForm.payerCtrlNum || null,
              dosStart: mForm.dosStart || null,
              dosStop: mForm.dosStop || null,
              totalCharge: mForm.totalCharge,
              paidAmount: mForm.paidAmount || null,
              processedDate: mForm.processedDate || null,
              statusCodes: mForm.statusCodes,
              estPayCycle: mForm.estPayCycle || null,
              notes: mForm.notes || null,
            }),
          })
          if (res.ok) {
            setSaveStatus('saved')
            onSaved({ ...claim, ...mForm, statusCodes: mForm.statusCodes } as unknown as UnifiedClaim)
          } else {
            setSaveStatus('error')
          }
        }
      } catch {
        setSaveStatus('error')
      }
    }
    onClose()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [cForm, mForm, originalJSON, saveStatus])

  useEffect(() => {
    if (activeTab !== 'history') return
    setAuditLoading(true)
    const param = claim._type === 'commercial' ? `commercialId=${claim.id}` : `medicaidId=${claim.id}`
    fetch(`/api/admin/claims/audit?${param}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAuditLogs(data) })
      .catch(() => {})
      .finally(() => setAuditLoading(false))
  }, [activeTab])

  function handleMCodeInput(val: string) {
    setMCodeInput(val)
    if (!val.trim()) { setMCodeSuggestions([]); return }
    const q = val.toLowerCase()
    setMCodeSuggestions(medicaidStatusCodes.filter(c =>
      c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    ).slice(0, 6))
  }

  function addMCode(code: string) {
    if (!mForm.statusCodes.includes(code)) setMForm(f => ({ ...f, statusCodes: [...f.statusCodes, code] }))
    setMCodeInput('')
    setMCodeSuggestions([])
  }

  function removeMCode(code: string) {
    setMForm(f => ({ ...f, statusCodes: f.statusCodes.filter(c => c !== code) }))
  }

  const inp = 'w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'
  const lbl = 'block text-xs font-semibold text-[#2F3E4E] mb-1'
  const sec = 'text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3 border-t border-[#D9E1E8] pt-4'

  const isMed = claim._type === 'commercial' && isMedicaidPayer(cForm.primaryPayer)

  const tabs: Array<'details' | 'eobs' | 'history'> = [
    'details',
    ...(claim._type === 'commercial' ? ['eobs' as const] : []),
    'history',
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9E1E8]">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-bold text-[#2F3E4E]">
              {claim._type === 'commercial'
                ? (cForm.providerName || claim.providerName || 'Claim')
                : (claim.nurse?.displayName || 'Medicaid Claim')}
            </h2>
            {claim._type === 'medicaid' && (
              <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">Medicaid</span>
            )}
            {saveStatus === 'saving' && <span className="text-xs text-[#7A8F79] animate-pulse">Saving…</span>}
            {saveStatus === 'saved' && <span className="text-xs text-green-600">✓ Saved</span>}
            {saveStatus === 'error' && <span className="text-xs text-red-500">Error saving</span>}
          </div>
          <button onClick={handleClose} className="text-[#7A8F79] hover:text-[#2F3E4E] text-xl leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#D9E1E8]">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-xs font-semibold transition ${activeTab === tab ? 'border-b-2 border-[#2F3E4E] text-[#2F3E4E]' : 'text-[#7A8F79] hover:text-[#2F3E4E]'}`}
            >
              {tab === 'details' ? 'Details' : tab === 'eobs' ? `EOBs${eobDocs.length > 0 ? ` (${eobDocs.length})` : ''}` : 'History'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">

          {/* ── Details: Commercial ── */}
          {activeTab === 'details' && claim._type === 'commercial' && (
            <div className="space-y-6">
              <div>
                <p className={sec}>Claim Info</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={lbl}>{isMed ? 'Patient Ctrl #' : 'Claim ID'}</label>
                    <input className={inp} value={cForm.claimId} onChange={e => setCForm(f => ({ ...f, claimId: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Claim Stage</label>
                    <select className={inp} value={cForm.claimStage} onChange={e => setCForm(f => ({ ...f, claimStage: e.target.value }))}>
                      <option value="">—</option>
                      {['Draft','INS-1 Submitted','Resubmitted','Pending','Info Requested','Info Sent','INS-2 Submitted','Appealed','Paid','Denied','Rejected'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Submit Date</label>
                    <input type="date" className={inp} value={cForm.submitDate} onChange={e => setCForm(f => ({ ...f, submitDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>DOS Start</label>
                    <input type="date" className={inp} value={cForm.dosStart} onChange={e => setCForm(f => ({ ...f, dosStart: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>DOS Stop</label>
                    <input type="date" className={inp} value={cForm.dosStop} onChange={e => setCForm(f => ({ ...f, dosStop: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Total Billed</label>
                    <input type="number" step="0.01" className={inp} value={cForm.totalBilled} onChange={e => setCForm(f => ({ ...f, totalBilled: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sec}>Primary Insurance</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className={lbl}>Payer</label>
                    <input className={inp} value={cForm.primaryPayer} onChange={e => setCForm(f => ({ ...f, primaryPayer: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Allowed Amt</label>
                    <input type="number" step="0.01" className={inp} value={cForm.primaryAllowedAmt} onChange={e => setCForm(f => ({ ...f, primaryAllowedAmt: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Paid Amt</label>
                    <input type="number" step="0.01" className={inp} value={cForm.primaryPaidAmt} onChange={e => setCForm(f => ({ ...f, primaryPaidAmt: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Paid Date</label>
                    <input type="date" className={inp} value={cForm.primaryPaidDate} onChange={e => setCForm(f => ({ ...f, primaryPaidDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Paid To</label>
                    <input className={inp} value={cForm.primaryPaidTo} onChange={e => setCForm(f => ({ ...f, primaryPaidTo: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>{isMed ? 'Payer Claim #' : 'Check #'}</label>
                    <input className={inp} value={cForm.primaryCheckNum} onChange={e => setCForm(f => ({ ...f, primaryCheckNum: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sec}>Secondary Insurance</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className={lbl}>Payer</label>
                    <input className={inp} value={cForm.secondaryPayer} onChange={e => setCForm(f => ({ ...f, secondaryPayer: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Allowed Amt</label>
                    <input type="number" step="0.01" className={inp} value={cForm.secondaryAllowedAmt} onChange={e => setCForm(f => ({ ...f, secondaryAllowedAmt: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Paid Amt</label>
                    <input type="number" step="0.01" className={inp} value={cForm.secondaryPaidAmt} onChange={e => setCForm(f => ({ ...f, secondaryPaidAmt: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Paid Date</label>
                    <input type="date" className={inp} value={cForm.secondaryPaidDate} onChange={e => setCForm(f => ({ ...f, secondaryPaidDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Paid To</label>
                    <input className={inp} value={cForm.secondaryPaidTo} onChange={e => setCForm(f => ({ ...f, secondaryPaidTo: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Check #</label>
                    <input className={inp} value={cForm.secondaryCheckNum} onChange={e => setCForm(f => ({ ...f, secondaryCheckNum: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sec}>Summary</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={lbl}>Total Reimbursed</label>
                    <input type="number" step="0.01" className={inp} value={cForm.totalReimbursed} onChange={e => setCForm(f => ({ ...f, totalReimbursed: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Remaining Balance</label>
                    <input type="number" step="0.01" className={inp} value={cForm.remainingBalance} onChange={e => setCForm(f => ({ ...f, remainingBalance: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Date Fully Finalized</label>
                    <input type="date" className={inp} value={cForm.dateFullyFinalized} onChange={e => setCForm(f => ({ ...f, dateFullyFinalized: e.target.value }))} />
                  </div>
                  <div className="col-span-3">
                    <label className={lbl}>Processing Notes</label>
                    <textarea rows={3} className={`${inp} resize-none`} value={cForm.processingNotes} onChange={e => setCForm(f => ({ ...f, processingNotes: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sec}>Resubmission</p>
                <div className="flex items-center gap-3">
                  <input
                    className={`${inp} max-w-xs`}
                    placeholder="Original claim ID (leave blank if none)"
                    value={cForm.resubmissionOf}
                    onChange={e => setCForm(f => ({ ...f, resubmissionOf: e.target.value }))}
                  />
                  {cForm.resubmissionOf && (
                    <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-semibold">↻ resubmission</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Details: Medicaid ── */}
          {activeTab === 'details' && claim._type === 'medicaid' && (
            <div className="space-y-6">
              <div>
                <p className={sec}>Claim Details</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={lbl}>Patient Ctrl #</label>
                    <input className={inp} value={mForm.patientCtrlNum} onChange={e => setMForm(f => ({ ...f, patientCtrlNum: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Payer Ctrl #</label>
                    <input className={inp} value={mForm.payerCtrlNum} onChange={e => setMForm(f => ({ ...f, payerCtrlNum: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Total Charge</label>
                    <input type="number" step="0.01" className={inp} value={mForm.totalCharge} onChange={e => setMForm(f => ({ ...f, totalCharge: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>DOS Start</label>
                    <input type="date" className={inp} value={mForm.dosStart} onChange={e => setMForm(f => ({ ...f, dosStart: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>DOS Stop</label>
                    <input type="date" className={inp} value={mForm.dosStop} onChange={e => setMForm(f => ({ ...f, dosStop: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Paid Amount</label>
                    <input type="number" step="0.01" className={inp} value={mForm.paidAmount} onChange={e => setMForm(f => ({ ...f, paidAmount: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Processed Date</label>
                    <input type="date" className={inp} value={mForm.processedDate} onChange={e => setMForm(f => ({ ...f, processedDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Est. Pay Cycle #</label>
                    <input type="number" step="1" className={inp} value={mForm.estPayCycle} onChange={e => setMForm(f => ({ ...f, estPayCycle: e.target.value }))} />
                    {mForm.estPayCycle && !isNaN(parseInt(mForm.estPayCycle)) && (
                      <p className="text-xs text-[#7A8F79] mt-1">→ {payCycleDateLabel(parseInt(mForm.estPayCycle))}</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p className={sec}>Status Codes</p>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type code or description…"
                    value={mCodeInput}
                    onChange={e => handleMCodeInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const match = medicaidStatusCodes.find(c => c.code.toLowerCase() === mCodeInput.toLowerCase())
                        if (match) addMCode(match.code)
                        else if (mCodeInput.trim()) addMCode(mCodeInput.trim().toUpperCase())
                      }
                    }}
                    className={inp}
                  />
                  {mCodeSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-[#D9E1E8] rounded-xl shadow-lg overflow-hidden">
                      {mCodeSuggestions.map(c => (
                        <button key={c.code} type="button" onMouseDown={() => addMCode(c.code)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#f4f6f8] transition">
                          <span className="font-semibold text-[#2F3E4E]">{c.code}</span>
                          <span className="text-[#7A8F79] text-xs ml-2 line-clamp-1">{c.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {mForm.statusCodes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {mForm.statusCodes.map(code => (
                      <span key={code} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                        {code}
                        <button type="button" onClick={() => removeMCode(code)} className="text-blue-400 hover:text-blue-700 leading-none ml-0.5">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className={sec}>Notes</p>
                <textarea rows={3} className={`${inp} resize-none`} value={mForm.notes} onChange={e => setMForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          )}

          {/* ── EOBs Tab ── */}
          {activeTab === 'eobs' && claim._type === 'commercial' && (
            <div className="space-y-3">
              {eobDocs.length === 0 && (
                <p className="text-sm text-[#7A8F79]">No EOBs uploaded for this claim.</p>
              )}
              {eobDocs.map(eob => (
                <div key={eob.id} className="flex items-center justify-between border border-[#D9E1E8] rounded-lg px-4 py-3">
                  <span className="text-sm text-[#2F3E4E] font-medium truncate max-w-xs">{eob.fileName}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const win = window.open('', '_blank')
                        try {
                          const res = await fetch(`/api/admin/documents/${eob.id}`, { credentials: 'include' })
                          const data = await res.json()
                          if (data.url && win) { win.location.href = data.url } else { win?.close() }
                        } catch { win?.close() }
                      }}
                      className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-100 transition"
                    >
                      🗂️ View
                    </button>
                    <button
                      onClick={() => onEobDelete(eob.id)}
                      disabled={deletingId === eob.id}
                      className="text-xs text-red-500 hover:text-red-700 border border-red-100 px-2 py-1 rounded-lg transition disabled:opacity-40"
                    >
                      {deletingId === eob.id ? '…' : '✕'}
                    </button>
                  </div>
                </div>
              ))}
              <label className={`flex items-center gap-2 cursor-pointer text-sm font-semibold border-2 border-dashed border-[#D9E1E8] rounded-lg px-4 py-3 hover:border-[#7A8F79] hover:text-[#2F3E4E] transition text-[#7A8F79] ${uploading ? 'opacity-50 cursor-default' : ''}`}>
                <span>📎 {uploading ? 'Uploading…' : 'Upload EOB'}</span>
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
                  onChange={e => { const f = e.target.files?.[0]; if (f) onEobUpload(f); e.target.value = '' }}
                />
              </label>
            </div>
          )}

          {/* ── History Tab ── */}
          {activeTab === 'history' && (
            <div>
              {auditLoading ? (
                <p className="text-sm text-[#7A8F79] animate-pulse">Loading…</p>
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-[#7A8F79]">No history yet.</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map(log => {
                    const snap = log.snapshot as Record<string, unknown>
                    const savedAt = new Date(log.savedAt).toLocaleString('en-US', {
                      timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                    })
                    return (
                      <div key={log.id} className="border border-[#D9E1E8] rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-[#7A8F79]">{savedAt}</span>
                          {log.savedBy && <span className="text-xs text-[#7A8F79]">{log.savedBy}</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-[#2F3E4E]">
                          {!!snap.dosStart && (
                            <span><span className="text-[#7A8F79]">DOS:</span> {fmtDOS(String(snap.dosStart), snap.dosStop ? String(snap.dosStop) : null)}</span>
                          )}
                          {!!(snap.claimStage || snap.statusCodes) && (
                            <span className="flex items-center gap-1">
                              <span className="text-[#7A8F79]">Status:</span>
                              {snap.claimStage
                                ? <StageBadge stage={String(snap.claimStage)} />
                                : <span>{(snap.statusCodes as string[] || []).join(', ')}</span>}
                            </span>
                          )}
                          {(snap.totalBilled != null || snap.totalCharge != null) && (
                            <span><span className="text-[#7A8F79]">Billed:</span> {fmt((snap.totalBilled ?? snap.totalCharge) as number, '$')}</span>
                          )}
                          {(snap.paidAmount != null || snap.primaryPaidAmt != null) && (
                            <span><span className="text-[#7A8F79]">Paid:</span> {fmt((snap.paidAmount ?? snap.primaryPaidAmt) as number, '$')}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── AdminClaimsPage ──────────────────────────────────────────────────────────

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<CommercialClaim[]>([])
  const [medicaidClaims, setMedicaidClaims] = useState<MedicaidClaimRow[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; error?: string } | null>(null)
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Selected claim for detail modal
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null)
  const [selectedClaimType, setSelectedClaimType] = useState<'commercial' | 'medicaid' | null>(null)

  // Bulk import mode
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkModeLoading, setBulkModeLoading] = useState(false)
  const [bulkFlushMsg, setBulkFlushMsg] = useState<string | null>(null)

  // Follow-up reminders
  type Reminder = { id: string; claimDbId: string; claimRef: string | null; nurseId: string | null; dueDate: string; reason: string; completed: boolean }
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [reminderForm, setReminderForm] = useState({ claimDbId: '', claimRef: '', nurseId: '', dueDate: '', reason: '' })
  const [reminderSaving, setReminderSaving] = useState(false)
  const [reminderError, setReminderError] = useState('')
  const [showReminderList, setShowReminderList] = useState(false)

  // Nurse roster for provider autocomplete
  type NurseOption = { id: string; displayName: string; providerAliases: string[] }
  const [nurses, setNurses] = useState<NurseOption[]>([])

  // Add Claim modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [modalResetKey, setModalResetKey] = useState(0)
  const [addClaimType, setAddClaimType] = useState<'commercial' | 'medicaid'>('commercial')
  const [addForm, setAddForm] = useState<Record<string, string>>({ claimStage: 'Draft' })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Provider autocomplete
  const [providerInput, setProviderInput] = useState('')
  const [providerSuggestions, setProviderSuggestions] = useState<NurseOption[]>([])
  const [selectedNurseId, setSelectedNurseId] = useState<string | null>(null)
  const providerRef = useRef<HTMLDivElement>(null)
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0)

  // Medicaid add form
  const [medicaidForm, setMedicaidForm] = useState<Record<string, string>>({})
  const [medicaidStatusCodes, setMedicaidStatusCodes] = useState<{ code: string; description: string }[]>([])
  const [medicaidSelectedCodes, setMedicaidSelectedCodes] = useState<string[]>([])
  const [medicaidCodeInput, setMedicaidCodeInput] = useState('')
  const [medicaidCodeSuggestions, setMedicaidCodeSuggestions] = useState<{ code: string; description: string }[]>([])

  // Date field refs for auto-advance (commercial)
  const submitDateRef   = useRef<HTMLInputElement>(null)
  const dosStartRef     = useRef<HTMLInputElement>(null)
  const dosStopRef      = useRef<HTMLInputElement>(null)
  const primPaidDateRef = useRef<HTMLInputElement>(null)
  const secPaidDateRef  = useRef<HTMLInputElement>(null)
  const finalDateRef    = useRef<HTMLInputElement>(null)
  // Date field refs for auto-advance (medicaid)
  const mDosStartRef  = useRef<HTMLInputElement>(null)
  const mDosStopRef   = useRef<HTMLInputElement>(null)
  const mProcessedRef = useRef<HTMLInputElement>(null)

  // EDI upload state
  const [ediDragging, setEdiDragging] = useState(false)
  const [ediUploading, setEdiUploading] = useState(false)
  const [ediDryRun, setEdiDryRun] = useState(false)
  const [ediResult, setEdiResult] = useState<{
    summary: { filesUploaded: number; filesParsed: number; filesSkipped: number; claimsFound: number; claimsMatched: number; claimsUnmatched: number }
    matched: { claimId: string; changes: string[] }[]
    unmatched: string[]
    skippedFiles: string[]
    dryRun: boolean
  } | null>(null)

  // EOB state — keyed by Claim.id (DB UUID)
  const [eobMap, setEobMap] = useState<Record<string, EobDoc[]>>({})
  const [eobUploading, setEobUploading] = useState<string | null>(null)
  const [eobDeleting, setEobDeleting] = useState<string | null>(null)
  const [eobError, setEobError] = useState<string | null>(null)

  async function loadEobs() {
    const res = await fetch('/api/admin/documents?all=1&category=EOB', { credentials: 'include' })
    const data = await res.json()
    if (Array.isArray(data.documents)) {
      const map: Record<string, EobDoc[]> = {}
      for (const doc of data.documents) {
        if (doc.claimId) {
          if (!map[doc.claimId]) map[doc.claimId] = []
          map[doc.claimId].push({ id: doc.id, fileName: doc.fileName, claimId: doc.claimId, nurseId: doc.nurseId })
        }
      }
      setEobMap(map)
    }
  }

  async function handleEobUpload(claim: CommercialClaim, file: File) {
    setEobUploading(claim.id)
    setEobError(null)
    try {
      const presignRes = await fetch('/api/admin/documents/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/octet-stream', nurseId: claim.nurseId, category: 'EOB' }),
      })
      const presign = await presignRes.json()
      if (!presignRes.ok) throw new Error(presign.error || 'Presign failed')

      const form = new FormData()
      Object.entries(presign.fields as Record<string, string>).forEach(([k, v]) => form.append(k, v))
      form.append('file', file)
      await fetch(presign.url, { method: 'POST', body: form, mode: 'no-cors' })

      const providerName = claim.providerName || claim.nurse?.displayName || 'Provider'
      const confirmRes = await fetch('/api/admin/documents/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nurseId: claim.nurseId,
          claimId: claim.id,
          title: `EOB — ${claim.claimId || providerName}`,
          storageKey: presign.storageKey,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || null,
          category: 'EOB',
          visibleToNurse: true,
        }),
      })
      const confirmData = await confirmRes.json()
      if (confirmRes.ok && confirmData.ok) {
        await loadEobs()
      } else {
        setEobError(confirmData.error || 'Upload failed — file did not reach storage.')
      }
    } catch (err) {
      console.error('EOB upload error:', err)
      setEobError('Upload failed. Please try again.')
    }
    setEobUploading(null)
  }

  async function deleteEob(docId: string) {
    if (!confirm('Delete this EOB? This cannot be undone.')) return
    setEobDeleting(docId)
    await fetch(`/api/admin/documents/${docId}`, { method: 'DELETE', credentials: 'include' })
    setEobMap(prev => {
      const next: Record<string, EobDoc[]> = {}
      for (const [k, arr] of Object.entries(prev)) {
        const filtered = arr.filter(d => d.id !== docId)
        if (filtered.length > 0) next[k] = filtered
      }
      return next
    })
    setEobDeleting(null)
  }

  async function loadClaims() {
    setLoading(true)
    const res = await fetch('/api/admin/claims', { credentials: 'include' })
    const data = await res.json()
    setClaims(data.claims || [])
    setLoading(false)
  }

  async function loadMedicaidClaims() {
    const res = await fetch('/api/admin/medicaid/claims', { credentials: 'include' })
    const data = await res.json()
    if (Array.isArray(data)) setMedicaidClaims(data)
  }

  async function loadReminders() {
    const res = await fetch('/api/admin/claims/reminders', { credentials: 'include' })
    if (res.ok) setReminders(await res.json())
  }

  async function submitReminder(e: React.FormEvent) {
    e.preventDefault()
    if (!reminderForm.claimDbId || !reminderForm.dueDate || !reminderForm.reason.trim()) {
      setReminderError('Please select a claim, set a date, and enter a reason.')
      return
    }
    setReminderSaving(true)
    setReminderError('')
    const res = await fetch('/api/admin/claims/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(reminderForm),
    })
    setReminderSaving(false)
    if (!res.ok) { setReminderError('Failed to save reminder.'); return }
    const saved = await res.json()
    setReminders(prev => [saved, ...prev])
    setReminderForm({ claimDbId: '', claimRef: '', nurseId: '', dueDate: '', reason: '' })
    setShowReminderModal(false)
  }

  async function toggleReminderComplete(id: string, completed: boolean) {
    const res = await fetch('/api/admin/claims/reminders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, completed }),
    })
    if (res.ok) setReminders(prev => prev.map(r => r.id === id ? { ...r, completed } : r))
  }

  async function deleteReminder(id: string) {
    await fetch('/api/admin/claims/reminders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id }),
    })
    setReminders(prev => prev.filter(r => r.id !== id))
  }

  useEffect(() => {
    fetch('/api/admin/system-settings', { credentials: 'include' })
      .then(r => r.ok ? r.json() : {})
      .then((s: Record<string, string>) => { if (s.bulkImportMode === 'true') setBulkMode(true) })
      .catch(() => {})
    loadClaims()
    loadMedicaidClaims()
    loadEobs()
    loadReminders()
    fetch('/api/admin/nurses', { credentials: 'include' })
      .then(r => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) setNurses(data.map(n => ({ id: n.id, displayName: n.displayName, providerAliases: n.providerAliases || [] })))
      })
      .catch(() => {})
    fetch('/api/admin/medicaid/status-codes', { credentials: 'include' })
      .then(r => r.json())
      .then((data: any[]) => { if (Array.isArray(data)) setMedicaidStatusCodes(data) })
      .catch(() => {})
  }, [])

  async function toggleBulkMode() {
    const next = !bulkMode
    setBulkModeLoading(true)
    setBulkFlushMsg(null)
    await fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: 'bulkImportMode', value: String(next) }),
    })
    if (!next) {
      const res = await fetch('/api/admin/notifications/flush', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.sent > 0) {
        setBulkFlushMsg(`Summary sent to ${data.sent} provider${data.sent !== 1 ? 's' : ''}.`)
      } else if (data.message) {
        setBulkFlushMsg('No pending notifications to send.')
      } else {
        setBulkFlushMsg('Notifications flushed.')
      }
    }
    setBulkMode(next)
    setBulkModeLoading(false)
  }

  function openAddModal() {
    setAddForm({ claimStage: 'Draft' })
    setMedicaidForm({})
    setMedicaidSelectedCodes([])
    setMedicaidCodeInput('')
    setProviderInput('')
    setSelectedNurseId(null)
    setProviderSuggestions([])
    setAddError(null)
    setModalResetKey(k => k + 1)
    setShowAddModal(true)
  }

  function handleProviderInput(val: string) {
    setProviderInput(val)
    setSelectedNurseId(null)
    setActiveSuggestionIdx(0)
    if (!val.trim()) { setProviderSuggestions([]); return }
    const q = val.toLowerCase()
    const matches = nurses.filter(n =>
      n.displayName.toLowerCase().includes(q) ||
      n.providerAliases.some(a => a.toLowerCase().includes(q))
    ).slice(0, 6)
    setProviderSuggestions(matches)
  }

  function selectNurse(nurse: NurseOption) {
    setProviderInput(nurse.displayName)
    setSelectedNurseId(nurse.id)
    setAddForm(f => ({ ...f, providerName: nurse.displayName }))
    setMedicaidForm(f => ({ ...f, nurseId: nurse.id }))
    setProviderSuggestions([])
    setActiveSuggestionIdx(0)
  }

  function handleProviderKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!providerSuggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestionIdx(i => Math.min(i + 1, providerSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestionIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = providerSuggestions[activeSuggestionIdx] ?? providerSuggestions[0]
      if (target) selectNurse(target)
    } else if (e.key === 'Escape') {
      setProviderSuggestions([])
    }
  }

  function handleMedicaidCodeInput(val: string) {
    setMedicaidCodeInput(val)
    if (!val.trim()) { setMedicaidCodeSuggestions([]); return }
    const q = val.toLowerCase()
    const suggestions = medicaidStatusCodes.filter(c =>
      c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    ).slice(0, 6)
    setMedicaidCodeSuggestions(suggestions)
  }

  function addMedicaidCode(code: string) {
    if (!medicaidSelectedCodes.includes(code)) setMedicaidSelectedCodes(prev => [...prev, code])
    setMedicaidCodeInput('')
    setMedicaidCodeSuggestions([])
  }

  async function submitClaim(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)

    if (addClaimType === 'medicaid') {
      if (!selectedNurseId) { setAddError('Please select a provider from the suggestions.'); setAdding(false); return }
      if (!medicaidForm.patientCtrlNum?.trim()) { setAddError('Patient Ctrl # is required.'); setAdding(false); return }
      if (!medicaidForm.dosStart || !medicaidForm.dosStop) { setAddError('DOS Start and Stop are required.'); setAdding(false); return }
      if (!medicaidForm.totalCharge) { setAddError('Total Charge is required.'); setAdding(false); return }
      const payload = {
        nurseId: selectedNurseId,
        patientCtrlNum: medicaidForm.patientCtrlNum,
        payerCtrlNum: medicaidForm.payerCtrlNum || null,
        dosStart: medicaidForm.dosStart,
        dosStop: medicaidForm.dosStop,
        totalCharge: parseFloat(medicaidForm.totalCharge),
        paidAmount: medicaidForm.paidAmount ? parseFloat(medicaidForm.paidAmount) : null,
        processedDate: medicaidForm.processedDate || null,
        statusCodes: medicaidSelectedCodes,
        estPayCycle: medicaidForm.estPayCycle ? parseInt(medicaidForm.estPayCycle) : null,
        notes: medicaidForm.notes || null,
      }
      const res = await fetch('/api/admin/medicaid/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error || 'Failed to create Medicaid claim.'); setAdding(false); return }
      setShowAddModal(false)
      setAdding(false)
      loadMedicaidClaims()
      return
    }

    if (!addForm.providerName?.trim()) { setAddError('Provider name is required.'); setAdding(false); return }
    const res = await fetch('/api/admin/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(addForm),
    })
    const data = await res.json()
    if (!res.ok) { setAddError(data.error || 'Failed to create claim.'); setAdding(false); return }
    setClaims(prev => [data.claim, ...prev])
    setShowAddModal(false)
    setAdding(false)
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)

    const text = await file.text()
    const rows = parseCSV(text)

    const BATCH_SIZE = 10
    let totalCreated = 0
    let totalUpdated = 0
    let totalSkipped = 0
    let batchError: string | null = null
    const allAffectedNurseIds = new Set<string>()

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      try {
        const res = await fetch('/api/admin/claims/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ rows: batch }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          batchError = err.error || `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed (${res.status})`
          break
        }
        const data = await res.json()
        totalCreated += data.created || 0
        totalUpdated += data.updated || 0
        totalSkipped += data.skipped || 0
        ;(data.affectedNurseIds || []).forEach((id: string) => allAffectedNurseIds.add(id))
      } catch {
        batchError = `Network error on batch ${Math.floor(i / BATCH_SIZE) + 1}`
        break
      }
    }

    if (!batchError && allAffectedNurseIds.size > 0 && !bulkMode) {
      await fetch('/api/admin/notifications/flush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nurseIds: [...allAffectedNurseIds] }),
      }).catch(() => {})
    }

    setImportResult(
      batchError
        ? { created: totalCreated, updated: totalUpdated, skipped: totalSkipped, error: batchError }
        : { created: totalCreated, updated: totalUpdated, skipped: totalSkipped }
    )
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
    loadClaims()
  }

  async function handleEdiUpload(files: FileList | File[]) {
    const arr = Array.from(files)
    if (!arr.length) return
    setEdiUploading(true)
    setEdiResult(null)
    const form = new FormData()
    arr.forEach(f => form.append('files', f))
    form.append('dryRun', String(ediDryRun))
    const res = await fetch('/api/admin/edi', { method: 'POST', credentials: 'include', body: form })
    const data = await res.json()
    setEdiResult(data)
    setEdiUploading(false)
    if (!ediDryRun) loadClaims()
  }

  // ── Merged + filtered claims ──────────────────────────────────────────────

  const allClaims: UnifiedClaim[] = useMemo(() => [
    ...claims.map(c => ({ ...c, _type: 'commercial' as const })),
    ...medicaidClaims.map(c => ({ ...c, _type: 'medicaid' as const })),
  ].sort((a, b) => {
    const ad = a.dosStart ? new Date(a.dosStart).getTime() : 0
    const bd = b.dosStart ? new Date(b.dosStart).getTime() : 0
    return bd - ad
  }), [claims, medicaidClaims])

  const filteredAll: UnifiedClaim[] = useMemo(() => {
    return allClaims.filter(uc => {
      const provName = uc._type === 'commercial' ? (uc.providerName || uc.nurse?.displayName || '') : (uc.nurse?.displayName || '')
      const id = uc._type === 'commercial' ? (uc.claimId || '') : uc.patientCtrlNum
      const payer = uc._type === 'commercial' ? (uc.primaryPayer || '') : 'Medicaid'
      const matchSearch = !search ||
        provName.toLowerCase().includes(search.toLowerCase()) ||
        id.toLowerCase().includes(search.toLowerCase()) ||
        payer.toLowerCase().includes(search.toLowerCase())
      const matchStage = !filterStage || (uc._type === 'commercial' ? uc.claimStage === filterStage : false)
      const matchYear = !filterYear || (uc.dosStart ? new Date(uc.dosStart).getUTCFullYear().toString() === filterYear : false)
      return matchSearch && matchStage && matchYear
    })
  }, [allClaims, search, filterStage, filterYear])

  const totalBilled = filteredAll.reduce((s, uc) =>
    s + (uc._type === 'commercial' ? (uc.totalBilled || 0) : uc.totalCharge), 0)
  const totalReimbursed = filteredAll.reduce((s, uc) =>
    s + (uc._type === 'commercial' ? (uc.totalReimbursed || 0) : (uc.paidAmount || 0)), 0)
  const totalBalance = filteredAll.reduce((s, uc) =>
    s + (uc._type === 'commercial' ? (uc.remainingBalance || 0) : Math.max(0, uc.totalCharge - (uc.paidAmount || 0))), 0)

  const stages = [...new Set(claims.map(c => c.claimStage).filter(Boolean))] as string[]

  // Opened claim for detail modal
  const openedClaim = useMemo(() => {
    if (!selectedClaimId || !selectedClaimType) return null
    return allClaims.find(c => c._type === selectedClaimType && c.id === selectedClaimId) || null
  }, [selectedClaimId, selectedClaimType, allClaims])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6">
      <div className="max-w-screen-xl mx-auto">
        <AdminNav />

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#2F3E4E]"><span className="text-[#7A8F79] italic">ad</span>Claims</h1>
            <p className="text-sm text-[#7A8F79] mt-0.5">Import from CSV or manage claims below.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={toggleBulkMode}
              disabled={bulkModeLoading}
              title={bulkMode
                ? 'Bulk Import Mode is ON — individual emails are paused. Click to turn off and send summary emails.'
                : 'Turn on Bulk Import Mode to pause individual alert emails during a large import.'}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition disabled:opacity-60 ${
                bulkMode
                  ? 'bg-amber-500 border-amber-600 text-white hover:bg-amber-600'
                  : 'bg-white border-[#D9E1E8] text-[#7A8F79] hover:border-[#7A8F79] hover:text-[#2F3E4E]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${bulkMode ? 'bg-white' : 'bg-[#D9E1E8]'}`} />
              {bulkModeLoading ? '…' : bulkMode ? 'Bulk Mode ON' : 'Bulk Mode'}
            </button>

            <a
              href="https://essentials.availity.com/static/public/onb/onboarding-ui-apps/availity-fr-ui/#/login"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 border border-[#D9E1E8] bg-white text-[#2F3E4E] px-4 py-2 rounded-lg text-sm font-semibold hover:border-[#7A8F79] hover:text-[#7A8F79] transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Availity
            </a>
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 bg-[#7A8F79] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2F3E4E] transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Claim
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileImport} className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className="cursor-pointer bg-[#2F3E4E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition">
              {importing ? 'Importing…' : 'Import CSV'}
            </label>
          </div>
        </div>

        {/* Bulk mode banner */}
        {bulkMode && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-3 mb-4 flex items-center gap-3">
            <span className="text-amber-700 font-bold text-sm">⏸ Bulk Import Mode is ON</span>
            <span className="text-amber-700 text-sm">Individual claim and document alert emails are paused. Turn off Bulk Mode when your import is complete to send one summary per provider.</span>
          </div>
        )}
        {bulkFlushMsg && !bulkMode && (
          <div className="bg-green-50 border border-green-300 rounded-xl px-5 py-3 mb-4 flex items-center justify-between gap-3">
            <span className="text-green-700 font-semibold text-sm">✓ {bulkFlushMsg}</span>
            <button onClick={() => setBulkFlushMsg(null)} className="text-green-600 text-xs hover:text-green-800">✕</button>
          </div>
        )}

        {/* Import result */}
        {importResult && (
          <div className={`border rounded-xl p-4 mb-4 text-sm flex flex-wrap gap-4 ${importResult.error ? 'bg-red-50 border-red-300 text-red-800' : 'bg-white border-[#7A8F79] text-[#2F3E4E]'}`}>
            <span className="font-semibold">{importResult.error ? '⚠ Partial import' : '✓ Import complete'}</span>
            {importResult.created > 0 && <span className="text-green-700 font-semibold">{importResult.created} created</span>}
            {importResult.updated > 0 && <span className="text-blue-700 font-semibold">{importResult.updated} updated</span>}
            {importResult.skipped > 0 && (
              <span className="text-red-600 font-semibold">{importResult.skipped} skipped — provider name not matched</span>
            )}
            {importResult.error && (
              <span className="text-red-700 font-semibold">Error: {importResult.error}</span>
            )}
          </div>
        )}

        {eobError && (
          <div className="bg-red-50 border border-red-300 rounded-xl px-5 py-3 mb-4 flex items-center justify-between gap-3">
            <span className="text-red-700 font-semibold text-sm">⚠ EOB upload failed: {eobError}</span>
            <button onClick={() => setEobError(null)} className="text-red-500 text-xs hover:text-red-700">✕</button>
          </div>
        )}

        {/* EDI drop zone */}
        <div className="mb-4 bg-white rounded-xl border-2 border-dashed border-[#D9E1E8] overflow-hidden">
          <div className="flex border-b border-[#D9E1E8]">
            <button
              type="button"
              onClick={() => setEdiDryRun(false)}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold transition text-center ${
                !ediDryRun ? 'bg-[#2F3E4E] text-white' : 'text-[#7A8F79] hover:bg-[#F4F6F5]'
              }`}
            >
              ✅ Update live claims
            </button>
            <button
              type="button"
              onClick={() => setEdiDryRun(true)}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold transition text-center border-l border-[#D9E1E8] ${
                ediDryRun ? 'bg-amber-500 text-white' : 'text-[#7A8F79] hover:bg-[#F4F6F5]'
              }`}
            >
              👁 Preview only — email summary, no changes
            </button>
          </div>
          <div
            onDragOver={e => { e.preventDefault(); setEdiDragging(true) }}
            onDragLeave={() => setEdiDragging(false)}
            onDrop={e => { e.preventDefault(); setEdiDragging(false); handleEdiUpload(e.dataTransfer.files) }}
            className={`px-6 py-5 text-center transition cursor-default ${ediDragging ? 'bg-[#f0f4f0]' : ''}`}
          >
            {ediUploading ? (
              <p className="text-sm text-[#7A8F79] font-semibold animate-pulse">
                {ediDryRun ? 'Analyzing files (preview)…' : 'Processing files…'}
              </p>
            ) : (
              <>
                <p className="text-sm font-semibold text-[#2F3E4E]">
                  {ediDryRun
                    ? '👁 Drop EDI files to preview — no claim lines will be changed'
                    : '📂 Drop Availity EDI files here to auto-update claims'}
                </p>
                {ediDryRun && (
                  <p className="text-xs font-semibold text-amber-600 mt-1">
                    Preview mode — results emailed to you, portal unchanged
                  </p>
                )}
                <p className="text-xs text-[#7A8F79] mt-1">
                  Accepts .ebr · .dpr · .ibr files — patient names and payer claim numbers are never read or stored
                </p>
                <p className="text-xs text-[#7A8F79]/60 mt-1">Max upload size: 4.5MB per batch</p>
                <label className="mt-3 inline-block cursor-pointer text-xs font-semibold text-[#7A8F79] underline underline-offset-2 hover:text-[#2F3E4E] transition">
                  or click to select files
                  <input
                    type="file"
                    multiple
                    accept=".ebr,.dpr,.ibr,.ebt,.ibt,.dpt,.99t,.277ibr,.277dpr,.277ebr"
                    className="hidden"
                    onChange={e => e.target.files && handleEdiUpload(e.target.files)}
                  />
                </label>
              </>
            )}
          </div>
        </div>

        {/* EDI results */}
        {ediResult && (
          <div className={`mb-6 rounded-xl shadow-sm p-5 ${ediResult.dryRun ? 'bg-amber-50 border border-amber-200' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-[#2F3E4E]">
                  {ediResult.dryRun ? '👁 EDI Preview Results' : 'EDI Upload Results'}
                </p>
                {ediResult.dryRun && (
                  <span className="text-xs font-bold bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full">
                    NO CHANGES MADE · Summary emailed
                  </span>
                )}
              </div>
              <button onClick={() => setEdiResult(null)} className="text-xs text-[#7A8F79] hover:text-[#2F3E4E]">✕ Dismiss</button>
            </div>
            <div className="flex flex-wrap gap-3 mb-4">
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#D9E1E8] text-[#2F3E4E]">
                {ediResult.summary.filesUploaded} files uploaded
              </span>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#D9E1E8] text-[#2F3E4E]">
                {ediResult.summary.filesParsed} parsed · {ediResult.summary.filesSkipped} skipped
              </span>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#D9E1E8] text-[#2F3E4E]">
                {ediResult.summary.claimsFound} claims found in files
              </span>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${ediResult.dryRun ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                {ediResult.dryRun ? '👁' : '✓'} {ediResult.summary.claimsMatched} {ediResult.dryRun ? 'would be updated' : 'matched & updated'}
              </span>
              {ediResult.summary.claimsUnmatched > 0 && (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-yellow-100 text-yellow-800">
                  ⚠ {ediResult.summary.claimsUnmatched} unmatched
                </span>
              )}
            </div>
            {ediResult.matched.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-2">
                  {ediResult.dryRun ? 'Would Update (preview)' : 'Updated'}
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {ediResult.matched.map(m => (
                    <div key={m.claimId} className="flex items-center gap-3 text-xs">
                      <span className="font-mono font-semibold text-[#2F3E4E]">{m.claimId}</span>
                      <span className="text-[#7A8F79]">{m.changes.join(' · ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {ediResult.unmatched.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700 mb-2">
                  Not found in portal — may need CSV import first
                </p>
                <div className="flex flex-wrap gap-2">
                  {ediResult.unmatched.map(id => (
                    <span key={id} className="font-mono text-xs bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded text-yellow-800">{id}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary strip */}
        <div className="grid grid-cols-4 gap-2 md:gap-4 mb-6">
          <div className="bg-white rounded-xl p-2.5 md:p-4 shadow-sm">
            <p className="text-[9px] md:text-xs uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Total Claims</p>
            <p className="text-base md:text-2xl font-bold text-[#2F3E4E] mt-0.5">{filteredAll.length}</p>
          </div>
          <div className="bg-white rounded-xl p-2.5 md:p-4 shadow-sm">
            <p className="text-[9px] md:text-xs uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Total Billed</p>
            <p className="text-base md:text-2xl font-bold text-[#2F3E4E] mt-0.5 truncate">{fmt(totalBilled, '$')}</p>
          </div>
          <div className="bg-white rounded-xl p-2.5 md:p-4 shadow-sm">
            <p className="text-[9px] md:text-xs uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Total Reimb.</p>
            <p className="text-base md:text-2xl font-bold text-[#7A8F79] mt-0.5 truncate">{fmt(totalReimbursed, '$')}</p>
          </div>
          <div className="bg-white rounded-xl p-2.5 md:p-4 shadow-sm">
            <p className="text-[9px] md:text-xs uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Remaining</p>
            <p className="text-base md:text-2xl font-bold text-red-600 mt-0.5 truncate">{fmt(totalBalance, '$')}</p>
          </div>
        </div>

        {/* Filters + Reminder button */}
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <input
            type="text"
            placeholder="Search provider, claim ID, payer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] w-72"
          />
          <select
            value={filterStage}
            onChange={e => setFilterStage(e.target.value)}
            className="border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
          >
            <option value="">All Stages</option>
            {stages.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
            className="border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
          >
            <option value="">All Years</option>
            {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2">
            {reminders.filter(r => !r.completed).length > 0 && (
              <button
                onClick={() => setShowReminderList(v => !v)}
                className="relative flex items-center gap-1.5 border border-amber-300 bg-amber-50 text-amber-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-amber-100 transition"
              >
                🔔 Follow-ups
                <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                  {reminders.filter(r => !r.completed).length}
                </span>
              </button>
            )}
            <button
              onClick={() => { setReminderForm({ claimDbId: '', claimRef: '', nurseId: '', dueDate: '', reason: '' }); setReminderError(''); setShowReminderModal(true) }}
              className="flex items-center gap-1.5 border border-[#D9E1E8] bg-white text-[#2F3E4E] px-3 py-2 rounded-lg text-sm font-semibold hover:border-[#7A8F79] hover:text-[#7A8F79] transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Set Reminder
            </button>
          </div>
        </div>

        {/* Reminder list panel */}
        {showReminderList && reminders.length > 0 && (
          <div className="mb-4 bg-white rounded-xl border border-[#D9E1E8] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#D9E1E8]">
              <p className="text-sm font-semibold text-[#2F3E4E]">Claim Follow-Up Reminders</p>
              <button onClick={() => setShowReminderList(false)} className="text-[#7A8F79] hover:text-[#2F3E4E] text-xs">✕ Close</button>
            </div>
            <div className="divide-y divide-[#D9E1E8]">
              {reminders.map(r => {
                const due = new Date(r.dueDate)
                const today = new Date(); today.setHours(0,0,0,0)
                const overdue = !r.completed && due < today
                const dueStr = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
                return (
                  <div key={r.id} className={`flex items-start gap-4 px-5 py-3 ${r.completed ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={r.completed}
                      onChange={e => toggleReminderComplete(r.id, e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#7A8F79] cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {r.claimRef && <span className="font-mono text-xs font-bold text-[#2F3E4E] bg-[#F4F6F5] px-2 py-0.5 rounded">{r.claimRef}</span>}
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${overdue ? 'bg-red-100 text-red-700' : r.completed ? 'bg-gray-100 text-gray-400' : 'bg-amber-50 text-amber-700'}`}>
                          {overdue ? '⚠ Overdue · ' : ''}{dueStr}
                        </span>
                      </div>
                      <p className="text-sm text-[#2F3E4E] mt-0.5 leading-snug">{r.reason}</p>
                    </div>
                    <button onClick={() => deleteReminder(r.id)} className="shrink-0 text-[#D9E1E8] hover:text-red-400 transition text-lg leading-none">×</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Claims table */}
        {loading ? (
          <div className="text-center text-[#7A8F79] py-16">Loading…</div>
        ) : allClaims.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-[#7A8F79] shadow-sm">
            No claims yet. Import a CSV to get started.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F4F6F5] text-xs uppercase tracking-widest text-[#7A8F79]">
                <tr>
                  <th className="w-10 px-3 py-3"></th>
                  <th className="w-20 px-3 py-3 text-left">EOB</th>
                  <th className="px-4 py-3 text-left">Provider / ID</th>
                  <th className="w-36 px-4 py-3 text-left">DOS</th>
                  <th className="w-48 px-4 py-3 text-left">Payer / Status</th>
                  <th className="w-36 px-4 py-3 text-right">$ Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E1E8] text-[#2F3E4E]">
                {filteredAll.map(uc => {
                  const eobs = uc._type === 'commercial' ? (eobMap[uc.id] || []) : []
                  const mostRecentEob = eobs[0] ?? null
                  const isOpen = selectedClaimId === uc.id && selectedClaimType === uc._type
                  return (
                    <tr
                      key={`${uc._type}-${uc.id}`}
                      className={`hover:bg-[#F4F6F5] transition ${isOpen ? 'bg-[#EEF2EE]' : ''}`}
                    >
                      {/* ▶ open modal */}
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => {
                            if (isOpen) { setSelectedClaimId(null); setSelectedClaimType(null) }
                            else { setSelectedClaimId(uc.id); setSelectedClaimType(uc._type) }
                          }}
                          className={`text-xs font-bold transition ${isOpen ? 'text-[#2F3E4E]' : 'text-[#7A8F79] hover:text-[#2F3E4E]'}`}
                          title="Open details"
                        >▶</button>
                      </td>

                      {/* EOB column */}
                      <td className="px-3 py-2.5">
                        {uc._type === 'commercial' ? (
                          <div className="flex items-center gap-1">
                            <label className={`cursor-pointer text-xs font-semibold px-1.5 py-0.5 rounded border border-dashed transition whitespace-nowrap ${eobUploading === uc.id ? 'opacity-50 cursor-default text-[#7A8F79] border-[#D9E1E8]' : 'text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79] hover:text-[#2F3E4E]'}`}>
                              {eobUploading === uc.id ? '…' : '📎'}
                              <input
                                type="file"
                                className="hidden"
                                disabled={eobUploading === uc.id}
                                accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
                                onChange={e => {
                                  const f = e.target.files?.[0]
                                  if (f) handleEobUpload(uc as CommercialClaim, f)
                                  e.target.value = ''
                                }}
                              />
                            </label>
                            {mostRecentEob && (
                              <button
                                onClick={async () => {
                                  const win = window.open('', '_blank')
                                  try {
                                    const res = await fetch(`/api/admin/documents/${mostRecentEob.id}`, { credentials: 'include' })
                                    const data = await res.json()
                                    if (data.url && win) { win.location.href = data.url } else { win?.close() }
                                  } catch { win?.close() }
                                }}
                                title={mostRecentEob.fileName}
                                className="text-xs text-green-700 hover:text-green-900 transition"
                              >🗂️</button>
                            )}
                            {eobs.length > 1 && (
                              <span className="text-[10px] text-[#7A8F79]">+{eobs.length - 1}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#7A8F79]">—</span>
                        )}
                      </td>

                      {/* Provider / ID */}
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-[#2F3E4E] leading-tight">
                          {uc._type === 'commercial' ? (uc.providerName || uc.nurse?.displayName || '—') : (uc.nurse?.displayName || '—')}
                        </div>
                        <div className="font-mono text-[11px] text-[#7A8F79] mt-0.5">
                          {uc._type === 'commercial' ? (uc.claimId || '—') : uc.patientCtrlNum}
                          {uc._type === 'commercial' && uc.resubmissionOf && (
                            <span className="ml-1 text-blue-500">↻</span>
                          )}
                        </div>
                      </td>

                      {/* DOS */}
                      <td className="px-4 py-2.5 text-xs text-[#2F3E4E] whitespace-nowrap">
                        {fmtDOS(uc.dosStart, uc.dosStop)}
                      </td>

                      {/* Payer / Status */}
                      <td className="px-4 py-2.5">
                        {uc._type === 'commercial' ? (
                          <div>
                            <div className="text-xs text-[#7A8F79] mb-0.5 truncate max-w-[180px]">{uc.primaryPayer || '—'}</div>
                            <StageBadge stage={uc.claimStage} />
                          </div>
                        ) : (
                          <div>
                            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">Medicaid</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(uc.statusCodes || []).slice(0, 3).map(sc => (
                                <span key={sc} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">{sc}</span>
                              ))}
                              {(uc.statusCodes || []).length > 3 && (
                                <span className="text-[10px] text-[#7A8F79]">+{(uc.statusCodes || []).length - 3}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* $ Summary */}
                      <td className="px-4 py-2.5 text-right text-xs">
                        {uc._type === 'commercial' ? (
                          <>
                            <div className="text-[#2F3E4E] font-semibold">{fmt(uc.totalBilled, '$')}</div>
                            <div className="text-[#7A8F79]">{fmt(uc.primaryPaidAmt, '$')}</div>
                            <div className={`font-semibold ${(uc.remainingBalance || 0) > 0 ? 'text-red-500' : 'text-[#2F3E4E]'}`}>{fmt(uc.remainingBalance, '$')}</div>
                          </>
                        ) : (
                          <>
                            <div className="text-[#2F3E4E] font-semibold">{fmt(uc.totalCharge, '$')}</div>
                            <div className="text-[#7A8F79]">{fmt(uc.paidAmount, '$')}</div>
                            <div className={`font-semibold ${uc.paidAmount != null && uc.totalCharge > uc.paidAmount ? 'text-red-500' : 'text-[#2F3E4E]'}`}>
                              {uc.paidAmount != null ? fmt(uc.totalCharge - uc.paidAmount, '$') : '—'}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Claim Detail Modal */}
      {openedClaim && (
        <ClaimDetailModal
          claim={openedClaim}
          eobDocs={openedClaim._type === 'commercial' ? (eobMap[openedClaim.id] || []) : []}
          uploading={eobUploading === selectedClaimId}
          deletingId={eobDeleting}
          medicaidStatusCodes={medicaidStatusCodes}
          onClose={() => { setSelectedClaimId(null); setSelectedClaimType(null) }}
          onSaved={updated => {
            if (updated._type === 'commercial') {
              setClaims(prev => prev.map(c => c.id === updated.id ? (updated as CommercialClaim) : c))
            } else {
              setMedicaidClaims(prev => prev.map(c => c.id === updated.id ? (updated as MedicaidClaimRow) : c))
            }
          }}
          onEobUpload={file => handleEobUpload(openedClaim as CommercialClaim, file)}
          onEobDelete={deleteEob}
          onReloadClaims={loadClaims}
        />
      )}

      {/* Add Claim Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9E1E8]">
              <h2 className="text-lg font-bold text-[#2F3E4E]">Add Claim Manually</h2>
              <button onClick={() => setShowAddModal(false)} className="text-[#7A8F79] hover:text-[#2F3E4E] text-xl leading-none">✕</button>
            </div>

            <div className="flex border-b border-[#D9E1E8]">
              <button
                type="button"
                onClick={() => setAddClaimType('commercial')}
                className={`flex-1 px-4 py-3 text-sm font-semibold transition ${addClaimType === 'commercial' ? 'bg-[#2F3E4E] text-white' : 'text-[#7A8F79] hover:bg-[#f4f6f8]'}`}
              >
                Commercial / Insurance
              </button>
              <button
                type="button"
                onClick={() => setAddClaimType('medicaid')}
                className={`flex-1 px-4 py-3 text-sm font-semibold transition border-l border-[#D9E1E8] ${addClaimType === 'medicaid' ? 'bg-[#2F3E4E] text-white' : 'text-[#7A8F79] hover:bg-[#f4f6f8]'}`}
              >
                Medicaid
              </button>
            </div>

            <form onSubmit={submitClaim} className="px-6 py-5 space-y-6">

              {addError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{addError}</div>
              )}

              {/* Provider autocomplete — shared */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3">Provider</p>
                <div ref={providerRef} className="relative max-w-xs">
                  <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">
                    Provider Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Type to search providers…"
                    value={providerInput}
                    onChange={e => handleProviderInput(e.target.value)}
                    onKeyDown={handleProviderKeyDown}
                    autoComplete="off"
                    className={`w-full border rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] ${selectedNurseId ? 'border-[#7A8F79] bg-green-50' : 'border-[#D9E1E8]'}`}
                  />
                  {selectedNurseId && (
                    <span className="absolute right-2 top-8 text-green-600 text-xs font-semibold">✓ matched</span>
                  )}
                  {providerSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-[#D9E1E8] rounded-xl shadow-lg overflow-hidden">
                      {providerSuggestions.map((n, i) => (
                        <button
                          key={n.id}
                          type="button"
                          onMouseDown={() => selectNurse(n)}
                          onMouseEnter={() => setActiveSuggestionIdx(i)}
                          className={`w-full text-left px-4 py-2.5 text-sm transition ${i === activeSuggestionIdx ? 'bg-[#2F3E4E] text-white' : 'hover:bg-[#f4f6f8]'}`}
                        >
                          <span className="font-semibold">{n.displayName}</span>
                          {n.providerAliases.length > 0 && (
                            <span className={`text-xs ml-2 ${i === activeSuggestionIdx ? 'text-[#D9E1E8]' : 'text-[#7A8F79]'}`}>{n.providerAliases.join(', ')}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── COMMERCIAL FORM ── */}
              {addClaimType === 'commercial' && <>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3 border-t border-[#D9E1E8] pt-4">Claim Info</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Claim ID</label>
                    <input type="text" value={addForm.claimId || ''} onChange={e => setAddForm(f => ({ ...f, claimId: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Claim Stage</label>
                    <select value={addForm.claimStage || 'Draft'} onChange={e => setAddForm(f => ({ ...f, claimStage: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]">
                      {['Draft','INS-1 Submitted','Resubmitted','Pending','Info Requested','Info Sent','INS-2 Submitted','Appealed','Paid','Denied','Rejected'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Submit Date</label>
                    <SmartDateInput key={`${modalResetKey}-submitDate`} ref={submitDateRef} nextRef={dosStartRef} value={addForm.submitDate || ''} onChange={v => setAddForm(f => ({ ...f, submitDate: v }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">DOS Start</label>
                    <SmartDateInput key={`${modalResetKey}-dosStart`} ref={dosStartRef} nextRef={dosStopRef} value={addForm.dosStart || ''} onChange={v => setAddForm(f => ({ ...f, dosStart: v }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">DOS Stop</label>
                    <SmartDateInput key={`${modalResetKey}-dosStop`} ref={dosStopRef} value={addForm.dosStop || ''} onChange={v => setAddForm(f => ({ ...f, dosStop: v }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Total Billed</label>
                    <input type="number" step="0.01" min="0" value={addForm.totalBilled || ''} onChange={e => setAddForm(f => ({ ...f, totalBilled: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3 border-t border-[#D9E1E8] pt-4">Primary Insurance</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Payer</label>
                    <input type="text" value={addForm.primaryPayer || ''} onChange={e => setAddForm(f => ({ ...f, primaryPayer: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Allowed Amt</label>
                    <input type="number" step="0.01" min="0" value={addForm.primaryAllowedAmt || ''} onChange={e => setAddForm(f => ({ ...f, primaryAllowedAmt: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Paid Amt</label>
                    <input type="number" step="0.01" min="0" value={addForm.primaryPaidAmt || ''} onChange={e => setAddForm(f => ({ ...f, primaryPaidAmt: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Paid Date</label>
                    <SmartDateInput key={`${modalResetKey}-primPaid`} ref={primPaidDateRef} nextRef={secPaidDateRef} value={addForm.primaryPaidDate || ''} onChange={v => setAddForm(f => ({ ...f, primaryPaidDate: v }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Paid To</label>
                    <input type="text" value={addForm.primaryPaidTo || ''} onChange={e => setAddForm(f => ({ ...f, primaryPaidTo: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3 border-t border-[#D9E1E8] pt-4">Secondary Insurance</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Payer</label>
                    <input type="text" value={addForm.secondaryPayer || ''} onChange={e => setAddForm(f => ({ ...f, secondaryPayer: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Allowed Amt</label>
                    <input type="number" step="0.01" min="0" value={addForm.secondaryAllowedAmt || ''} onChange={e => setAddForm(f => ({ ...f, secondaryAllowedAmt: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Paid Amt</label>
                    <input type="number" step="0.01" min="0" value={addForm.secondaryPaidAmt || ''} onChange={e => setAddForm(f => ({ ...f, secondaryPaidAmt: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Paid Date</label>
                    <SmartDateInput key={`${modalResetKey}-secPaid`} ref={secPaidDateRef} nextRef={finalDateRef} value={addForm.secondaryPaidDate || ''} onChange={v => setAddForm(f => ({ ...f, secondaryPaidDate: v }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Paid To</label>
                    <input type="text" value={addForm.secondaryPaidTo || ''} onChange={e => setAddForm(f => ({ ...f, secondaryPaidTo: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3 border-t border-[#D9E1E8] pt-4">Summary</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Total Reimbursed</label>
                    <input type="number" step="0.01" min="0" value={addForm.totalReimbursed || ''} onChange={e => setAddForm(f => ({ ...f, totalReimbursed: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Remaining Balance</label>
                    <input type="number" step="0.01" min="0" value={addForm.remainingBalance || ''} onChange={e => setAddForm(f => ({ ...f, remainingBalance: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Date Fully Finalized</label>
                    <SmartDateInput key={`${modalResetKey}-finalDate`} ref={finalDateRef} value={addForm.dateFullyFinalized || ''} onChange={v => setAddForm(f => ({ ...f, dateFullyFinalized: v }))} />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Processing Notes</label>
                    <textarea rows={2} value={addForm.processingNotes || ''} onChange={e => setAddForm(f => ({ ...f, processingNotes: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
                  </div>
                </div>
              </div>

              </>}

              {/* ── MEDICAID FORM ── */}
              {addClaimType === 'medicaid' && <>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3 border-t border-[#D9E1E8] pt-4">Claim Details</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Patient Ctrl # <span className="text-red-500">*</span></label>
                    <input type="text" value={medicaidForm.patientCtrlNum || ''} onChange={e => setMedicaidForm(f => ({ ...f, patientCtrlNum: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Payer Ctrl #</label>
                    <input type="text" value={medicaidForm.payerCtrlNum || ''} onChange={e => setMedicaidForm(f => ({ ...f, payerCtrlNum: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Total Charge <span className="text-red-500">*</span></label>
                    <input type="number" step="0.01" min="0" value={medicaidForm.totalCharge || ''} onChange={e => setMedicaidForm(f => ({ ...f, totalCharge: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">DOS Start <span className="text-red-500">*</span></label>
                    <SmartDateInput key={`${modalResetKey}-mDosStart`} ref={mDosStartRef} nextRef={mDosStopRef} value={medicaidForm.dosStart || ''} onChange={v => setMedicaidForm(f => ({ ...f, dosStart: v }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">DOS Stop <span className="text-red-500">*</span></label>
                    <SmartDateInput key={`${modalResetKey}-mDosStop`} ref={mDosStopRef} nextRef={mProcessedRef} value={medicaidForm.dosStop || ''} onChange={v => setMedicaidForm(f => ({ ...f, dosStop: v }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Paid Amount</label>
                    <input type="number" step="0.01" min="0" value={medicaidForm.paidAmount || ''} onChange={e => setMedicaidForm(f => ({ ...f, paidAmount: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Processed Date</label>
                    <SmartDateInput key={`${modalResetKey}-mProcessed`} ref={mProcessedRef} value={medicaidForm.processedDate || ''} onChange={v => setMedicaidForm(f => ({ ...f, processedDate: v }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Est. Pay Cycle #</label>
                    <input type="number" step="1" min="0" value={medicaidForm.estPayCycle || ''} onChange={e => setMedicaidForm(f => ({ ...f, estPayCycle: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                    {medicaidForm.estPayCycle && !isNaN(parseInt(medicaidForm.estPayCycle)) && (
                      <p className="text-xs text-[#7A8F79] mt-1">→ {payCycleDateLabel(parseInt(medicaidForm.estPayCycle))}</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3 border-t border-[#D9E1E8] pt-4">Claim Status Codes</p>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type code or description…"
                    value={medicaidCodeInput}
                    onChange={e => handleMedicaidCodeInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const match = medicaidStatusCodes.find(c => c.code.toLowerCase() === medicaidCodeInput.toLowerCase())
                        if (match) addMedicaidCode(match.code)
                        else if (medicaidCodeInput.trim()) addMedicaidCode(medicaidCodeInput.trim().toUpperCase())
                      }
                    }}
                    className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  />
                  {medicaidCodeSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-[#D9E1E8] rounded-xl shadow-lg overflow-hidden">
                      {medicaidCodeSuggestions.map(c => (
                        <button
                          key={c.code}
                          type="button"
                          onMouseDown={() => addMedicaidCode(c.code)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#f4f6f8] transition"
                        >
                          <span className="font-semibold text-[#2F3E4E]">{c.code}</span>
                          <span className="text-[#7A8F79] text-xs ml-2 line-clamp-1">{c.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {medicaidSelectedCodes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {medicaidSelectedCodes.map(code => (
                      <span key={code} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                        {code}
                        <button type="button" onClick={() => setMedicaidSelectedCodes(prev => prev.filter(c => c !== code))} className="text-blue-400 hover:text-blue-700 leading-none ml-0.5">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3 border-t border-[#D9E1E8] pt-4">Notes</p>
                <textarea rows={2} value={medicaidForm.notes || ''} onChange={e => setMedicaidForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
              </div>

              </>}

              <div className="flex justify-end gap-3 border-t border-[#D9E1E8] pt-5">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="px-5 py-2 rounded-lg border border-[#D9E1E8] text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] hover:border-[#7A8F79] transition">
                  Cancel
                </button>
                <button type="submit" disabled={adding}
                  className="px-5 py-2 rounded-lg bg-[#2F3E4E] text-white text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-60">
                  {adding ? 'Saving…' : 'Add Claim'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Follow-Up Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9E1E8]">
              <h2 className="text-lg font-bold text-[#2F3E4E]">Set Claim Follow-Up</h2>
              <button onClick={() => setShowReminderModal(false)} className="text-[#7A8F79] hover:text-[#2F3E4E] text-xl leading-none">×</button>
            </div>
            <form onSubmit={submitReminder} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Claim</label>
                <select
                  value={reminderForm.claimDbId}
                  onChange={e => {
                    const selected = claims.find(c => c.id === e.target.value)
                    setReminderForm(f => ({
                      ...f,
                      claimDbId: e.target.value,
                      claimRef: selected?.claimId || '',
                      nurseId: selected?.nurseId || '',
                    }))
                  }}
                  className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  required
                >
                  <option value="">— Select a claim —</option>
                  {[...claims]
                    .sort((a, b) => (a.claimId || '').localeCompare(b.claimId || ''))
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.claimId || c.id.slice(0, 8)} · {c.providerName || '—'}{c.dosStart ? ` · ${fmtDate(c.dosStart)}` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Follow-Up Date</label>
                <input
                  type="date"
                  value={reminderForm.dueDate}
                  onChange={e => setReminderForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Reason / Notes</label>
                <textarea
                  rows={3}
                  value={reminderForm.reason}
                  onChange={e => setReminderForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="What needs to be followed up on?"
                  className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none"
                  required
                />
              </div>

              {reminderError && <p className="text-red-600 text-xs">{reminderError}</p>}

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowReminderModal(false)}
                  className="px-5 py-2 rounded-lg border border-[#D9E1E8] text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] hover:border-[#7A8F79] transition">
                  Cancel
                </button>
                <button type="submit" disabled={reminderSaving}
                  className="px-5 py-2 rounded-lg bg-[#2F3E4E] text-white text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-60">
                  {reminderSaving ? 'Saving…' : 'Save Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
