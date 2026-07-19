'use client'

import { useState, useEffect, useRef } from 'react'
import PortalMessages from '../../components/PortalMessages'
import { payCycleDateLabel, calcMedicaidCycleInfo } from '../../../lib/medicaidPayCycle'

// ── Search helper — checks every string/number field on a claim ──────────────
function claimMatchesSearch(c: Claim, q: string): boolean {
  if (!q.trim()) return true
  const term = q.toLowerCase().trim()
  const candidates = [
    c.claimId, c.providerName, c.claimStage,
    c.primaryPayer, c.primaryPaidTo,
    c.secondaryPayer, c.secondaryPaidTo,
    c.processingNotes, c.resubmissionOf,
    c.totalBilled      != null ? c.totalBilled.toString()      : null,
    c.totalReimbursed  != null ? c.totalReimbursed.toString()  : null,
    c.remainingBalance != null ? c.remainingBalance.toString() : null,
    c.primaryAllowedAmt  != null ? c.primaryAllowedAmt.toString()  : null,
    c.primaryPaidAmt     != null ? c.primaryPaidAmt.toString()     : null,
    c.secondaryAllowedAmt != null ? c.secondaryAllowedAmt.toString() : null,
    c.secondaryPaidAmt   != null ? c.secondaryPaidAmt.toString()   : null,
    c.dosStart         ? new Date(c.dosStart).toLocaleDateString('en-US', { timeZone: 'UTC' })         : null,
    c.dosStop          ? new Date(c.dosStop).toLocaleDateString('en-US', { timeZone: 'UTC' })          : null,
    c.primaryPaidDate  ? new Date(c.primaryPaidDate).toLocaleDateString('en-US', { timeZone: 'UTC' })  : null,
    c.secondaryPaidDate ? new Date(c.secondaryPaidDate).toLocaleDateString('en-US', { timeZone: 'UTC' }) : null,
    c.dateFullyFinalized ? new Date(c.dateFullyFinalized).toLocaleDateString('en-US', { timeZone: 'UTC' }) : null,
  ]
  return candidates.some(f => f && f.toLowerCase().includes(term))
}

type Claim = {
  id: string
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
  secondaryPayer: string | null
  secondaryAllowedAmt: number | null
  secondaryCO: number | null
  secondaryPaidAmt: number | null
  secondaryPaidDate: string | null
  secondaryPaidTo: string | null
  totalReimbursed: number | null
  remainingBalance: number | null
  dateFullyFinalized: string | null
  checkReceivedDate: string | null
  resubmissionOf: string | null
  processingNotes: string | null
  updatedAt: string
}

type MedicaidClaim = {
  id: string
  patientCtrlNum: string
  payerCtrlNum: string | null
  dosStart: string | null
  dosStop: string | null
  totalCharge: number
  paidAmount: number | null
  processedDate: string | null
  estPayCycle: number | null
  depositDate: string | null
  statusCodes: string[]
  notes: string | null
}

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

function maxAllowed(c: Claim): number | null {
  const vals = [c.primaryAllowedAmt, c.secondaryAllowedAmt].filter((v): v is number => v != null)
  if (vals.length === 0) return null
  return Math.max(...vals)
}

function isMedicaidPayer(name: string | null): boolean {
  return !!name && name.toLowerCase().includes('medicaid')
}

function payDateCycleLabel(paidDate: string | null, payerName: string | null): string {
  if (!paidDate) return '—'
  if (isMedicaidPayer(payerName)) {
    const info = calcMedicaidCycleInfo(paidDate.slice(0, 10))
    if (info) return `Cycle ${info.cycle} · ${fmtDate(paidDate)}`
  }
  return fmtDate(paidDate)
}

// ── Header (sage) / value (navy) cell used throughout the claim card grid ──
function Cell({ label, value, valueClass = 'text-[#2F3E4E]' }: { label?: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      {label
        ? <p className="text-[10px] uppercase tracking-wide text-[#7A8F79] font-semibold leading-tight">{label}</p>
        : <p className="text-[10px] leading-tight invisible">&nbsp;</p>}
      <p className={`text-xs font-semibold leading-tight mt-0.5 ${valueClass}`}>{value}</p>
    </div>
  )
}

