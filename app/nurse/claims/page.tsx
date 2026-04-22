'use client'

import { useState, useEffect, useRef } from 'react'
import PortalMessages from '../../components/PortalMessages'
import { payCycleDateLabel } from '../../../lib/medicaidPayCycle'

type MedicaidClaim = {
  id: string
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
}

const ANCHOR_CYCLE = 2540
const ANCHOR_DATE  = '2026-05-14'

const STATUS_COLORS: Record<string, string> = {
  F1:  'bg-green-100 text-green-700',
  F2:  'bg-red-100 text-red-600',
  '3': 'bg-blue-100 text-blue-700',
  A3:  'bg-orange-100 text-orange-700',
  '400': 'bg-red-100 text-red-600',
  '483': 'bg-yellow-100 text-yellow-700',
}

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
  claimStage: string | null
  primaryPayer: string | null
  primaryAllowedAmt: number | null
  primaryPaidAmt: number | null
  primaryPaidDate: string | null
  primaryPaidTo: string | null
  secondaryPayer: string | null
  secondaryAllowedAmt: number | null
  secondaryPaidAmt: number | null
  secondaryPaidDate: string | null
  secondaryPaidTo: string | null
  totalReimbursed: number | null
  remainingBalance: number | null
  dateFullyFinalized: string | null
  resubmissionOf: string | null
  processingNotes: string | null
  updatedAt: string
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

