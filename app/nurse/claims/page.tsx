'use client'

import { useState, useEffect } from 'react'
import PortalMessages from '../../components/PortalMessages'

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
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', timeZone: 'UTC' })
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

function ClaimRow({ primary: c, chain }: ClaimGroup) {
  const [expanded, setExpanded] = useState(false)

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
              <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-2">
                Primary — {c.primaryPayer || '—'}
              </p>
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
    </div>
  )
}

export default function NurseClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [enrolledInBilling, setEnrolledInBilling] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/nurse/claims', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setClaims(data.claims || [])
        setEnrolledInBilling(data.enrolledInBilling ?? null)
        setLoading(false)
      })
  }, [])

  const resubIds = new Set(claims.filter(c => c.resubmissionOf).map(c => c.resubmissionOf as string))
  const activeClaims = claims.filter(c => !c.claimId || !resubIds.has(c.claimId))

  const totalBilled = activeClaims.reduce((s, c) => s + (c.totalBilled || 0), 0)
  const totalReimbursed = activeClaims.reduce((s, c) => s + (c.totalReimbursed || 0), 0)

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="max-w-4xl mx-auto">

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">my</span>Claims
          </h1>
          <p className="text-sm text-[#7A8F79] mt-1">View the status of your submitted billing claims.</p>
        </div>

        <PortalMessages priority="Claims" />

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
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Total Claims</p>
              <p className="text-2xl font-bold text-[#2F3E4E] mt-1">{activeClaims.length}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Total Billed</p>
              <p className="text-2xl font-bold text-[#2F3E4E] mt-1">{fmt(totalBilled, '$')}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Total Reimbursed</p>
              <p className="text-2xl font-bold text-[#7A8F79] mt-1">{fmt(totalReimbursed, '$')}</p>
            </div>
          </div>
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
        ) : (
          <div className="space-y-2">
            {groupClaims(claims).map(group => (
              <ClaimRow key={group.primary.id} {...group} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
