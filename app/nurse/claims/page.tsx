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
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
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

function groupClaims(claims: Claim[]): Claim[] {
  const resubIds = new Set(claims.filter(c => c.resubmissionOf).map(c => c.resubmissionOf!))
  const result: Claim[] = []
  for (const c of claims) {
    if (c.resubmissionOf) continue
    result.push(c)
    if (c.claimId && resubIds.has(c.claimId)) {
      result.push(...claims.filter(r => r.resubmissionOf === c.claimId))
    }
  }
  return result
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

  // Exclude superseded originals — if a claim was resubmitted, only count the resubmission
  // Exclude superseded originals — if a claim was resubmitted, only count the resubmission
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
          <div className="space-y-4">
            {groupClaims(claims).map(c => (
              <div key={c.id} className={`bg-white rounded-xl shadow-sm p-5 ${c.resubmissionOf ? 'border-l-4 border-purple-400 ml-4' : ''}`}>

                {/* Resubmission indicator */}
                {c.resubmissionOf && (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                      ↳ Resubmission of #{c.resubmissionOf}
                    </span>
                  </div>
                )}

                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs text-[#7A8F79] font-mono"><span className="font-semibold not-italic">Claim ID:</span> {c.claimId || '—'}</p>
                    <p className="text-sm font-semibold text-[#2F3E4E] mt-0.5">
                      DOS: {fmtDate(c.dosStart)}{c.dosStop ? ` – ${fmtDate(c.dosStop)}` : ''}
                    </p>
                  </div>
                  <div />
                </div>

                {/* Primary insurance */}
                {(c.primaryPayer || c.primaryPaidAmt != null) && (
                  <div className="mb-3">
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
                  <div className="mb-3 pt-3 border-t border-[#D9E1E8]">
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
                {(() => {
                  const finalStages = ['paid', 'denied', 'rejected', 'finalized']
                  const isFinal = finalStages.includes((c.claimStage || '').toLowerCase())
                  const dateLabel = isFinal ? 'Processed Date' : 'Last Updated'
                  const dateValue = isFinal
                    ? (c.dateFullyFinalized || c.primaryPaidDate || c.updatedAt)
                    : c.updatedAt
                  return (
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
                        <StageBadge stage={c.claimStage} />
                        <p className="font-semibold text-[#2F3E4E] mt-1">{fmtDate(dateValue)}</p>
                        <p className={`text-[10px] ${isFinal ? 'text-green-700' : 'text-[#7A8F79]'}`}>{dateLabel}</p>
                      </div>
                    </div>
                  )
                })()}

                {/* Processing Notes */}
                {c.processingNotes && (
                  <div className="mt-3 pt-3 border-t border-[#D9E1E8]">
                    <p className="text-xs text-[#7A8F79] font-semibold uppercase tracking-wide mb-1">Processing Notes</p>
                    <p className="text-sm text-[#2F3E4E]">{c.processingNotes}</p>
                  </div>
                )}

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
