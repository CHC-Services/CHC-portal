'use client'

import React, { useState, useEffect, useRef, Fragment, useMemo } from 'react'
import { calcMedicaidCycleInfo, payCycleDateLabel } from '../../../lib/medicaidPayCycle'
import { formalName } from '../../../lib/formatName'
import { excludedClaimIds as totalsExcludedClaimIds } from '../../../lib/claimTotals'
import DateInput from '../../components/DateInput'
import CarcLookupModal from '../../components/CarcLookupModal'
import MedicaidStatusCodeModal from '../../components/MedicaidStatusCodeModal'

const CLAIM_STAGES = [
  'Draft', 'INS-1 Submitted', 'Resubmitted', 'Adjusted', 'Pending', 'Info Requested',
  'Info Sent', 'INS-2 Submitted', 'Appealed', 'Appeal Needed', 'Paid', 'Denied',
  'Rejected', 'Check Wait', 'Voided',
]

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
  hours: number | null
  claimStage: string | null
  submitDate: string | null
  primaryPayer: string | null
  primaryAllowedAmt: number | null
  primaryCO: number | null
  primaryPaidAmt: number | null
  primaryPaidDate: string | null
  primaryPaidTo: string | null
  primaryCheckNum: string | null
  secondaryPayer: string | null
  secondaryAllowedAmt: number | null
  secondaryCO: number | null
  secondaryPaidAmt: number | null
  secondaryPaidDate: string | null
  secondaryPaidTo: string | null
  secondaryCheckNum: string | null
  totalReimbursed: number | null
  remainingBalance: number | null
  dateFullyFinalized: string | null
  checkReceivedDate: string | null
  estPayCycle: number | null
  depositDate: string | null
  resubmissionOf: string | null
  remarkCodes: string | null
  processingNotes: string | null
  voidedAt: string | null
  voidReversalOf: string | null
  nurse: { displayName: string; firstName?: string; lastName?: string; accountNumber: string | null; isDemo: boolean }
}

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
  hours: string
  claimStage: string
  submitDate: string
  primaryPayer: string
  primaryAllowedAmt: string
  primaryCO: string
  primaryPaidAmt: string
  primaryPaidDate: string
  primaryPaidTo: string
  primaryCheckNum: string
  secondaryPayer: string
  secondaryAllowedAmt: string
  secondaryCO: string
  secondaryPaidAmt: string
  secondaryPaidDate: string
  secondaryPaidTo: string
  secondaryCheckNum: string
  totalReimbursed: string
  remainingBalance: string
  dateFullyFinalized: string
  checkReceivedDate: string
  resubmissionOf: string
  remarkCodes: string
  processingNotes: string
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
    s === 'voided' ? 'bg-gray-200 text-gray-600' :
    s === 'paid' || s === 'finalized' ? 'bg-green-100 text-green-800' :
    s === 'denied' || s === 'rejected' ? 'bg-red-100 text-red-800' :
    s === 'pending' ? 'bg-yellow-100 text-yellow-800' :
    s === 'adjusted' ? 'bg-teal-100 text-teal-800' :
    s.includes('submitted') || s === 'resubmitted' ? 'bg-blue-100 text-blue-800' :
    s === 'info requested' ? 'bg-orange-100 text-orange-800' :
    s === 'info sent' ? 'bg-orange-50 text-orange-700' :
    s === 'appealed' ? 'bg-purple-100 text-purple-800' :
    s === 'appeal needed' ? 'bg-fuchsia-100 text-fuchsia-800' :
    s === 'check wait' ? 'bg-red-800 text-gray-100' :
    'bg-gray-900 text-gray-200'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{stage}</span>
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
    hours: c.hours != null ? String(Math.round(c.hours)) : '',
    claimStage: c.claimStage || '',
    submitDate: toDateStr(c.submitDate),
    primaryPayer: c.primaryPayer || '',
    primaryAllowedAmt: c.primaryAllowedAmt != null ? String(c.primaryAllowedAmt) : '',
    primaryCO: c.primaryCO != null ? String(c.primaryCO) : '',
    primaryPaidAmt: c.primaryPaidAmt != null ? String(c.primaryPaidAmt) : '',
    primaryPaidDate: toDateStr(c.primaryPaidDate),
    primaryPaidTo: c.primaryPaidTo || '',
    primaryCheckNum: c.primaryCheckNum || '',
    secondaryPayer: c.secondaryPayer || '',
    secondaryAllowedAmt: c.secondaryAllowedAmt != null ? String(c.secondaryAllowedAmt) : '',
    secondaryCO: c.secondaryCO != null ? String(c.secondaryCO) : '',
    secondaryPaidAmt: c.secondaryPaidAmt != null ? String(c.secondaryPaidAmt) : '',
    secondaryPaidDate: toDateStr(c.secondaryPaidDate),
    secondaryPaidTo: c.secondaryPaidTo || '',
    secondaryCheckNum: c.secondaryCheckNum || '',
    totalReimbursed: c.totalReimbursed != null ? String(c.totalReimbursed) : '',
    remainingBalance: c.remainingBalance != null ? String(c.remainingBalance) : '',
    dateFullyFinalized: toDateStr(c.dateFullyFinalized),
    checkReceivedDate: toDateStr(c.checkReceivedDate),
    resubmissionOf: c.resubmissionOf || '',
    remarkCodes: c.remarkCodes || '',
    processingNotes: c.processingNotes || '',
  }
}

// ─── ClaimDetailModal ─────────────────────────────────────────────────────────