// ── Single EOB entry point — "Awaiting EOB" when none uploaded, otherwise opens a picker ──
function EobButton({ eobDocs, onOpen }: { eobDocs: { id: string; fileName: string }[]; onOpen: (doc: { id: string; fileName: string }) => void }) {
  const [open, setOpen] = useState(false)
  if (eobDocs.length === 0) {
    return <span className="text-[10px] font-semibold text-[#7A8F79] bg-[#F4F6F5] border border-[#D9E1E8] px-2.5 py-1 rounded-lg whitespace-nowrap">Awaiting EOB</span>
  }
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] border border-[#D9E1E8] hover:border-[#7A8F79] px-2.5 py-1 rounded-lg transition whitespace-nowrap"
      >
        📎 View EOB{eobDocs.length > 1 ? ` (${eobDocs.length})` : ''}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 bg-white border border-[#D9E1E8] rounded-lg shadow-lg overflow-hidden min-w-[180px]">
            {eobDocs.map((doc, i) => (
              <button
                key={doc.id}
                onClick={() => { onOpen(doc); setOpen(false) }}
                className="block w-full text-left px-3 py-2 text-xs text-[#2F3E4E] hover:bg-[#F4F6F5] truncate"
              >
                {eobDocs.length > 1 ? `EOB ${i + 1} — ` : ''}{doc.fileName}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Primary/Secondary payer detail block (Row 2 / Row 3 of the expanded card) ──
function PayerSection({ label, payer, submitDate, allowedAmt, paidAmt, coAmt, balance, paidDate, claimId, eobDocs, onOpenEob }: {
  label: 'PRIMARY' | 'SECONDARY'
  payer: string | null
  submitDate: string | null
  allowedAmt: number | null
  paidAmt: number | null
  coAmt: number | null
  balance: number | null
  paidDate: string | null
  claimId: string | null
  eobDocs?: { id: string; fileName: string }[]
  onOpenEob?: (doc: { id: string; fileName: string }) => void
}) {
  const short = label === 'PRIMARY' ? 'Primary' : 'Second.'
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">{label} — {payer || '—'}</p>
        <p className="text-[10px] uppercase tracking-wide text-[#7A8F79] font-semibold">Check Date/Pay Cycle</p>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-y-2 gap-x-2 items-start">
        <div className="flex justify-center">
          {eobDocs && onOpenEob ? <EobButton eobDocs={eobDocs} onOpen={onOpenEob} /> : null}
        </div>
        <Cell label="Submitted" value={fmtDate(submitDate)} />
        <Cell label={`${short} Allow`} value={fmt(allowedAmt, '$')} />
        <Cell label={`${short} Paid`} value={fmt(paidAmt, '$')} valueClass="text-[#7A8F79]" />
        <Cell label={`${short} WO`} value={fmt(coAmt, '$')} />
        <Cell label="Balance" value={fmt(balance, '$')} valueClass={(balance || 0) > 0 ? 'text-red-600' : 'text-[#2F3E4E]'} />
        <Cell value={payDateCycleLabel(paidDate, payer)} />
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#D9E1E8]">
        <p className="text-[10px] text-[#7A8F79]"><span className="font-semibold uppercase tracking-wide">Remark Codes:</span> —</p>
        <p className="text-[10px] text-right"><span className="font-semibold uppercase tracking-wide text-[#7A8F79]">Payer Claim # </span><span className="text-[#2F3E4E] font-mono">{claimId || '—'}</span></p>
      </div>
    </div>
  )
}

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
    s === 'appeal needed' ? 'bg-fuchsia-100 text-fuchsia-800' :
    s === 'check wait' ? 'bg-red-800 text-gray-100' :
    'bg-gray-900 text-gray-200'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{stage}</span>
}

type ClaimGroup = { primary: Claim; chain: Claim[] }

// Walks the full resubmission chain upward — handles chains of any depth
function groupClaims(claims: Claim[]): ClaimGroup[] {
  const byClaimId = new Map(claims.filter(c => c.claimId).map(c => [c.claimId!, c]))
  const superseded = new Set(claims.filter(c => c.resubmissionOf).map(c => c.resubmissionOf!))
  const groups: ClaimGroup[] = []
  for (const c of claims) {
    if (superseded.has(c.claimId || '')) continue
    // Walk backwards through the chain collecting all ancestors
    const chain: Claim[] = []
    let current = c
    while (current.resubmissionOf && byClaimId.has(current.resubmissionOf)) {
      const ancestor = byClaimId.get(current.resubmissionOf)!
      chain.push(ancestor)
      current = ancestor
    }
    groups.push({ primary: c, chain })
  }
  return groups
}

function ClaimRow({ primary: c, chain, eobDocs, onClaimPaid }: ClaimGroup & { eobDocs: { id: string; fileName: string }[]; onClaimPaid: (claimId: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  // Track which EOB is open: { doc, url, loading }
  const [activeEob, setActiveEob] = useState<{ id: string; fileName: string } | null>(null)
  const [eobUrlCache, setEobUrlCache] = useState<Record<string, string>>({})
  const [eobLoading, setEobLoading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Check Received popup state
  const [checkboxChecked, setCheckboxChecked] = useState(false)
  const [showCheckPopup, setShowCheckPopup] = useState(false)
  const [checkDate, setCheckDate] = useState('')
  const [submittingCheck, setSubmittingCheck] = useState(false)

  const isCheckWait = (c.claimStage || '').toLowerCase() === 'check wait'

  function openCheckPopup(e: React.MouseEvent) {
    e.stopPropagation()
    setCheckboxChecked(true)
    setShowCheckPopup(true)
  }

  function cancelCheckPopup() {
    setShowCheckPopup(false)
    setCheckboxChecked(false)
    setCheckDate('')
  }

  async function submitCheckReceived() {
    if (!checkDate) return
    setSubmittingCheck(true)
    const res = await fetch(`/api/nurse/claims/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ checkReceivedDate: checkDate }),
    })
    setSubmittingCheck(false)
    if (res.ok) {
      setShowCheckPopup(false)
      setCheckboxChecked(false)
      setCheckDate('')
      onClaimPaid(c.id)
    }
  }

  async function openEob(doc: { id: string; fileName: string }) {
    setActiveEob(doc)
    if (eobUrlCache[doc.id]) return  // already cached
    setEobLoading(true)
    const res = await fetch(`/api/nurse/documents/${doc.id}`, { credentials: 'include' })
    const data = await res.json()
    if (data.url) setEobUrlCache(prev => ({ ...prev, [doc.id]: data.url }))
    setEobLoading(false)
  }

  const activeUrl = activeEob ? (eobUrlCache[activeEob.id] ?? null) : null

  async function saveToDevice() {
    if (!activeUrl || !activeEob) return
    const resp = await fetch(activeUrl)
    const blob = await resp.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = activeEob.fileName || 'EOB.pdf'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function printEob() {
    iframeRef.current?.contentWindow?.print()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* ── Row 1 — always visible, click (or the arrow) to expand ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(e => !e)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(x => !x) } }}
        className={`w-full text-left px-4 py-3 cursor-pointer transition-colors ${expanded ? 'bg-[#EEF2EC] hover:bg-[#E7EDE5]' : 'hover:bg-[#F4F6F5]'}`}
      >
        {/* Resubmit indicator — only rendered when present, no blank row otherwise */}
        {c.resubmissionOf && (
          <div className="mb-1.5">
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              ↻ Resubmission
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-y-2 gap-x-2 items-center">
          <div className="flex justify-center">
            <span className="text-[#7A8F79] text-xs">{expanded ? '▲' : '▼'}</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <p className="text-xs font-semibold text-[#2F3E4E] leading-tight">{fmtDate(c.dosStart)}</p>
            <p className="text-xs font-semibold text-[#2F3E4E] leading-tight">{fmtDate(c.dosStop)}</p>
          </div>
          <Cell label="Total Billed" value={fmt(c.totalBilled, '$')} />
          <Cell label="Max Allowed" value={fmt(maxAllowed(c), '$')} />
          <Cell label="Total Paid" value={fmt(c.totalReimbursed, '$')} valueClass="text-[#7A8F79]" />
          <Cell label="Hour/Unit" value={c.hours != null ? c.hours.toLocaleString('en-US') : '—'} />
          <div className="flex flex-col items-center text-center gap-1">
            <p className="text-[10px] uppercase tracking-wide text-[#7A8F79] font-semibold leading-tight">Status</p>
            {isCheckWait && (
              <div className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={checkboxChecked}
                  onChange={e => { if (e.target.checked) openCheckPopup(e as any) }}
                  onClick={e => e.stopPropagation()}
                  className="w-3 h-3 cursor-pointer accent-[#2F3E4E]"
                  aria-label="Mark check as received"
                />
                <span className="text-[9px] text-[#7A8F79] whitespace-nowrap">Check Received?</span>
              </div>
            )}
            <StageBadge stage={c.claimStage} />
          </div>
        </div>
      </div>

      {/* ── Expanded details ── */}
      {expanded && (
        <div className="border-t border-[#D9E1E8] px-4 py-4 space-y-4 bg-[#FAFBFC]">

          {/* Row 2 — Primary payer */}
          {(c.primaryPayer || c.primaryPaidAmt != null) && (
            <PayerSection
              label="PRIMARY"
              payer={c.primaryPayer}
              submitDate={c.submitDate}
              allowedAmt={c.primaryAllowedAmt}
              paidAmt={c.primaryPaidAmt}
              coAmt={c.primaryCO}
              balance={c.remainingBalance}
              paidDate={c.primaryPaidDate}
              claimId={c.claimId}
              eobDocs={eobDocs}
              onOpenEob={openEob}
            />
          )}

          {/* Row 3 — Secondary payer */}
          {(c.secondaryPayer || c.secondaryPaidAmt != null) && (
            <div className="pt-3 border-t border-[#D9E1E8]">
              <PayerSection
                label="SECONDARY"
                payer={c.secondaryPayer}
                submitDate={c.submitDate}
                allowedAmt={c.secondaryAllowedAmt}
                paidAmt={c.secondaryPaidAmt}
                coAmt={c.secondaryCO}
                balance={c.remainingBalance}
                paidDate={c.secondaryPaidDate}
                claimId={c.claimId}
              />
            </div>
          )}

          {/* Row 4 — Comments (future: auto-populated CARC/RARC codes) */}
          <div className="pt-3 border-t border-[#D9E1E8]">
            <p className="text-[10px] text-[#7A8F79] font-semibold uppercase tracking-wide mb-1">Comments</p>
            <p className="text-sm text-[#2F3E4E] whitespace-pre-line">{c.processingNotes || '—'}</p>
          </div>

          {/* Prior submissions chain */}
          {chain.length > 0 && (
            <div className="pt-3 border-t border-[#D9E1E8]">
              <p className="text-xs text-[#7A8F79] font-semibold uppercase tracking-wide mb-2">
                Prior Submission{chain.length !== 1 ? 's' : ''} — {chain.length} in chain
              </p>
              <div className="space-y-2">
                {chain.map((orig, i) => (
                  <div key={orig.id} className="rounded-lg px-3 py-2.5 border-l-4 border-red-200 bg-red-50">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">
                        #{chain.length - i} — superseded
                      </span>
                      <span className="font-mono text-xs text-[#2F3E4E]">{orig.claimId || '—'}</span>
                      <span className="text-xs text-[#7A8F79]">{fmtDOS(orig.dosStart, orig.dosStop)}</span>
                      <StageBadge stage={orig.claimStage} />
                      <span className="text-xs text-[#2F3E4E]">Billed: {fmt(orig.totalBilled, '$')}</span>
                    </div>
                    {orig.processingNotes && (
                      <p className="text-[11px] text-[#7A8F79] mt-1 truncate">
                        {orig.processingNotes.split('\n').find(l => l.trim())}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Check Received Popup */}
      {showCheckPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={cancelCheckPopup}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-72 mx-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-[#2F3E4E] mb-3">Received Date?</p>
            <input
              type="date"
              value={checkDate}
              onChange={e => setCheckDate(e.target.value)}
              className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={cancelCheckPopup}
                className="flex-1 border border-[#D9E1E8] text-[#7A8F79] text-sm font-semibold py-2 rounded-xl hover:border-[#7A8F79] hover:text-[#2F3E4E] transition"
              >
                Cancel
              </button>
              <button
                onClick={submitCheckReceived}
                disabled={!checkDate || submittingCheck}
                className="flex-1 bg-[#2F3E4E] text-white text-sm font-semibold py-2 rounded-xl hover:bg-[#7A8F79] transition disabled:opacity-40"
              >
                {submittingCheck ? 'Saving…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EOB Viewer Modal */}
      {activeEob && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60" onClick={e => { if (e.target === e.currentTarget) setActiveEob(null) }}>
          <div className="flex flex-col bg-white rounded-t-2xl mt-10 mx-2 sm:mx-auto sm:w-full sm:max-w-4xl flex-1 overflow-hidden shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#D9E1E8] flex-shrink-0">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Explanation of Benefits</p>
                <p className="text-sm font-semibold text-[#2F3E4E]">
                  {c.claimId ? `Claim ${c.claimId}` : 'EOB Document'}{c.primaryPayer ? ` — ${c.primaryPayer}` : ''}
                  {eobDocs.length > 1 && <span className="ml-2 text-xs font-normal text-[#7A8F79]">{activeEob.fileName}</span>}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                {/* Switch between EOBs if multiple */}
                {eobDocs.length > 1 && (
                  <div className="flex gap-1">
                    {eobDocs.map((doc, i) => (
                      <button
                        key={doc.id}
                        onClick={() => openEob(doc)}
                        className={`text-xs px-2 py-1 rounded font-semibold transition ${activeEob.id === doc.id ? 'bg-[#2F3E4E] text-white' : 'bg-[#F4F6F5] text-[#7A8F79] hover:bg-[#D9E1E8]'}`}
                      >
                        EOB {i + 1}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setActiveEob(null)} className="text-[#7A8F79] hover:text-[#2F3E4E] text-2xl leading-none">×</button>
              </div>
            </div>

            {/* Document viewer */}
            <div className="flex-1 overflow-hidden bg-[#F4F6F5]">
              {eobLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-[#7A8F79] font-semibold animate-pulse">Loading document…</p>
                </div>
              ) : activeUrl ? (
                <iframe
                  ref={iframeRef}
                  src={activeUrl}
                  className="w-full h-full border-0"
                  title="EOB Document"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-[#7A8F79]">Could not load document.</p>
                </div>
              )}
            </div>

            {/* Action footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#D9E1E8] bg-white flex-shrink-0">
              <button
                onClick={printEob}
                disabled={!activeUrl}
                className="flex items-center gap-1.5 border border-[#D9E1E8] text-[#2F3E4E] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#F4F6F5] transition disabled:opacity-40"
              >
                🖨 Print
              </button>
              <button
                onClick={saveToDevice}
                disabled={!activeUrl}
                className="flex items-center gap-1.5 bg-[#2F3E4E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-40"
              >
                ⬇ Save to Device
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Medicaid Pay Log Tab ─────────────────────────────────────────────────────

type WeekGroup = {
  depositDate: string      // YYYY-MM-DD or '' for unscheduled
  cycle: number | null
  claims: MedicaidClaim[]
  totalCharge: number
  totalPaid: number
}

function MedicaidPayLogTab({ medicaidClaims, received, onToggleReceived }: {
  medicaidClaims: MedicaidClaim[]
  received: Record<string, string | null>   // depositDate → receivedAt ISO string or null
  onToggleReceived: (depositDate: string, isReceived: boolean) => void
}) {
  const groups = buildWeekGroups(medicaidClaims)
  const scheduledGroups = groups.filter(g => g.depositDate !== '')
  const unscheduled = groups.find(g => g.depositDate === '')

  const totalEverPaid = medicaidClaims.reduce((s, c) => s + (c.paidAmount ?? 0), 0)
  const totalEverCharged = medicaidClaims.reduce((s, c) => s + c.totalCharge, 0)
  const receivedWeeks = scheduledGroups.filter(g => received[g.depositDate] != null)
  const totalReconciled = receivedWeeks.reduce((s, g) => s + g.totalPaid, 0)

  if (medicaidClaims.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <div className="w-14 h-14 rounded-full bg-[#D9E1E8] flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-[#7A8F79]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-[#2F3E4E] font-semibold">No Medicaid claims on file yet</p>
        <p className="text-[#7A8F79] text-sm mt-1">Your weekly pay log will appear here once Medicaid claims are processed.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <div className="bg-white rounded-xl p-2.5 md:p-4 shadow-sm">
          <p className="text-[9px] md:text-xs uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Total Claims</p>
          <p className="text-base md:text-2xl font-bold text-[#2F3E4E] mt-0.5">{medicaidClaims.length}</p>
        </div>
        <div className="bg-white rounded-xl p-2.5 md:p-4 shadow-sm">
          <p className="text-[9px] md:text-xs uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Total Paid</p>
          <p className="text-base md:text-2xl font-bold text-[#2F3E4E] mt-0.5 truncate">{fmt(totalEverPaid, '$')}</p>
        </div>
        <div className="bg-white rounded-xl p-2.5 md:p-4 shadow-sm">
          <p className="text-[9px] md:text-xs uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Reconciled</p>
          <p className="text-base md:text-2xl font-bold text-green-700 mt-0.5 truncate">{fmt(totalReconciled, '$')}</p>
        </div>
      </div>

      {/* Column headers */}
      <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-x-3 px-4 text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">
        <span>Patient Ctrl #</span>
        <span>Payer Ctrl #</span>
        <span>Charge</span>
        <span>Paid</span>
        <span className="w-24 text-right">Received</span>
      </div>

      {/* Scheduled week groups */}
      {scheduledGroups.map(group => {
        const isReceived = received[group.depositDate] != null
        const receivedDate = received[group.depositDate]
        return (
          <div
            key={group.depositDate}
            className={`bg-white rounded-xl shadow-sm overflow-hidden border-l-4 transition-colors ${
              isReceived ? 'border-green-500' : 'border-[#D9E1E8]'
            }`}
          >
            {/* Week header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b border-[#D9E1E8] ${isReceived ? 'bg-green-50' : 'bg-[#F4F6F5]'}`}>
              <div className="flex items-center gap-3 flex-wrap">
                {group.cycle != null && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] bg-white border border-[#D9E1E8] px-2 py-0.5 rounded-full">
                    Cycle {group.cycle}
                  </span>
                )}
                <span className="text-sm font-bold text-[#2F3E4E]">
                  Pay Date: {new Date(group.depositDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                </span>
                <span className="text-xs font-semibold text-[#7A8F79]">
                  {group.claims.length} claim{group.claims.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <div className="text-right">
                  <p className="text-[10px] text-[#7A8F79] uppercase tracking-wide font-semibold">Expected</p>
                  <p className="text-sm font-bold text-[#2F3E4E]">{fmt(group.totalPaid, '$')}</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer group/check select-none">
                  <span className="text-xs font-semibold text-[#7A8F79] group-hover/check:text-[#2F3E4E] transition">
                    {isReceived ? 'Received' : 'Mark received'}
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isReceived}
                      onChange={e => onToggleReceived(group.depositDate, e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isReceived
                        ? 'bg-green-500 border-green-500'
                        : 'bg-white border-[#D9E1E8] group-hover/check:border-[#7A8F79]'
                    }`}>
                      {isReceived && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Received timestamp */}
            {isReceived && receivedDate && (
              <div className="px-4 py-1.5 bg-green-50 border-b border-green-100">
                <p className="text-[10px] text-green-700 font-semibold">
                  ✓ Marked received {new Date(receivedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            )}

            {/* Claim rows */}
            <div className="divide-y divide-[#D9E1E8]">
              {group.claims.map(claim => (
                <div key={claim.id} className="px-4 py-2.5 md:grid md:grid-cols-[2fr_2fr_1fr_1fr_auto] md:gap-x-3 md:items-center">
                  {/* Mobile layout */}
                  <div className="md:hidden">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-[#7A8F79] font-semibold uppercase tracking-wide">Patient Ctrl #</p>
                        <p className="text-xs font-mono font-bold text-[#2F3E4E]">{claim.patientCtrlNum}</p>
                        {claim.payerCtrlNum && (
                          <p className="text-[10px] text-[#7A8F79] mt-0.5 font-mono">{claim.payerCtrlNum}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-[#7A8F79] font-semibold uppercase tracking-wide">Paid</p>
                        <p className="text-xs font-bold text-[#2F3E4E]">{fmt(claim.paidAmount, '$')}</p>
                        <p className="text-[10px] text-[#7A8F79]">of {fmt(claim.totalCharge, '$')}</p>
                      </div>
                    </div>
                    {claim.notes && (
                      <p className="text-[10px] text-[#7A8F79] mt-1 italic line-clamp-2">{claim.notes}</p>
                    )}
                  </div>
                  {/* Desktop layout */}
                  <p className="hidden md:block text-xs font-mono font-semibold text-[#2F3E4E] truncate">{claim.patientCtrlNum}</p>
                  <p className="hidden md:block text-xs font-mono text-[#7A8F79] truncate">{claim.payerCtrlNum || '—'}</p>
                  <p className="hidden md:block text-xs text-[#2F3E4E]">{fmt(claim.totalCharge, '$')}</p>
                  <p className="hidden md:block text-xs font-semibold text-[#2F3E4E]">{fmt(claim.paidAmount, '$')}</p>
                  <div className="hidden md:block w-24">
                    {claim.notes && (
                      <p className="text-[10px] text-[#7A8F79] italic line-clamp-2 text-right">{claim.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Group totals footer */}
            {group.claims.length > 1 && (
              <div className="md:grid md:grid-cols-[2fr_2fr_1fr_1fr_auto] md:gap-x-3 px-4 py-2 border-t border-[#D9E1E8] bg-[#F4F6F5]">
                <p className="hidden md:block text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] col-span-2">Week Total</p>
                <p className="hidden md:block text-xs font-bold text-[#2F3E4E]">{fmt(group.totalCharge, '$')}</p>
                <p className="hidden md:block text-xs font-bold text-[#2F3E4E]">{fmt(group.totalPaid, '$')}</p>
                <div className="hidden md:block w-24" />
                {/* Mobile footer */}
                <div className="md:hidden flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">Week Total</span>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#2F3E4E]">{fmt(group.totalPaid, '$')}</span>
                    <span className="text-[10px] text-[#7A8F79] ml-1">paid / {fmt(group.totalCharge, '$')} charged</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Unscheduled claims */}
      {unscheduled && unscheduled.claims.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border-l-4 border-yellow-300">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#D9E1E8] bg-yellow-50">
            <div>
              <span className="text-sm font-bold text-[#2F3E4E]">Pending / No Deposit Date</span>
              <span className="ml-2 text-xs text-[#7A8F79]">{unscheduled.claims.length} claim{unscheduled.claims.length !== 1 ? 's' : ''}</span>
            </div>
            <span className="text-sm font-bold text-[#2F3E4E]">{fmt(unscheduled.totalPaid, '$')}</span>
          </div>
          <div className="divide-y divide-[#D9E1E8]">
            {unscheduled.claims.map(claim => (
              <div key={claim.id} className="px-4 py-2.5 md:grid md:grid-cols-[2fr_2fr_1fr_1fr_auto] md:gap-x-3 md:items-center">
                <div className="md:hidden">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] text-[#7A8F79] font-semibold uppercase tracking-wide">Patient Ctrl #</p>
                      <p className="text-xs font-mono font-bold text-[#2F3E4E]">{claim.patientCtrlNum}</p>
                      {claim.payerCtrlNum && <p className="text-[10px] text-[#7A8F79] mt-0.5 font-mono">{claim.payerCtrlNum}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-[#7A8F79] font-semibold uppercase tracking-wide">Paid</p>
                      <p className="text-xs font-bold text-[#2F3E4E]">{fmt(claim.paidAmount, '$')}</p>
                      <p className="text-[10px] text-[#7A8F79]">of {fmt(claim.totalCharge, '$')}</p>
                    </div>
                  </div>
                </div>
                <p className="hidden md:block text-xs font-mono font-semibold text-[#2F3E4E] truncate">{claim.patientCtrlNum}</p>
                <p className="hidden md:block text-xs font-mono text-[#7A8F79] truncate">{claim.payerCtrlNum || '—'}</p>
                <p className="hidden md:block text-xs text-[#2F3E4E]">{fmt(claim.totalCharge, '$')}</p>
                <p className="hidden md:block text-xs font-semibold text-[#2F3E4E]">{fmt(claim.paidAmount, '$')}</p>
                <div className="hidden md:block w-24" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grand totals */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-[#7A8F79]">All-time totals</span>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] text-[#7A8F79] uppercase tracking-wide font-semibold">Total Charged</p>
            <p className="text-sm font-bold text-[#2F3E4E]">{fmt(totalEverCharged, '$')}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#7A8F79] uppercase tracking-wide font-semibold">Total Paid</p>
            <p className="text-sm font-bold text-[#2F3E4E]">{fmt(totalEverPaid, '$')}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-green-700 uppercase tracking-wide font-semibold">Reconciled</p>
            <p className="text-sm font-bold text-green-700">{fmt(totalReconciled, '$')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function buildWeekGroups(claims: MedicaidClaim[]): WeekGroup[] {
  const map = new Map<string, MedicaidClaim[]>()
  for (const c of claims) {
    const key = c.depositDate ? c.depositDate.slice(0, 10) : ''
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(c)
  }
  const groups: WeekGroup[] = []
  for (const [depositDate, claimsInGroup] of map.entries()) {
    const cycle = claimsInGroup.find(c => c.estPayCycle != null)?.estPayCycle ?? null
    groups.push({
      depositDate,
      cycle,
      claims: claimsInGroup,
      totalCharge: claimsInGroup.reduce((s, c) => s + c.totalCharge, 0),
      totalPaid: claimsInGroup.reduce((s, c) => s + (c.paidAmount ?? 0), 0),
    })
  }
  // Sort: scheduled weeks newest-first, unscheduled last
  return groups.sort((a, b) => {
    if (!a.depositDate) return 1
    if (!b.depositDate) return -1
    return b.depositDate.localeCompare(a.depositDate)
  })
}

// ─── NurseClaimsPage ──────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear()
const YEARS = ['', ...Array.from({ length: currentYear - 2023 }, (_, i) => String(2024 + i))]

export default function NurseClaimsPage() {
  const [activeTab, setActiveTab] = useState<'claims' | 'paylog'>('claims')
  const [claims, setClaims] = useState<Claim[]>([])
  const [enrolledInBilling, setEnrolledInBilling] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterYear, setFilterYear] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showStickyBar, setShowStickyBar] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  // Map from Claim.id (DB UUID) → array of EOB docs (supports multiple per claim)
  const [eobMap, setEobMap] = useState<Record<string, { id: string; fileName: string }[]>>({})
  const [effectiveTier, setEffectiveTier] = useState<'FREE' | 'BASIC' | 'PRO' | null>(null)

  function handleClaimPaid(claimId: string) {
    setClaims(prev => prev.map(c => c.id === claimId ? { ...c, claimStage: 'Paid' } : c))
  }

  // Pay log state
  const [medicaidClaims, setMedicaidClaims] = useState<MedicaidClaim[]>([])
  const [paylogReceived, setPaylogReceived] = useState<Record<string, string | null>>({})
  const [paylogLoaded, setPaylogLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/nurse/plan', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { effectiveTier: 'FREE' })
      .then(d => setEffectiveTier(d.effectiveTier || 'FREE'))
  }, [])

  useEffect(() => {
    fetch('/api/nurse/claims', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setClaims(data.claims || [])
        setEnrolledInBilling(data.enrolledInBilling ?? null)
        setLoading(false)
      })

    fetch('/api/nurse/documents', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const map: Record<string, { id: string; fileName: string }[]> = {}
        for (const doc of data.documents || []) {
          if (doc.category === 'EOB' && doc.claimId) {
            if (!map[doc.claimId]) map[doc.claimId] = []
            map[doc.claimId].push({ id: doc.id, fileName: doc.fileName })
          }
        }
        setEobMap(map)
      })
  }, [])

  // Load pay log data on first switch to paylog tab
  useEffect(() => {
    if (activeTab !== 'paylog' || paylogLoaded) return
    Promise.all([
      fetch('/api/nurse/medicaid', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/nurse/medicaid/paylog', { credentials: 'include' }).then(r => r.json()),
    ]).then(([claims, received]) => {
      if (Array.isArray(claims)) setMedicaidClaims(claims)
      if (received && typeof received === 'object') setPaylogReceived(received)
      setPaylogLoaded(true)
    })
  }, [activeTab, paylogLoaded])

  async function handleToggleReceived(depositDate: string, isReceived: boolean) {
    setPaylogReceived(prev => ({ ...prev, [depositDate]: isReceived ? new Date().toISOString() : null }))
    await fetch('/api/nurse/medicaid/paylog', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ depositDate, received: isReceived }),
    })
  }

  // Show compact sticky bar when the search+year section scrolls behind the banner
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { rootMargin: '-220px 0px 0px 0px', threshold: 0 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const yearFilteredClaims = filterYear
    ? claims.filter(c => c.dosStart && new Date(c.dosStart).getUTCFullYear().toString() === filterYear)
    : claims

  const searchFilteredClaims = searchQuery
    ? yearFilteredClaims.filter(c => claimMatchesSearch(c, searchQuery))
    : yearFilteredClaims

  const resubIds = new Set(searchFilteredClaims.filter(c => c.resubmissionOf).map(c => c.resubmissionOf as string))
  const activeClaims = searchFilteredClaims.filter(c => !c.claimId || !resubIds.has(c.claimId))

  const totalBilled = activeClaims.reduce((s, c) => s + (c.totalBilled || 0), 0)
  const totalReimbursed = activeClaims.reduce((s, c) => s + (c.totalReimbursed || 0), 0)

  function submitSearch() { setSearchQuery(searchInput) }
  function clearSearch() { setSearchInput(''); setSearchQuery('') }

  if (effectiveTier === 'FREE') {
    return (
      <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8 flex items-start justify-center pt-20">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-[#2F3E4E] mb-2">myProvider Basic Required</h2>
          <p className="text-sm text-[#7A8F79] mb-6">
            Full claim history, EOB access, and reimbursement details are included in the <strong>Basic plan</strong> at $5/month. Contact Coming Home Care to upgrade.
          </p>
          <div className="bg-[#F4F6F5] rounded-xl p-4 text-left space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Basic plan includes</p>
            <p className="text-sm text-[#2F3E4E]">✓ Full claim submission history</p>
            <p className="text-sm text-[#2F3E4E]">✓ Current-year billed, allowed &amp; paid totals</p>
            <p className="text-sm text-[#2F3E4E]">✓ EOB document access</p>
            <p className="text-sm text-[#2F3E4E]">✓ HIPAA-secure claim storage</p>
          </div>
          <p className="text-xs text-[#7A8F79] mt-5">
            Pro plan coming soon — personal document vault, year-end reporting, and tax tools.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8 pl-0 md:pl-0">

      {/* ── Compact sticky bar (mobile only, shown when search+year scrolls off) ── */}
      {showStickyBar && (
        <div className="md:hidden fixed top-[220px] left-0 right-0 z-40 bg-[#F4F6F5]/95 backdrop-blur-sm border-b border-[#D9E1E8] shadow-sm px-3 py-2 flex items-center gap-2">
          {/* Year dropdown */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-[#7A8F79] font-semibold uppercase tracking-wide">Year:</span>
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="text-xs border border-[#D9E1E8] rounded-md px-1.5 py-1 text-[#2F3E4E] bg-white focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
            >
              {YEARS.map(y => <option key={y || 'all'} value={y}>{y || 'All'}</option>)}
            </select>
          </div>
          <div className="w-px h-5 bg-[#D9E1E8] shrink-0" />
          {/* Inline search field */}
          <div className="flex-1 flex items-center bg-white border border-[#D9E1E8] rounded-lg overflow-hidden min-w-0">
            <svg className="w-3.5 h-3.5 text-[#7A8F79] ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitSearch() }}
              placeholder="Search claims…"
              className="flex-1 min-w-0 px-2 py-1.5 text-xs text-[#2F3E4E] focus:outline-none placeholder-[#7A8F79]"
            />
            {/* 🔍 = submit */}
            <button
              onClick={submitSearch}
              className="px-2 py-1.5 text-[#7A8F79] hover:text-[#2F3E4E] transition"
              title="Search"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </button>
            {/* ✕ = clear */}
            {(searchQuery || searchInput) && (
              <button
                onClick={clearSearch}
                className="px-2 py-1.5 text-red-500 hover:text-red-700 transition font-bold text-sm leading-none"
                title="Clear search"
              >✕</button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">my</span>Claims
          </h1>
          <p className="text-sm text-[#7A8F79] mt-1">View the status of your submitted billing claims.</p>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[#D9E1E8] mb-6">
          <button
            onClick={() => setActiveTab('claims')}
            className={`px-5 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
              activeTab === 'claims'
                ? 'border-[#2F3E4E] text-[#2F3E4E]'
                : 'border-transparent text-[#7A8F79] hover:text-[#2F3E4E]'
            }`}
          >
            Claims
          </button>
          <button
            onClick={() => setActiveTab('paylog')}
            className={`px-5 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
              activeTab === 'paylog'
                ? 'border-[#2F3E4E] text-[#2F3E4E]'
                : 'border-transparent text-[#7A8F79] hover:text-[#2F3E4E]'
            }`}
          >
            Medicaid Pay Log
          </button>
        </div>

        <PortalMessages priority="Claims" />

        {/* ── Pay Log Tab ── */}
        {activeTab === 'paylog' && (
          <div className="mt-2">
            {!paylogLoaded ? (
              <div className="text-center text-[#7A8F79] py-16">Loading…</div>
            ) : (
              <MedicaidPayLogTab
                medicaidClaims={medicaidClaims}
                received={paylogReceived}
                onToggleReceived={handleToggleReceived}
              />
            )}
          </div>
        )}

        {activeTab === 'claims' && (<>

        {/* Billing services promo — shown when not enrolled */}
        {enrolledInBilling !== true && (
          <div className="mb-6 bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-[#2F3E4E] px-6 py-5">
              <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-1">Coming Home Care Billing Services</p>
              <h2 className="text-xl font-bold text-white">Let us handle your claims so you can focus on care.</h2>
              <p className="text-sm text-[#D9E1E8] mt-2 max-w-xl">
                When you enroll in our billing program, we submit and track your Medicaid and insurance claims on your behalf — and your claims status will appear right here on this page.
              </p>
            </div>
            <div className="px-6 py-5 grid sm:grid-cols-3 gap-4">
              {[
                { icon: '📋', title: 'Claims Submission', body: 'We prepare and submit your Medicaid, BCBS, and dual-payer claims directly to the correct payers on your behalf.' },
                { icon: '🔍', title: 'Status Tracking', body: 'Track every claim from submission through payment — all in one place, updated each time we review your account.' },
                { icon: '💬', title: 'Dedicated Support', body: 'Have a question about a claim or payment? Our team is reachable directly by email — no automated phone trees.' },
              ].map(item => (
                <div key={item.title} className="flex flex-col gap-1.5 border border-[#D9E1E8] rounded-xl p-4">
                  <span className="text-2xl">{item.icon}</span>
                  <p className="font-semibold text-[#2F3E4E] text-sm">{item.title}</p>
                  <p className="text-xs text-[#7A8F79] leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
              <a
                href="/nurse/onboarding"
                className="inline-flex items-center justify-center gap-2 bg-[#7A8F79] hover:bg-[#657a64] text-white font-semibold px-5 py-2.5 rounded-lg transition text-sm"
              >
                Enroll in Billing Services →
              </a>
              <a
                href="mailto:support@cominghomecare.com?subject=BILLING%3A%20Question%20About%20Billing%20Services"
                className="inline-flex items-center justify-center gap-2 border border-[#D9E1E8] text-[#2F3E4E] hover:border-[#7A8F79] font-semibold px-5 py-2.5 rounded-lg transition text-sm"
              >
                Contact Us
              </a>
            </div>
          </div>
        )}

        {claims.length > 0 && (
          <>
            {/* Sentinel — IntersectionObserver watches this to trigger sticky bar */}
            <div ref={sentinelRef} className="h-px -mt-px" />

            {/* ── Search bar ── */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 flex items-center bg-white border border-[#D9E1E8] rounded-xl shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-[#7A8F79]">
                <svg className="w-4 h-4 text-[#7A8F79] ml-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitSearch() }}
                  placeholder="Search by claim ID, payer, amount, date…"
                  className="flex-1 px-3 py-2.5 text-sm text-[#2F3E4E] placeholder-[#7A8F79] focus:outline-none"
                />
              </div>
              <button
                onClick={submitSearch}
                className="shrink-0 bg-[#2F3E4E] hover:bg-[#7A8F79] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition"
              >
                Search
              </button>
              {(searchQuery || searchInput) && (
                <button
                  onClick={clearSearch}
                  className="shrink-0 bg-[#C4622D] hover:bg-[#a3511f] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition"
                >
                  Clear
                </button>
              )}
            </div>

            {/* ── Year filter pills ── */}
            <div className="flex flex-wrap gap-2 mb-4">
              {YEARS.map(y => (
                <button
                  key={y || 'all'}
                  onClick={() => setFilterYear(y)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${
                    filterYear === y
                      ? 'bg-[#2F3E4E] text-white'
                      : 'bg-white text-[#7A8F79] hover:bg-[#D9E1E8]'
                  }`}
                >
                  {y || 'All'}
                </button>
              ))}
            </div>

            {/* Active search indicator */}
            {searchQuery && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-[#7A8F79]">
                  Showing results for <span className="font-semibold text-[#2F3E4E]">&ldquo;{searchQuery}&rdquo;</span>
                  {' '}— {activeClaims.length} claim{activeClaims.length !== 1 ? 's' : ''} matched
                </span>
                <button onClick={clearSearch} className="text-[#C4622D] text-xs font-semibold hover:underline">Clear</button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
              <div className="bg-white rounded-xl p-2.5 md:p-4 shadow-sm">
                <p className="text-[9px] md:text-xs uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Total Claims</p>
                <p className="text-base md:text-2xl font-bold text-[#2F3E4E] mt-0.5">{activeClaims.length}</p>
              </div>
              <div className="bg-white rounded-xl p-2.5 md:p-4 shadow-sm">
                <p className="text-[9px] md:text-xs uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Total Billed</p>
                <p className="text-base md:text-2xl font-bold text-[#2F3E4E] mt-0.5 truncate">{fmt(totalBilled, '$')}</p>
              </div>
              <div className="bg-white rounded-xl p-2.5 md:p-4 shadow-sm">
                <p className="text-[9px] md:text-xs uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Total Reimb.</p>
                <p className="text-base md:text-2xl font-bold text-[#7A8F79] mt-0.5 truncate">{fmt(totalReimbursed, '$')}</p>
              </div>
            </div>
          </>
        )}

        {loading ? (
          <div className="text-center text-[#7A8F79] py-16">Loading…</div>
        ) : claims.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[#D9E1E8] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#7A8F79]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-[#2F3E4E] font-semibold">No claims on file yet</p>
            <p className="text-[#7A8F79] text-sm mt-1">Your claims will appear here once billing is processed.</p>
          </div>
        ) : yearFilteredClaims.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-[#2F3E4E] font-semibold">No claims found for {filterYear}</p>
            <p className="text-[#7A8F79] text-sm mt-1">Select a different year or "All" to see all claims.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groupClaims(yearFilteredClaims).map(group => (
              <ClaimRow key={group.primary.id} {...group} eobDocs={eobMap[group.primary.id] ?? []} onClaimPaid={handleClaimPaid} />
            ))}
          </div>
        )}

        </>)}

      </div>
    </div>
  )
}
