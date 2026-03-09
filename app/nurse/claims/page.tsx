'use client'

import { useState, useEffect } from 'react'

type Claim = {
  id: string
  claimCtrlId: string | null
  submitStatus: string | null
  status: string | null
  dosStart: string | null
  dosStop: string | null
  hoursBilled: number | null
  chargeAmount: number | null
  allowedAmount: number | null
  paidAmount: number | null
  remitCheckNumber: string | null
  finalizedDate: string | null
  eobDate: string | null
  statusNote: string | null
  innOon: string | null
  dedCoin: number | null
}

function fmt(val: number | null, prefix = '') {
  if (val == null) return '—'
  return `${prefix}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[#7A8F79] text-xs">—</span>
  const s = status.toLowerCase()
  const color =
    s.includes('paid') || s.includes('finalized') ? 'bg-green-100 text-green-800' :
    s.includes('denied') || s.includes('reject') ? 'bg-red-100 text-red-800' :
    s.includes('pending') || s.includes('process') ? 'bg-yellow-100 text-yellow-800' :
    s.includes('submit') ? 'bg-blue-100 text-blue-800' :
    'bg-gray-100 text-gray-600'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{status}</span>
}

export default function NurseClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/nurse/claims', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setClaims(data.claims || []); setLoading(false) })
  }, [])

  const totalBilled = claims.reduce((s, c) => s + (c.chargeAmount || 0), 0)
  const totalPaid = claims.reduce((s, c) => s + (c.paidAmount || 0), 0)

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="max-w-4xl mx-auto">

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">my</span>Claims
          </h1>
          <p className="text-sm text-[#7A8F79] mt-1">View the status of your submitted billing claims.</p>
        </div>

        {/* Summary */}
        {claims.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Total Claims</p>
              <p className="text-2xl font-bold text-[#2F3E4E] mt-1">{claims.length}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Total Billed</p>
              <p className="text-2xl font-bold text-[#2F3E4E] mt-1">{fmt(totalBilled, '$')}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Total Paid</p>
              <p className="text-2xl font-bold text-[#7A8F79] mt-1">{fmt(totalPaid, '$')}</p>
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
            <p className="text-[#7A8F79] text-sm mt-1">Your claims will appear here once billing is processed. Contact your administrator with any questions.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {claims.map(c => (
              <div key={c.id} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs text-[#7A8F79] font-mono">{c.claimCtrlId || 'No Claim ID'}</p>
                    <p className="text-sm font-semibold text-[#2F3E4E] mt-0.5">
                      DOS: {fmtDate(c.dosStart)}{c.dosStop ? ` – ${fmtDate(c.dosStop)}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {c.submitStatus && <StatusBadge status={c.submitStatus} />}
                    {c.status && <StatusBadge status={c.status} />}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-[#7A8F79]">Billed</p>
                    <p className="font-semibold text-[#2F3E4E]">{fmt(c.chargeAmount, '$')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7A8F79]">Allowed</p>
                    <p className="font-semibold text-[#2F3E4E]">{fmt(c.allowedAmount, '$')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7A8F79]">BCBS Paid</p>
                    <p className="font-semibold text-[#7A8F79]">{fmt(c.paidAmount, '$')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7A8F79]">Ded / Coin</p>
                    <p className="font-semibold text-[#2F3E4E]">{fmt(c.dedCoin, '$')}</p>
                  </div>
                </div>
                {(c.statusNote || c.remitCheckNumber || c.eobDate) && (
                  <div className="mt-3 pt-3 border-t border-[#D9E1E8] flex flex-wrap gap-4 text-xs text-[#7A8F79]">
                    {c.remitCheckNumber && <span>Check #: <span className="text-[#2F3E4E] font-semibold">{c.remitCheckNumber}</span></span>}
                    {c.eobDate && <span>EOB: <span className="text-[#2F3E4E]">{fmtDate(c.eobDate)}</span></span>}
                    {c.innOon && <span>{c.innOon}</span>}
                    {c.statusNote && <span className="text-[#2F3E4E]">{c.statusNote}</span>}
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