function ClaimRow({ primary: c, chain, eobDocs }: ClaimGroup & { eobDocs: { id: string; fileName: string }[] }) {
  const [expanded, setExpanded] = useState(false)
  // Track which EOB is open: { doc, url, loading }
  const [activeEob, setActiveEob] = useState<{ id: string; fileName: string } | null>(null)
  const [eobUrlCache, setEobUrlCache] = useState<Record<string, string>>({})
  const [eobLoading, setEobLoading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

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

  const isFinal = ['paid', 'denied', 'rejected', 'finalized'].includes((c.claimStage || '').toLowerCase())
  const dateLabel = isFinal ? 'Finalized' : 'Last Updated'
  const dateValue = isFinal
    ? (c.dateFullyFinalized || c.primaryPaidDate || c.updatedAt)
    : c.updatedAt
  const firstNoteLine = c.processingNotes ? c.processingNotes.split('\n').find(l => l.trim()) || null : null

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* ── Compact summary row (always visible, click to expand) ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-4 pt-3 pb-2.5 hover:bg-[#F4F6F5] transition-colors"
      >
        {/* Row 1: resubmit indicator | | | status + chevron */}
        <div className="grid grid-cols-4 items-center mb-1">
          <div>
            {c.resubmissionOf && (
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                ↻ Resubmission
              </span>
            )}
          </div>
          <div />
          <div />
          <div className="flex justify-end items-center gap-2">
            <StageBadge stage={c.claimStage} />
            <span className="text-[#7A8F79] text-[10px]">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Row 2: Claim ID | Total Billed label | Total Reimb label | date value */}
        <div className="grid grid-cols-4 gap-2 items-end">
          <div>
            <p className="text-[10px] text-[#7A8F79] leading-tight">Claim ID</p>
          </div>
          <div>
            <p className="text-[10px] text-[#7A8F79] leading-tight">Total Billed</p>
          </div>
          <div>
            <p className="text-[10px] text-[#7A8F79] leading-tight">Total Reimb.</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-[#2F3E4E] leading-tight">{fmtDate(dateValue)}</p>
          </div>
        </div>

        {/* Row 3: DOS | billed $$ | reimb $$ | date label */}
        <div className="grid grid-cols-4 gap-2 items-start mt-0.5">
          <div>
            <p className="text-xs font-mono font-semibold text-[#2F3E4E] truncate leading-tight">{c.claimId || '—'}</p>
            <p className="text-[10px] text-[#7A8F79] leading-tight mt-0.5">{fmtDOS(c.dosStart, c.dosStop)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#2F3E4E] leading-tight">{fmt(c.totalBilled, '$')}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#7A8F79] leading-tight">{fmt(c.totalReimbursed, '$')}</p>
          </div>
          <div className="text-right">
            <p className={`text-[10px] leading-tight ${isFinal ? 'text-green-700' : 'text-[#7A8F79]'}`}>{dateLabel}</p>
          </div>
        </div>

        {/* Row 4: Processing notes — 1 line preview, spans full width */}
        {firstNoteLine && (
          <div className="mt-2 pt-2 border-t border-[#D9E1E8]">
            <p className="text-[11px] text-[#7A8F79] truncate leading-tight">
              <span className="font-semibold text-[#7A8F79] uppercase tracking-wide text-[10px]">Note · </span>
              {firstNoteLine}
            </p>
          </div>
        )}
      </button>

      {/* ── Expanded details ── */}
      {expanded && (
        <div className="border-t border-[#D9E1E8] px-4 py-4 space-y-4 bg-[#FAFBFC]">

          {/* Primary insurance */}
          {(c.primaryPayer || c.primaryPaidAmt != null) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">
                  Primary — {c.primaryPayer || '—'}
                </p>
                {eobDocs.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {eobDocs.map((doc, i) => (
                      <button
                        key={doc.id}
                        onClick={() => openEob(doc)}
                        className="flex items-center gap-1 text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] border border-[#D9E1E8] hover:border-[#7A8F79] px-2.5 py-1 rounded-lg transition"
                      >
                        📎 {eobDocs.length > 1 ? `EOB ${i + 1}` : 'View EOB'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[#7A8F79]">Allowed</p>
                  <p className="font-semibold text-[#2F3E4E]">{fmt(c.primaryAllowedAmt, '$')}</p>
                </div>
                <div>
                  <p className="text-xs text-[#7A8F79]">Paid</p>
                  <p className="font-semibold text-[#7A8F79]">{fmt(c.primaryPaidAmt, '$')}</p>
                </div>
                <div>
                  <p className="text-xs text-[#7A8F79]">Paid Date</p>
                  <p className="font-semibold text-[#2F3E4E]">{fmtDate(c.primaryPaidDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#7A8F79]">Paid To</p>
                  <p className="font-semibold text-[#2F3E4E]">{c.primaryPaidTo || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Secondary insurance */}
          {(c.secondaryPayer || c.secondaryPaidAmt != null) && (
            <div className="pt-3 border-t border-[#D9E1E8]">
              <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-2">
                Secondary — {c.secondaryPayer || '—'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[#7A8F79]">Allowed</p>
                  <p className="font-semibold text-[#2F3E4E]">{fmt(c.secondaryAllowedAmt, '$')}</p>
                </div>
                <div>
                  <p className="text-xs text-[#7A8F79]">Paid</p>
                  <p className="font-semibold text-[#7A8F79]">{fmt(c.secondaryPaidAmt, '$')}</p>
                </div>
                <div>
                  <p className="text-xs text-[#7A8F79]">Paid Date</p>
                  <p className="font-semibold text-[#2F3E4E]">{fmtDate(c.secondaryPaidDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#7A8F79]">Paid To</p>
                  <p className="font-semibold text-[#2F3E4E]">{c.secondaryPaidTo || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="pt-3 border-t border-[#D9E1E8] grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-[#7A8F79]">Total Billed</p>
              <p className="font-semibold text-[#2F3E4E]">{fmt(c.totalBilled, '$')}</p>
            </div>
            <div>
              <p className="text-xs text-[#7A8F79]">Total Reimbursed</p>
              <p className="font-semibold text-[#7A8F79]">{fmt(c.totalReimbursed, '$')}</p>
            </div>
            <div>
              <p className="text-xs text-[#7A8F79]">Remaining Balance</p>
              <p className={`font-semibold ${(c.remainingBalance || 0) > 0 ? 'text-red-600' : 'text-[#2F3E4E]'}`}>
                {fmt(c.remainingBalance, '$')}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#7A8F79]">Provider</p>
              <p className="font-semibold text-[#2F3E4E] text-xs">{c.providerName || '—'}</p>
            </div>
          </div>

          {/* Full processing notes */}
          {c.processingNotes && (
            <div className="pt-3 border-t border-[#D9E1E8]">
              <p className="text-xs text-[#7A8F79] font-semibold uppercase tracking-wide mb-1">Processing Notes</p>
              <p className="text-sm text-[#2F3E4E] whitespace-pre-line">{c.processingNotes}</p>
            </div>
          )}

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

const YEARS = ['', '2024', '2025', '2026', '2027', '2028', '2029', '2030'] as const

export default function NurseClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [enrolledInBilling, setEnrolledInBilling] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [claimTab, setClaimTab] = useState<'commercial' | 'medicaid'>('commercial')
  const [medicaidClaims, setMedicaidClaims] = useState<MedicaidClaim[]>([])
  const [medicaidLoading, setMedicaidLoading] = useState(true)
  const [filterYear, setFilterYear] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showStickyBar, setShowStickyBar] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  // Map from Claim.id (DB UUID) → array of EOB docs (supports multiple per claim)
  const [eobMap, setEobMap] = useState<Record<string, { id: string; fileName: string }[]>>({})

  useEffect(() => {
    fetch('/api/nurse/claims', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setClaims(data.claims || [])
        setEnrolledInBilling(data.enrolledInBilling ?? null)
        setLoading(false)
      })

    fetch('/api/nurse/medicaid', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMedicaidClaims(data); setMedicaidLoading(false) })
      .catch(() => setMedicaidLoading(false))

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

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">

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

        <PortalMessages priority="Claims" />

        {/* ── Tab toggle ── */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setClaimTab('commercial')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              claimTab === 'commercial'
                ? 'bg-[#2F3E4E] text-white shadow-sm'
                : 'bg-white text-[#7A8F79] border border-[#D9E1E8] hover:border-[#7A8F79]'
            }`}
          >
            Commercial Claims
          </button>
          <button
            onClick={() => setClaimTab('medicaid')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              claimTab === 'medicaid'
                ? 'bg-[#2F3E4E] text-white shadow-sm'
                : 'bg-white text-[#7A8F79] border border-[#D9E1E8] hover:border-[#7A8F79]'
            }`}
          >
            Medicaid Claims
          </button>
        </div>

        {claimTab === 'medicaid' && (
          <div>
            {medicaidLoading ? (
              <div className="text-center text-[#7A8F79] py-16">Loading…</div>
            ) : medicaidClaims.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <div className="w-14 h-14 rounded-full bg-[#D9E1E8] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-[#7A8F79]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-[#2F3E4E] font-semibold">No Medicaid claims on file yet</p>
                <p className="text-[#7A8F79] text-sm mt-1">Your Medicaid claims will appear here once billing is processed.</p>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
                  <div className="bg-white rounded-xl p-2.5 md:p-4 shadow-sm">
                    <p className="text-[9px] md:text-xs uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Total Claims</p>
                    <p className="text-base md:text-2xl font-bold text-[#2F3E4E] mt-0.5">{medicaidClaims.length}</p>
                  </div>
                  <div className="bg-white rounded-xl p-2.5 md:p-4 shadow-sm">
                    <p className="text-[9px] md:text-xs uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Total Charged</p>
                    <p className="text-base md:text-2xl font-bold text-[#2F3E4E] mt-0.5 truncate">
                      ${medicaidClaims.reduce((s, c) => s + c.totalCharge, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-2.5 md:p-4 shadow-sm">
                    <p className="text-[9px] md:text-xs uppercase tracking-widest text-[#7A8F79] font-semibold leading-tight">Total Paid</p>
                    <p className="text-base md:text-2xl font-bold text-[#7A8F79] mt-0.5 truncate">
                      ${medicaidClaims.reduce((s, c) => s + (c.paidAmount ?? 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {medicaidClaims.map(claim => {
                    const dosStart = new Date(claim.dosStart).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
                    const dosStop  = new Date(claim.dosStop).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
                    const processed = claim.processedDate
                      ? new Date(claim.processedDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
                      : null
                    return (
                      <div key={claim.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-bold text-[#2F3E4E] text-sm">Patient Ctrl #: {claim.patientCtrlNum}</span>
                              {claim.payerCtrlNum && (
                                <span className="text-xs text-[#7A8F79]">Payer Ctrl #: {claim.payerCtrlNum}</span>
                              )}
                            </div>
                            <p className="text-xs text-[#7A8F79]">DOS: {dosStart} – {dosStop}</p>
                            {claim.notes && (
                              <p className="text-xs text-[#7A8F79] mt-1 italic">{claim.notes}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                            <span className="text-sm font-bold text-[#2F3E4E]">
                              ${claim.totalCharge.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              <span className="font-normal text-[#7A8F79] text-xs ml-1">charged</span>
                            </span>
                            {claim.paidAmount != null && (
                              <span className="text-sm font-semibold text-[#7A8F79]">
                                ${claim.paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                <span className="font-normal text-xs ml-1">paid</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="px-5 pb-4 flex flex-wrap items-center gap-2">
                          {claim.statusCodes.map(code => (
                            <span
                              key={code}
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[code] ?? 'bg-gray-100 text-gray-600'}`}
                            >
                              {code}
                            </span>
                          ))}
                          {processed && (
                            <span className="text-xs text-[#7A8F79] ml-auto">Processed {processed}</span>
                          )}
                          {claim.estPayCycle != null && (
                            <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                              Est. Pay: {payCycleDateLabel(claim.estPayCycle, ANCHOR_CYCLE, ANCHOR_DATE)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {claimTab === 'commercial' && <>

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
              <ClaimRow key={group.primary.id} {...group} eobDocs={eobMap[group.primary.id] ?? []} />
            ))}
          </div>
        )}

        </>}

      </div>
    </div>
  )
}