function ClaimDetailModal({
  claim,
  eobDocs,
  uploading,
  deletingId,
  onClose,
  onSaved,
  onEobUpload,
  onEobDelete,
  onReloadClaims,
}: {
  claim: CommercialClaim
  eobDocs: EobDoc[]
  uploading: boolean
  deletingId: string | null
  onClose: () => void
  onSaved: (updated: CommercialClaim) => void
  onEobUpload: (file: File) => void
  onEobDelete: (docId: string) => void
  onReloadClaims: () => void
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'eobs' | 'history'>('details')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [showVoidConfirm, setShowVoidConfirm] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [voidError, setVoidError] = useState('')
  const [voidDate, setVoidDate] = useState('')

  const [cForm, setCForm] = useState<CommercialFormState>(() =>
    initCommercialForm(claim)
  )
  const [originalJSON] = useState(() =>
    JSON.stringify(initCommercialForm(claim))
  )

  // Refs mirror the latest form state so an unmount cleanup (fired when the parent
  // swaps to a different claim without going through handleClose) can still save
  // whatever was typed, instead of silently discarding it.
  const cFormRef = useRef(cForm)
  cFormRef.current = cForm
  const savedOnceRef = useRef(false)

  async function performSave(): Promise<boolean> {
    if (savedOnceRef.current) return true
    savedOnceRef.current = true
    const changed = JSON.stringify(cFormRef.current) !== originalJSON
    if (!changed) return true
    try {
      const f = cFormRef.current
      const res = await fetch(`/api/admin/claims/${claim.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          claimId: f.claimId || null,
          providerName: f.providerName || null,
          dosStart: f.dosStart || null,
          dosStop: f.dosStop || null,
          totalBilled: f.totalBilled || null,
          hours: f.hours || null,
          claimStage: f.claimStage || null,
          submitDate: f.submitDate || null,
          primaryPayer: f.primaryPayer || null,
          primaryAllowedAmt: f.primaryAllowedAmt || null,
          primaryCO: f.primaryCO || null,
          primaryPaidAmt: f.primaryPaidAmt || null,
          primaryPaidDate: f.primaryPaidDate || null,
          primaryPaidTo: f.primaryPaidTo || null,
          primaryCheckNum: f.primaryCheckNum || null,
          secondaryPayer: f.secondaryPayer || null,
          secondaryAllowedAmt: f.secondaryAllowedAmt || null,
          secondaryCO: f.secondaryCO || null,
          secondaryPaidAmt: f.secondaryPaidAmt || null,
          secondaryPaidDate: f.secondaryPaidDate || null,
          secondaryPaidTo: f.secondaryPaidTo || null,
          secondaryCheckNum: f.secondaryCheckNum || null,
          totalReimbursed: f.totalReimbursed || null,
          remainingBalance: f.remainingBalance || null,
          dateFullyFinalized: f.dateFullyFinalized || null,
          checkReceivedDate: f.checkReceivedDate || null,
          resubmissionOf: f.resubmissionOf || null,
          remarkCodes: f.remarkCodes || null,
          processingNotes: f.processingNotes || null,
        }),
      })
      if (res.ok) {
        onSaved({ ...claim, ...f } as unknown as CommercialClaim)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function handleClose() {
    if (saveStatus === 'saving') return
    setSaveStatus('saving')
    const ok = await performSave()
    setSaveStatus(ok ? 'saved' : 'error')
    onClose()
  }

  async function voidClaim() {
    if (!voidDate) { setVoidError('Enter the date this claim was voided.'); return }
    setVoiding(true)
    setVoidError('')
    // Flush any unsaved edits to the original before voiding it.
    await performSave()
    const res = await fetch(`/api/admin/claims/${claim.id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ voidDate }),
    })
    const data = await res.json()
    setVoiding(false)
    if (!res.ok) {
      setVoidError(data.error || 'Failed to void this claim.')
      return
    }
    setShowVoidConfirm(false)
    onReloadClaims()
    onClose()
  }

  // Safety net: if the parent swaps to a different claim (e.g. clicking a
  // resubmission-chain link) without the ✕/Escape path ever firing, this still
  // saves whatever was typed before the form state is torn down.
  useEffect(() => {
    return () => { performSave() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [cForm, originalJSON, saveStatus])

  useEffect(() => {
    if (activeTab !== 'history') return
    setAuditLoading(true)
    fetch(`/api/admin/claims/audit?commercialId=${claim.id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAuditLogs(data) })
      .catch(() => {})
      .finally(() => setAuditLoading(false))
  }, [activeTab])

  const inp = 'w-full border border-[#D9E1E8] rounded-lg px-2 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'
  const dateInp = 'border border-[#D9E1E8] rounded-lg px-2 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] max-w-[145px] w-full'
  const lbl = 'block text-xs font-semibold text-[#2F3E4E] mb-0.5'
  const sec = 'text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-2 border-t border-[#D9E1E8] pt-3'

  const isMed = isMedicaidPayer(cForm.primaryPayer)
  const isSecondaryMed = !isMed && isMedicaidPayer(cForm.secondaryPayer)

  const tabs: Array<'details' | 'eobs' | 'history'> = ['details', 'eobs', 'history']

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-4 px-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D9E1E8]">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-bold text-[#2F3E4E]">
              {cForm.providerName || claim.providerName || 'Claim'}
            </h2>
            {claim.voidedAt && (
              <span className="text-xs font-semibold text-gray-600 bg-gray-200 px-2 py-0.5 rounded-full">VOIDED</span>
            )}
            {claim.voidReversalOf && (
              <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">REVERSAL</span>
            )}
            {saveStatus === 'saving' && <span className="text-xs text-[#7A8F79] animate-pulse">Saving…</span>}
            {saveStatus === 'saved' && <span className="text-xs text-green-600">✓ Saved</span>}
            {saveStatus === 'error' && <span className="text-xs text-red-500">Error saving</span>}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={cForm.claimStage}
              onChange={e => setCForm(f => ({ ...f, claimStage: e.target.value }))}
              className="text-xs border border-[#D9E1E8] rounded-lg px-2 py-1.5 text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] bg-white"
            >
              <option value="">— Stage —</option>
              {CLAIM_STAGES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {!claim.voidedAt && !claim.voidReversalOf && (
              <button
                onClick={() => { setVoidDate(new Date().toISOString().slice(0, 10)); setShowVoidConfirm(true) }}
                className="text-xs font-semibold text-red-500 border border-red-300 px-2 py-1.5 rounded-lg hover:bg-red-50 transition"
              >
                Void
              </button>
            )}
            <button onClick={handleClose} className="text-[#7A8F79] hover:text-[#2F3E4E] text-xl leading-none">✕</button>
          </div>
        </div>

        {/* Void confirmation */}
        {showVoidConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
              <p className="text-sm font-bold text-[#2F3E4E] mb-2">Void this claim?</p>
              <p className="text-xs text-[#7A8F79] leading-relaxed mb-3">
                This creates a new offsetting entry for{' '}
                <span className="font-semibold text-[#2F3E4E]">
                  {fmt(-(cForm.totalBilled ? parseFloat(cForm.totalBilled) : 0), '$')}
                </span>{' '}
                that cancels this claim&rsquo;s total out of reimbursement/submission calculations.
              </p>
              <p className="text-xs text-[#7A8F79] leading-relaxed mb-4">
                The original claim record and its figures are kept exactly as-is, just marked Voided. You can then enter a new, corrected claim separately.
              </p>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">
                  Void Date {(isMed || isSecondaryMed) && <span className="text-[#7A8F79] font-normal">(determines which pay cycle the reversal lands in)</span>}
                </label>
                <DateInput
                  value={voidDate}
                  onChange={e => setVoidDate(e.target.value)}
                  className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
              </div>
              {voidError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{voidError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowVoidConfirm(false); setVoidError('') }}
                  className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:border-[#7A8F79] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={voidClaim}
                  disabled={voiding}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
                >
                  {voiding ? 'Voiding…' : 'Void Claim'}
                </button>
              </div>
            </div>
          </div>
        )}

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
        <div className="px-4 py-3 max-h-[75vh] overflow-y-auto">

          {/* ── Details ── */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <p className={sec}>Claim Info</p>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <label className={lbl}>{isMed ? 'Patient Ctrl #' : 'Claim ID'}</label>
                    <input className={inp} value={cForm.claimId} onChange={e => setCForm(f => ({ ...f, claimId: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Hours</label>
                    <input type="number" min="0" max="999" step="1" className={inp} value={cForm.hours}
                      onChange={e => setCForm(f => ({ ...f, hours: e.target.value.slice(0, 3) }))} />
                  </div>
                  <div>
                    <label className={lbl}>Total Billed</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                      <input type="number" step="0.01" className={`${inp} pl-5 ${claim.voidReversalOf ? 'text-red-800 font-semibold' : ''}`} value={cForm.totalBilled} onChange={e => setCForm(f => ({ ...f, totalBilled: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Submit Date</label>
                    <DateInput className={dateInp} value={cForm.submitDate} onChange={e => setCForm(f => ({ ...f, submitDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>DOS Start</label>
                    <DateInput className={dateInp} value={cForm.dosStart} onChange={e => setCForm(f => ({ ...f, dosStart: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>DOS Stop</label>
                    <DateInput className={dateInp} value={cForm.dosStop} onChange={e => setCForm(f => ({ ...f, dosStop: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sec}>Primary Insurance</p>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <label className={lbl}>Payer</label>
                    <input className={inp} value={cForm.primaryPayer} onChange={e => setCForm(f => ({ ...f, primaryPayer: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Allowed Amt</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                      <input type="number" step="0.01" className={`${inp} pl-5`} value={cForm.primaryAllowedAmt} onChange={e => setCForm(f => ({ ...f, primaryAllowedAmt: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Paid Amt</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                      <input type="number" step="0.01" className={`${inp} pl-5`} value={cForm.primaryPaidAmt} onChange={e => setCForm(f => ({ ...f, primaryPaidAmt: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Processed Date {isMed && <span className="text-[#7A8F79] font-normal normal-case text-[10px]">(auto-calcs pay cycle)</span>}</label>
                    <DateInput className={dateInp} value={cForm.primaryPaidDate} onChange={e => setCForm(f => ({ ...f, primaryPaidDate: e.target.value }))} />
                    {isMed && cForm.primaryPaidDate && (() => {
                      const info = calcMedicaidCycleInfo(cForm.primaryPaidDate)
                      return info ? (
                        <p className="text-[10px] text-[#7A8F79] mt-1">Cycle {info.cycle} · Deposits {payCycleDateLabel(info.cycle)}</p>
                      ) : null
                    })()}
                  </div>
                  <div>
                    <label className={lbl}>Writeoff</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                      <input type="number" step="0.01" className={`${inp} pl-5`} value={cForm.primaryCO} onChange={e => setCForm(f => ({ ...f, primaryCO: e.target.value }))} />
                    </div>
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
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <label className={lbl}>Payer</label>
                    <input className={inp} value={cForm.secondaryPayer} onChange={e => setCForm(f => ({ ...f, secondaryPayer: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Allowed Amt</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                      <input type="number" step="0.01" className={`${inp} pl-5`} value={cForm.secondaryAllowedAmt} onChange={e => setCForm(f => ({ ...f, secondaryAllowedAmt: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Paid Amt</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                      <input type="number" step="0.01" className={`${inp} pl-5`} value={cForm.secondaryPaidAmt} onChange={e => setCForm(f => ({ ...f, secondaryPaidAmt: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Processed Date {isSecondaryMed && <span className="text-[#7A8F79] font-normal normal-case text-[10px]">(auto-calcs pay cycle)</span>}</label>
                    <DateInput className={dateInp} value={cForm.secondaryPaidDate} onChange={e => setCForm(f => ({ ...f, secondaryPaidDate: e.target.value }))} />
                    {isSecondaryMed && cForm.secondaryPaidDate && (() => {
                      const info = calcMedicaidCycleInfo(cForm.secondaryPaidDate)
                      return info ? (
                        <p className="text-[10px] text-[#7A8F79] mt-1">Cycle {info.cycle} · Deposits {payCycleDateLabel(info.cycle)}</p>
                      ) : null
                    })()}
                  </div>
                  <div>
                    <label className={lbl}>Writeoff</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                      <input type="number" step="0.01" className={`${inp} pl-5`} value={cForm.secondaryCO} onChange={e => setCForm(f => ({ ...f, secondaryCO: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Paid To</label>
                    <input className={inp} value={cForm.secondaryPaidTo} onChange={e => setCForm(f => ({ ...f, secondaryPaidTo: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>{isSecondaryMed ? 'Payer Claim #' : 'Check #'}</label>
                    <input className={inp} value={cForm.secondaryCheckNum} onChange={e => setCForm(f => ({ ...f, secondaryCheckNum: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sec}>Summary</p>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className={lbl}>Total Reimb.</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                      <input type="number" step="0.01" className={`${inp} pl-5 ${claim.voidReversalOf ? 'text-red-800 font-semibold' : ''}`} value={cForm.totalReimbursed} onChange={e => setCForm(f => ({ ...f, totalReimbursed: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Remaining Bal.</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                      <input type="number" step="0.01" className={`${inp} pl-5`} value={cForm.remainingBalance} onChange={e => setCForm(f => ({ ...f, remainingBalance: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Finalized</label>
                    <DateInput className={dateInp} value={cForm.dateFullyFinalized} onChange={e => setCForm(f => ({ ...f, dateFullyFinalized: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Paid Date</label>
                    <DateInput className={dateInp} value={cForm.checkReceivedDate} onChange={e => setCForm(f => ({ ...f, checkReceivedDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Resubmission Of</label>
                    <input
                      className={inp}
                      placeholder="Original claim ID"
                      value={cForm.resubmissionOf}
                      onChange={e => setCForm(f => ({ ...f, resubmissionOf: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>Remark Codes</label>
                    <input
                      className={inp}
                      placeholder="e.g. CO-45, N130"
                      value={cForm.remarkCodes}
                      onChange={e => setCForm(f => ({ ...f, remarkCodes: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-4">
                    <label className={lbl}>Processing Notes</label>
                    <textarea rows={3} className={`${inp} resize-none`} value={cForm.processingNotes} onChange={e => setCForm(f => ({ ...f, processingNotes: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── EOBs Tab ── */}
          {activeTab === 'eobs' && (
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

// ─── AdminClaimCard ───────────────────────────────────────────────────────────

function AdminClaimCard({
  uc,
  eobs,
  eobUploading,
  isOpen,
  onToggle,
  onEobUpload,
  onOpenChain,
}: {
  uc: CommercialClaim
  eobs: EobDoc[]
  eobUploading: string | null
  isOpen: boolean
  onToggle: () => void
  onEobUpload: (file: File) => void
  onOpenChain: (id: string) => void
}) {
  const c = uc
  // Real Medicaid claims live as commercial Claim rows with "Medicaid" as the
  // payer, not as separate MedicaidClaim records — badge on payer, not type.
  const isMedicaidPayerClaim = isMedicaidPayer(c.primaryPayer) || isMedicaidPayer(c.secondaryPayer)

  const claimId = c.claimId
  const dosStart = c.dosStart
  const dosStop  = c.dosStop
  const billed   = c.totalBilled
  const reimb    = c.totalReimbursed
  const stage    = c.claimStage
  const providerName = c.providerName ?? uc.nurse?.displayName ?? null

  const isFinal = ['paid', 'denied', 'rejected', 'finalized'].includes((stage || '').toLowerCase())
  const dateLabel = isFinal ? 'Finalized' : 'Updated'
  const dateValue = isFinal ? (c?.dateFullyFinalized || c?.primaryPaidDate || null) : null
  const firstNoteLine = c?.processingNotes?.split('\n').find(l => l.trim()) ?? null

  return (
    <div className={`bg-white rounded-xl shadow-sm overflow-hidden ${isOpen ? 'ring-2 ring-[#7A8F79]' : ''}`}>
      <button
        onClick={onToggle}
        className="w-full text-left px-4 pt-3 pb-2.5 hover:bg-[#F4F6F5] transition-colors"
      >
        {/* Row 1: provider + badges | EOB | stage + chevron */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            {providerName && (
              <span className="text-xs font-semibold text-[#2F3E4E] truncate max-w-[180px]">{providerName}</span>
            )}
            {c?.resubmissionOf && (
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">↻ Resub</span>
            )}
            {isMedicaidPayerClaim && (
              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-full shrink-0">Medicaid</span>
            )}
            {c?.depositDate && (
              <span className="ml-1.5 text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                EOB/Payment Date: {fmtDate(c.depositDate)}
              </span>
            )}
            {uc.voidedAt && (
              <span className="text-[10px] font-semibold text-gray-600 bg-gray-200 px-1.5 py-0.5 rounded-full shrink-0">VOIDED</span>
            )}
            {uc.voidReversalOf && (
              <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">REVERSAL</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <label
              className={`cursor-pointer text-[11px] px-1.5 py-0.5 rounded border border-dashed transition ${eobUploading === uc.id ? 'opacity-50 cursor-default text-[#7A8F79] border-[#D9E1E8]' : 'text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79] hover:text-[#2F3E4E]'}`}
              onClick={e => e.stopPropagation()}
            >
              {eobUploading === uc.id ? '…' : '📎'}
              <input type="file" className="hidden" disabled={eobUploading === uc.id}
                accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
                onChange={e => { const f = e.target.files?.[0]; if (f) onEobUpload(f); e.target.value = '' }}
              />
            </label>
            {eobs.length > 0 && (
              <button
                className="text-xs text-green-700 hover:text-green-900 transition"
                title={eobs[0].fileName}
                onClick={async e => {
                  e.stopPropagation()
                  const win = window.open('', '_blank')
                  try {
                    const res = await fetch(`/api/admin/documents/${eobs[0].id}`, { credentials: 'include' })
                    const data = await res.json()
                    if (data.url && win) { win.location.href = data.url } else { win?.close() }
                  } catch { win?.close() }
                }}
              >
                🗂️{eobs.length > 1 && <span className="text-[10px] text-[#7A8F79] ml-0.5">+{eobs.length - 1}</span>}
              </button>
            )}
            <StageBadge stage={stage} />
            <span className="text-[#7A8F79] text-[10px]">▼</span>
          </div>
        </div>

        {/* Row 2: labels */}
        <div className="grid grid-cols-4 gap-2 items-end">
          <div><p className="text-[10px] text-[#7A8F79] leading-tight">Claim ID</p></div>
          <div><p className="text-[10px] text-[#7A8F79] leading-tight">Total Billed</p></div>
          <div><p className="text-[10px] text-[#7A8F79] leading-tight">Total Reimb.</p></div>
          <div className="text-right"><p className="text-xs font-semibold text-[#2F3E4E] leading-tight">{dateValue ? fmtDate(dateValue) : ''}</p></div>
        </div>

        {/* Row 3: values */}
        <div className="grid grid-cols-4 gap-2 items-start mt-0.5">
          <div>
            <p className="text-xs font-mono font-semibold text-[#2F3E4E] truncate leading-tight">{claimId || '—'}</p>
            <p className="text-[10px] text-[#7A8F79] leading-tight mt-0.5">{fmtDOS(dosStart, dosStop)}</p>
          </div>
          <div><p className={`text-xs font-semibold leading-tight ${uc.voidReversalOf ? 'text-red-800' : 'text-[#2F3E4E]'}`}>{fmt(billed, '$')}</p></div>
          <div><p className={`text-xs font-semibold leading-tight ${uc.voidReversalOf ? 'text-red-800' : 'text-[#7A8F79]'}`}>{fmt(reimb, '$')}</p></div>
          <div className="text-right"><p className={`text-[10px] leading-tight ${isFinal ? 'text-green-700' : 'text-[#7A8F79]'}`}>{dateLabel}</p></div>
        </div>

        {/* Row 4: notes preview */}
        {firstNoteLine && (
          <div className="mt-2 pt-2 border-t border-[#D9E1E8]">
            <p className="text-[11px] text-[#7A8F79] truncate leading-tight">
              <span className="font-semibold text-[#7A8F79] uppercase tracking-wide text-[10px]">Note · </span>
              {firstNoteLine}
            </p>
          </div>
        )}
      </button>
    </div>
  )
}

// ─── AdminClaimsPage ──────────────────────────────────────────────────────────

type ClaimsPageTab = 'claims' | 'medicaidPayouts'

function ClaimsTab({ setTab }: { setTab: (t: ClaimsPageTab) => void }) {
  const [claims, setClaims] = useState<CommercialClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [hideDemo, setHideDemo] = useState(true)

  // Selected claim for detail modal
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null)

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
  type NurseOption = { id: string; displayName: string; firstName?: string; lastName?: string }
  const [nurses, setNurses] = useState<NurseOption[]>([])

  // Add Claim modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkPrompt, setShowBulkPrompt] = useState(false)
  const [modalResetKey, setModalResetKey] = useState(0)
  const [addForm, setAddForm] = useState<Record<string, string>>({ claimStage: 'Draft' })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addPayCycle, setAddPayCycle] = useState('')  // pay cycle calculator (display only)

  // Provider autocomplete
  const [providerInput, setProviderInput] = useState('')
  const [providerSuggestions, setProviderSuggestions] = useState<NurseOption[]>([])
  const [selectedNurseId, setSelectedNurseId] = useState<string | null>(null)
  const providerRef = useRef<HTMLDivElement>(null)
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0)

  // Date field refs for auto-advance
  const submitDateRef   = useRef<HTMLInputElement>(null)
  const dosStartRef     = useRef<HTMLInputElement>(null)
  const dosStopRef      = useRef<HTMLInputElement>(null)
  const primPaidDateRef = useRef<HTMLInputElement>(null)
  const secPaidDateRef  = useRef<HTMLInputElement>(null)
  const finalDateRef    = useRef<HTMLInputElement>(null)

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
    loadEobs()
    loadReminders()
    fetch('/api/admin/nurses', { credentials: 'include' })
      .then(r => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) setNurses(data.map(n => ({ id: n.id, displayName: n.displayName, firstName: n.firstName, lastName: n.lastName })))
      })
      .catch(() => {})
  }, [])

  // Auto-calculate primary writeoff (billed - primary allowed)
  useEffect(() => {
    if (!showAddModal) return
    const billed = parseFloat(addForm.totalBilled || '')
    const allowed = parseFloat(addForm.primaryAllowedAmt || '')
    if (!isNaN(billed) && !isNaN(allowed)) {
      setAddForm(f => ({ ...f, primaryCO: Math.max(0, billed - allowed).toFixed(2) }))
    }
  }, [addForm.totalBilled, addForm.primaryAllowedAmt, showAddModal])

  // Auto-calculate secondary writeoff (billed - secondary allowed)
  useEffect(() => {
    if (!showAddModal) return
    const billed = parseFloat(addForm.totalBilled || '')
    const allowed = parseFloat(addForm.secondaryAllowedAmt || '')
    if (!isNaN(billed) && !isNaN(allowed)) {
      setAddForm(f => ({ ...f, secondaryCO: Math.max(0, billed - allowed).toFixed(2) }))
    }
  }, [addForm.totalBilled, addForm.secondaryAllowedAmt, showAddModal])

  // Auto-calculate hours billed (totalBilled / 150)
  useEffect(() => {
    if (!showAddModal) return
    const billed = parseFloat(addForm.totalBilled || '')
    if (!isNaN(billed) && billed > 0) {
      setAddForm(f => ({ ...f, hours: Math.round(billed / 150).toString() }))
    }
  }, [addForm.totalBilled, showAddModal])

  // Auto-calculate total reimbursed (sum of paid amounts)
  useEffect(() => {
    if (!showAddModal) return
    const primary = parseFloat(addForm.primaryPaidAmt || '')
    const secondary = parseFloat(addForm.secondaryPaidAmt || '')
    if (!isNaN(primary) || !isNaN(secondary)) {
      const total = (!isNaN(primary) ? primary : 0) + (!isNaN(secondary) ? secondary : 0)
      setAddForm(f => ({ ...f, totalReimbursed: total.toFixed(2) }))
    }
  }, [addForm.primaryPaidAmt, addForm.secondaryPaidAmt, showAddModal])

  // Medicaid: default Paid To = "Provider" — applies wherever Medicaid is
  // actually listed (primary or secondary), not primary only.
  useEffect(() => {
    if (!showAddModal) return
    if (isMedicaidPayer(addForm.primaryPayer)) {
      setAddForm(f => ({ ...f, primaryPaidTo: f.primaryPaidTo || 'Provider' }))
    } else if (isMedicaidPayer(addForm.secondaryPayer)) {
      setAddForm(f => ({ ...f, secondaryPaidTo: f.secondaryPaidTo || 'Provider' }))
    }
  }, [addForm.primaryPayer, addForm.secondaryPayer, showAddModal])

  // Medicaid: default Date Fully Finalized = deposit date from proc date —
  // driven by whichever side (primary or secondary) is actually Medicaid,
  // not primary only. Only one side can be "the Medicaid one" at a time —
  // the Secondary Insurance section itself is hidden whenever primary is
  // Medicaid, so these two branches never both apply.
  useEffect(() => {
    if (!showAddModal) return
    const primaryIsMed = isMedicaidPayer(addForm.primaryPayer)
    const secondaryIsMed = !primaryIsMed && isMedicaidPayer(addForm.secondaryPayer)
    const procDate = primaryIsMed ? addForm.primaryPaidDate : secondaryIsMed ? addForm.secondaryPaidDate : null
    if (!procDate) return
    const info = calcMedicaidCycleInfo(procDate)
    if (info?.depositDateStr) {
      setAddForm(f => ({ ...f, dateFullyFinalized: info.depositDateStr }))
    }
  }, [addForm.primaryPaidDate, addForm.primaryPayer, addForm.secondaryPaidDate, addForm.secondaryPayer, showAddModal])


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
    setAddPayCycle('')
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
      (formalName(n) || n.displayName).toLowerCase().includes(q)
    ).slice(0, 6)
    setProviderSuggestions(matches)
  }

  function selectNurse(nurse: NurseOption) {
    setProviderInput(formalName(nurse) || nurse.displayName)
    setSelectedNurseId(nurse.id)
    setAddForm(f => ({ ...f, providerName: nurse.displayName }))
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

  async function submitClaim(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)

    if (!addForm.providerName?.trim()) { setAddError('Provider name is required.'); setAdding(false); return }
    if (!selectedNurseId) { setAddError('Select a nurse from the suggestions list.'); setAdding(false); return }
    const res = await fetch('/api/admin/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...addForm, nurseId: selectedNurseId }),
    })
    const data = await res.json()
    if (!res.ok) { setAddError(data.error || 'Failed to create claim.'); setAdding(false); return }
    setClaims(prev => [data.claim, ...prev])
    setShowAddModal(false)
    setAdding(false)
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

  // ── Filtered claims ─────────────────────────────────────────────────────

  // claimId values that are pointed to as an original by another claim's resubmissionOf
  // — used to hide superseded rows from the visible list (a void reversal's
  // resubmissionOf hides its original the same way, since the reversal alone
  // stands in for it here; see supersededByTotals below for why financial
  // totals need a different rule).
  const supersededClaimIds = useMemo(() => {
    const ids = new Set<string>()
    claims.forEach(c => { if (c.resubmissionOf) ids.add(c.resubmissionOf) })
    return ids
  }, [claims])

  // claimId values excluded from financial TOTALS specifically — only claims
  // superseded by a genuine resubmission. A voided original must stay IN the
  // total: its reversal row carries every dollar field negated, and the two
  // only net to zero when both are summed (see lib/claimTotals.ts).
  const supersededByTotals = useMemo(() => totalsExcludedClaimIds(claims), [claims])

  // lookup map for walking resubmission chains
  const claimByClaimId = useMemo(() =>
    new Map(claims.filter(c => c.claimId).map(c => [c.claimId!, c]))
  , [claims])

  function matchesClaimFilters(uc: CommercialClaim): boolean {
    const provName = uc.providerName || uc.nurse?.displayName || ''
    const id = uc.claimId || ''
    const payer = uc.primaryPayer || ''
    if (hideDemo && uc.nurse?.isDemo) return false
    const matchSearch = !search ||
      provName.toLowerCase().includes(search.toLowerCase()) ||
      id.toLowerCase().includes(search.toLowerCase()) ||
      payer.toLowerCase().includes(search.toLowerCase())
    const matchStage = !filterStage || uc.claimStage === filterStage
    const matchYear = !filterYear || (uc.dosStart ? new Date(uc.dosStart).getUTCFullYear().toString() === filterYear : false)
    return matchSearch && matchStage && matchYear
  }

  const filteredAll: CommercialClaim[] = useMemo(() => {
    return claims.filter(uc => {
      // never show superseded originals in the main list — they appear tucked under their resubmission
      if (supersededClaimIds.has(uc.claimId || '')) return false
      return matchesClaimFilters(uc)
    })
  }, [claims, search, filterStage, filterYear, hideDemo, supersededClaimIds])

  // Same filters as filteredAll, but with the totals-correct exclusion rule
  // — this is what "Total Billed" etc. below are computed from, not filteredAll.
  const totalsFilteredAll: CommercialClaim[] = useMemo(() => {
    return claims.filter(uc => {
      if (supersededByTotals.has(uc.id)) return false
      return matchesClaimFilters(uc)
    })
  }, [claims, search, filterStage, filterYear, hideDemo, supersededByTotals])

  const totalBilled = totalsFilteredAll.reduce((s, uc) => s + (Number(uc.totalBilled) || 0), 0)
  const totalReimbursed = totalsFilteredAll.reduce((s, uc) => s + (Number(uc.totalReimbursed) || 0), 0)
  const totalBalance = totalsFilteredAll.reduce((s, uc) => s + (Number(uc.remainingBalance) || 0), 0)

  const stages = [...new Set(claims.map(c => c.claimStage).filter(Boolean))] as string[]

  // Opened claim for detail modal
  const openedClaim = useMemo(() => {
    if (!selectedClaimId) return null
    return claims.find(c => c.id === selectedClaimId) || null
  }, [selectedClaimId, claims])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6">
      <div className="max-w-screen-xl mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#2F3E4E]"><span className="text-[#7A8F79] italic">ad</span>Claims</h1>
            <p className="text-sm text-[#7A8F79] mt-0.5">Manage claims below.</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setTab('claims')}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition bg-[#2F3E4E] text-white"
              >
                Claims
              </button>
              <button
                onClick={() => setTab('medicaidPayouts')}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition bg-white text-[#2F3E4E] border border-[#D9E1E8] hover:border-[#7A8F79] hover:text-[#7A8F79]"
              >
                Medicaid Payouts
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <CarcLookupModal showAdminTools />
            <MedicaidStatusCodeModal showAdminTools />
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
              onClick={() => { if (bulkMode) openAddModal(); else setShowBulkPrompt(true) }}
              className="flex items-center gap-1.5 bg-[#7A8F79] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2F3E4E] transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Claim
            </button>
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
                  Not found in portal — add the claim manually first
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

          <label className="flex items-center gap-2 text-sm text-[#2F3E4E] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideDemo}
              onChange={e => setHideDemo(e.target.checked)}
              className="w-4 h-4 accent-[#7A8F79] cursor-pointer"
            />
            Hide demo
          </label>

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

        {/* Claims list */}
        {loading ? (
          <div className="text-center text-[#7A8F79] py-16">Loading…</div>
        ) : claims.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-[#7A8F79] shadow-sm">
            No claims yet. Add one to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAll.map(uc => {
                  const eobs = eobMap[uc.id] || []
                  const isOpen = selectedClaimId === uc.id

                  // Build the resubmission chain (originals tucked under this card)
                  const chainColors = ['#D97706', '#EA580C', '#DC2626', '#991B1B']
                  const chainBgs   = ['#FFFBEB', '#FFF7ED', '#FEF2F2', '#FFF1F2']
                  const originals: CommercialClaim[] = []
                  if (uc.resubmissionOf) {
                    let cur: CommercialClaim = uc
                    const seen = new Set<string>()
                    while (cur.resubmissionOf && claimByClaimId.has(cur.resubmissionOf) && !seen.has(cur.resubmissionOf)) {
                      seen.add(cur.resubmissionOf)
                      const orig = claimByClaimId.get(cur.resubmissionOf)!
                      originals.push(orig)
                      cur = orig
                    }
                  }

                  return (
                    <Fragment key={uc.id}>
                      <AdminClaimCard
                        uc={uc}
                        eobs={eobs}
                        eobUploading={eobUploading}
                        isOpen={isOpen}
                        onToggle={() => {
                          if (isOpen) { setSelectedClaimId(null) }
                          else { setSelectedClaimId(uc.id) }
                        }}
                        onEobUpload={file => handleEobUpload(uc, file)}
                        onOpenChain={id => { setSelectedClaimId(id) }}
                      />

                      {/* Resubmission chain: original claims tucked under card */}
                      {originals.map((orig, depth) => {
                        const color = chainColors[Math.min(depth, chainColors.length - 1)]
                        const bg    = chainBgs[Math.min(depth, chainBgs.length - 1)]
                        return (
                          <div
                            key={`orig-${orig.id}`}
                            className="flex items-center gap-3 px-3 py-1.5 text-xs cursor-pointer transition-opacity hover:opacity-75 -mt-1 rounded-b-lg"
                            style={{
                              marginLeft: `${(depth + 1) * 12}px`,
                              background: bg,
                              borderLeft:   `3px solid ${color}`,
                              borderRight:  `1px solid ${color}33`,
                              borderBottom: `1px solid ${color}55`,
                              boxShadow: `0 4px 10px -4px ${color}44`,
                            }}
                            onClick={() => { setSelectedClaimId(orig.id) }}
                            title="Open original claim"
                          >
                            <span className="font-bold uppercase tracking-wide shrink-0 text-[10px]" style={{ color }}>
                              ↻ {depth === 0 ? 'Original' : `Orig. −${depth + 1}`}
                            </span>
                            <span className="font-mono text-[#2F3E4E] font-semibold">{orig.claimId || '—'}</span>
                            <span className="text-[#7A8F79]">{fmtDOS(orig.dosStart, orig.dosStop)}</span>
                            <StageBadge stage={orig.claimStage} />
                            <span className="ml-auto text-[#2F3E4E] font-semibold tabular-nums">{fmt(orig.totalBilled, '$')}</span>
                          </div>
                        )
                      })}
                    </Fragment>
                  )
                })}
          </div>
        )}

      </div>

      {/* Claim Detail Modal */}
      {openedClaim && (
        <ClaimDetailModal
          key={openedClaim.id}
          claim={openedClaim}
          eobDocs={eobMap[openedClaim.id] || []}
          uploading={eobUploading === selectedClaimId}
          deletingId={eobDeleting}
          onClose={() => { setSelectedClaimId(null) }}
          onSaved={updated => {
            setClaims(prev => prev.map(c => c.id === updated.id ? updated : c))
          }}
          onEobUpload={file => handleEobUpload(openedClaim, file)}
          onEobDelete={deleteEob}
          onReloadClaims={loadClaims}
        />
      )}

      {/* Bulk Mode prompt — shown before Add Claim opens, only when Bulk Mode is currently off */}
      {showBulkPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 mx-4">
            <p className="text-sm font-bold text-[#2F3E4E] mb-2">Turn on Bulk Mode?</p>
            <p className="text-xs text-[#7A8F79] mb-5 leading-relaxed">
              Bulk Mode pauses individual provider alert emails while you add claims, so you can send one summary later instead.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowBulkPrompt(false); openAddModal() }}
                className="flex-1 border border-[#D9E1E8] text-[#7A8F79] text-sm font-semibold py-2 rounded-xl hover:border-[#7A8F79] hover:text-[#2F3E4E] transition"
              >
                No
              </button>
              <button
                onClick={() => { setShowBulkPrompt(false); toggleBulkMode(); openAddModal() }}
                className="flex-1 bg-[#2F3E4E] text-white text-sm font-semibold py-2 rounded-xl hover:bg-[#7A8F79] transition"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Claim Modal */}
      {showAddModal && (() => {
        const PAYER_OPTIONS = ['', 'Anthem/BCBS', 'Fidelis', 'UHC', 'Medicaid', 'Univera', 'IHA']
        const primaryIsMedicaid = addForm.primaryPayer === 'Medicaid'
        const secondaryIsMedicaid = addForm.secondaryPayer === 'Medicaid'
        const fi = 'w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'
        const lbl = 'block text-xs font-semibold text-[#2F3E4E] mb-1'
        const sec = 'text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3 border-t border-[#D9E1E8] pt-4'
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9E1E8]">
                <h2 className="text-lg font-bold text-[#2F3E4E]">Add Claim Manually</h2>
                <div className="flex items-center gap-2">
                  <select value={addForm.claimStage || 'Draft'} onChange={e => setAddForm(f => ({ ...f, claimStage: e.target.value }))}
                    className="text-xs border border-[#D9E1E8] rounded-lg px-2 py-1.5 text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] bg-white">
                    {CLAIM_STAGES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button onClick={() => setShowAddModal(false)} className="text-[#7A8F79] hover:text-[#2F3E4E] text-xl leading-none">✕</button>
                </div>
              </div>

              <form onSubmit={submitClaim} className="px-6 py-5 space-y-6">

                {addError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{addError}</div>
                )}

                {/* Claim Starters */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3">Claim Starters</p>
                  <div className="grid grid-cols-3 gap-4 items-start">
                    <div ref={providerRef} className="relative">
                      <label className={lbl}>Provider Name <span className="text-red-500">*</span></label>
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
                              <span className="font-semibold">{formalName(n) || n.displayName}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className={lbl}>Primary Payer</label>
                      <select
                        value={addForm.primaryPayer || ''}
                        onChange={e => setAddForm(f => ({ ...f, primaryPayer: e.target.value, secondaryPayer: e.target.value === 'Medicaid' ? '' : f.secondaryPayer }))}
                        className={fi}
                      >
                        {PAYER_OPTIONS.map(p => <option key={p} value={p}>{p || '— Select —'}</option>)}
                      </select>
                    </div>
                    {!primaryIsMedicaid && (
                      <div>
                        <label className={lbl}>Secondary Payer</label>
                        <select value={addForm.secondaryPayer || ''} onChange={e => setAddForm(f => ({ ...f, secondaryPayer: e.target.value }))} className={fi}>
                          {PAYER_OPTIONS.map(p => <option key={p} value={p}>{p || '— None —'}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Claim Info */}
                <div>
                  <p className={sec}>Claim Info</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={lbl}>{primaryIsMedicaid ? 'Patient Ctrl #' : 'Claim ID'}</label>
                      <input type="text" value={addForm.claimId || ''} onChange={e => setAddForm(f => ({ ...f, claimId: e.target.value }))} className={fi} />
                    </div>
                    <div>
                      <label className={lbl}>Hours Billed</label>
                      <input type="number" min="0" max="999" step="1" value={addForm.hours || ''}
                        onChange={e => setAddForm(f => ({ ...f, hours: e.target.value.slice(0, 3) }))} className={fi} />
                    </div>
                    <div>
                      <label className={lbl}>Submit Date</label>
                      <DateInput key={`${modalResetKey}-submitDate`} ref={submitDateRef} nextRef={dosStartRef} value={addForm.submitDate || ''} onChange={e => setAddForm(f => ({ ...f, submitDate: e.target.value }))} className={fi} />
                    </div>
                    <div>
                      <label className={lbl}>DOS Start</label>
                      <DateInput key={`${modalResetKey}-dosStart`} ref={dosStartRef} nextRef={dosStopRef} value={addForm.dosStart || ''} onChange={e => setAddForm(f => ({ ...f, dosStart: e.target.value }))} className={fi} />
                    </div>
                    <div>
                      <label className={lbl}>DOS Stop</label>
                      <DateInput key={`${modalResetKey}-dosStop`} ref={dosStopRef} value={addForm.dosStop || ''} onChange={e => setAddForm(f => ({ ...f, dosStop: e.target.value }))} className={fi} />
                    </div>
                    <div>
                      <label className={lbl}>Total Billed</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                        <input type="number" step="0.01" min="0" value={addForm.totalBilled || ''} onChange={e => setAddForm(f => ({ ...f, totalBilled: e.target.value }))} className={`${fi} pl-6`} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Insurance */}
                <div>
                  <p className={sec}>Primary Insurance</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={lbl}>Allowed Amt</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                        <input type="number" step="0.01" min="0" value={addForm.primaryAllowedAmt || ''} onChange={e => setAddForm(f => ({ ...f, primaryAllowedAmt: e.target.value }))} className={`${fi} pl-6`} />
                      </div>
                    </div>
                    <div>
                      <label className={lbl}>Paid Amt</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                        <input type="number" step="0.01" min="0" value={addForm.primaryPaidAmt || ''} onChange={e => setAddForm(f => ({ ...f, primaryPaidAmt: e.target.value }))} className={`${fi} pl-6`} />
                      </div>
                    </div>
                    <div>
                      <label className={lbl}>Processed Date</label>
                      <DateInput key={`${modalResetKey}-primPaid`} ref={primPaidDateRef} nextRef={primaryIsMedicaid ? finalDateRef : secPaidDateRef} value={addForm.primaryPaidDate || ''} onChange={e => setAddForm(f => ({ ...f, primaryPaidDate: e.target.value }))} className={fi} />
                      {primaryIsMedicaid && addForm.primaryPaidDate && (() => {
                        const info = calcMedicaidCycleInfo(addForm.primaryPaidDate)
                        return info ? (
                          <p className="text-xs text-[#7A8F79] mt-1">Cycle {info.cycle} · Deposits {new Date(info.depositDateStr + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</p>
                        ) : null
                      })()}
                    </div>
                    <div>
                      <label className={lbl}>Provider Writeoff</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                        <input type="number" step="0.01" min="0" value={addForm.primaryCO || ''} onChange={e => setAddForm(f => ({ ...f, primaryCO: e.target.value }))} className={`${fi} pl-6`} />
                      </div>
                    </div>
                    <div>
                      <label className={lbl}>Paid To</label>
                      <input type="text" value={addForm.primaryPaidTo || ''} onChange={e => setAddForm(f => ({ ...f, primaryPaidTo: e.target.value }))} className={fi} />
                    </div>
                    <div>
                      <label className={lbl}>{primaryIsMedicaid ? 'Payer Claim #' : 'Check #'}</label>
                      <input type="text" value={addForm.primaryCheckNum || ''} onChange={e => setAddForm(f => ({ ...f, primaryCheckNum: e.target.value }))} className={fi} />
                    </div>
                  </div>
                </div>

                {/* Secondary Insurance — hidden when primary is Medicaid */}
                {!primaryIsMedicaid && (
                  <div>
                    <p className={sec}>Secondary Insurance</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className={lbl}>Allowed Amt</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                          <input type="number" step="0.01" min="0" value={addForm.secondaryAllowedAmt || ''} onChange={e => setAddForm(f => ({ ...f, secondaryAllowedAmt: e.target.value }))} className={`${fi} pl-6`} />
                        </div>
                      </div>
                      <div>
                        <label className={lbl}>Paid Amt</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                          <input type="number" step="0.01" min="0" value={addForm.secondaryPaidAmt || ''} onChange={e => setAddForm(f => ({ ...f, secondaryPaidAmt: e.target.value }))} className={`${fi} pl-6`} />
                        </div>
                      </div>
                      <div>
                        <label className={lbl}>Processed Date</label>
                        <DateInput key={`${modalResetKey}-secPaid`} ref={secPaidDateRef} nextRef={finalDateRef} value={addForm.secondaryPaidDate || ''} onChange={e => setAddForm(f => ({ ...f, secondaryPaidDate: e.target.value }))} className={fi} />
                        {secondaryIsMedicaid && addForm.secondaryPaidDate && (() => {
                          const info = calcMedicaidCycleInfo(addForm.secondaryPaidDate)
                          return info ? (
                            <p className="text-xs text-[#7A8F79] mt-1">Cycle {info.cycle} · Deposits {new Date(info.depositDateStr + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</p>
                          ) : null
                        })()}
                      </div>
                      <div>
                        <label className={lbl}>Provider Writeoff</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                          <input type="number" step="0.01" min="0" value={addForm.secondaryCO || ''} onChange={e => setAddForm(f => ({ ...f, secondaryCO: e.target.value }))} className={`${fi} pl-6`} />
                        </div>
                      </div>
                      <div>
                        <label className={lbl}>Paid To</label>
                        <input type="text" value={addForm.secondaryPaidTo || ''} onChange={e => setAddForm(f => ({ ...f, secondaryPaidTo: e.target.value }))} className={fi} />
                      </div>
                      <div>
                        <label className={lbl}>{secondaryIsMedicaid ? 'Payer Claim #' : 'Check #'}</label>
                        <input type="text" value={addForm.secondaryCheckNum || ''} onChange={e => setAddForm(f => ({ ...f, secondaryCheckNum: e.target.value }))} className={fi} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div>
                  <p className={sec}>Summary</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={lbl}>Total Reimbursed</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                        <input type="number" step="0.01" min="0" value={addForm.totalReimbursed || ''} onChange={e => setAddForm(f => ({ ...f, totalReimbursed: e.target.value }))} className={`${fi} pl-6`} />
                      </div>
                    </div>
                    <div>
                      <label className={lbl}>Remaining Balance</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#2F3E4E] pointer-events-none select-none">$</span>
                        <input type="number" step="0.01" min="0" value={addForm.remainingBalance || ''} onChange={e => setAddForm(f => ({ ...f, remainingBalance: e.target.value }))} className={`${fi} pl-6`} />
                      </div>
                    </div>
                    <div>
                      <label className={lbl}>Date Fully Finalized{(primaryIsMedicaid || secondaryIsMedicaid) && <span className="text-[#7A8F79] font-normal normal-case text-[10px] ml-1">(auto from deposit)</span>}</label>
                      <DateInput ref={finalDateRef} value={addForm.dateFullyFinalized || ''} onChange={e => setAddForm(f => ({ ...f, dateFullyFinalized: e.target.value }))} className={fi} />
                    </div>
                    <div>
                      <label className={lbl}>Paid Date</label>
                      <DateInput value={addForm.checkReceivedDate || ''} onChange={e => setAddForm(f => ({ ...f, checkReceivedDate: e.target.value }))} className={fi} />
                    </div>
                    <div>
                      <label className={lbl}>Avg Hourly Rate</label>
                      <div className={`${fi} bg-[#F4F6F5] cursor-default text-[#2F3E4E]`}>
                        {addForm.primaryAllowedAmt && addForm.hours && Number(addForm.hours) > 0
                          ? `$${(Number(addForm.primaryAllowedAmt) / Number(addForm.hours)).toFixed(2)}`
                          : '—'}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className={lbl}>Remark Codes</label>
                      <input type="text" value={addForm.remarkCodes || ''} onChange={e => setAddForm(f => ({ ...f, remarkCodes: e.target.value }))}
                        placeholder="e.g. CO-45, N130" className={fi} />
                    </div>
                    <div className="col-span-2">
                      <label className={lbl}>Processing Notes</label>
                      <textarea rows={2} value={addForm.processingNotes || ''} onChange={e => setAddForm(f => ({ ...f, processingNotes: e.target.value }))}
                        className={`${fi} resize-none`} />
                    </div>
                  </div>
                </div>

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
        )
      })()}

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
                <DateInput
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

// ─── Medicaid Payouts ─────────────────────────────────────────────────────────
// One row per nurse per pay cycle (server-aggregated in the API route) — a
// simple, screenshot-friendly grid so admin can show a nurse without portal
// access what she was paid for a given cycle. Deliberately not the full
// nurse-side Pay Log UI (claim-level breakdown, received-checkbox tracking) —
// just Nurse / Payout Date / Amount, filterable by nurse and cycle.

type MedicaidPayoutRow = {
  nurseId: string
  nurseName: string
  estPayCycle: number
  depositDate: string | null
  amount: number
}

function fmtMoney(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPayoutDate(v: string | null): string {
  if (!v) return 'Pending'
  const [y, m, d] = v.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function MedicaidPayoutsTab({ setTab }: { setTab: (t: ClaimsPageTab) => void }) {
  const [rows, setRows] = useState<MedicaidPayoutRow[]>([])
  const [loading, setLoading] = useState(true)
  const [nurseSearch, setNurseSearch] = useState('')
  const [cycleFilter, setCycleFilter] = useState('')

  useEffect(() => {
    fetch('/api/admin/medicaid-payouts', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRows(data) })
      .finally(() => setLoading(false))
  }, [])

  const cycleOptions = useMemo(() => {
    const cycles = Array.from(new Set(rows.map(r => r.estPayCycle))).sort((a, b) => b - a)
    return cycles.map(c => ({ value: String(c), label: `Cycle ${c} — ${payCycleDateLabel(c)}` }))
  }, [rows])

  const filtered = rows.filter(r => {
    if (nurseSearch && !r.nurseName.toLowerCase().includes(nurseSearch.toLowerCase())) return false
    if (cycleFilter && String(r.estPayCycle) !== cycleFilter) return false
    return true
  })

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6">
      <div className="max-w-screen-xl mx-auto">

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#2F3E4E]"><span className="text-[#7A8F79] italic">ad</span>Claims</h1>
            <p className="text-sm text-[#7A8F79] mt-0.5">Medicaid payouts by nurse and pay cycle.</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setTab('claims')}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition bg-white text-[#2F3E4E] border border-[#D9E1E8] hover:border-[#7A8F79] hover:text-[#7A8F79]"
              >
                Claims
              </button>
              <button
                onClick={() => setTab('medicaidPayouts')}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition bg-[#2F3E4E] text-white"
              >
                Medicaid Payouts
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-wrap items-end gap-3">
          <div className="w-64">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] mb-1">Nurse</label>
            <input
              value={nurseSearch}
              onChange={e => setNurseSearch(e.target.value)}
              placeholder="Search by nurse name…"
              className="w-full h-[34px] border border-[#D9E1E8] rounded-lg px-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            />
          </div>
          <div className="w-64">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] mb-1">Pay Cycle</label>
            <select
              value={cycleFilter}
              onChange={e => setCycleFilter(e.target.value)}
              className="w-full h-[34px] border border-[#D9E1E8] rounded-lg px-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            >
              <option value="">All cycles</option>
              {cycleOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          {(nurseSearch || cycleFilter) && (
            <button
              onClick={() => { setNurseSearch(''); setCycleFilter('') }}
              className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition h-[34px]"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <p className="text-sm text-[#7A8F79] p-6">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[#7A8F79] p-6">No Medicaid payouts match these filters.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D9E1E8] text-left text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">
                  <th className="px-4 py-2.5">Nurse</th>
                  <th className="px-4 py-2.5">Payout Date</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={`${r.nurseId}:${r.estPayCycle}`} className="border-b border-[#D9E1E8] last:border-0 hover:bg-[#F4F6F5] transition">
                    <td className="px-4 py-2.5 font-semibold text-[#2F3E4E]">{r.nurseName}</td>
                    <td className="px-4 py-2.5 text-[#2F3E4E]">{fmtPayoutDate(r.depositDate)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[#2F3E4E]">{fmtMoney(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}

export default function AdminClaimsPage() {
  const [tab, setTab] = useState<ClaimsPageTab>('claims')
  return tab === 'claims' ? <ClaimsTab setTab={setTab} /> : <MedicaidPayoutsTab setTab={setTab} />
}
