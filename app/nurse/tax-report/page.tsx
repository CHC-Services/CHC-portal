'use client'

import { useEffect, useState } from 'react'
import PortalMessages from '../../components/PortalMessages'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const FILTERS: { key: string; label: string }[] = [
  { key: 'all_claims', label: 'All Claim Data' },
  { key: 'medicaid', label: 'Medicaid' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'all_financial', label: 'All Financial Data' },
]

type ClaimPeriodData = { medicaid: number; commercial: number; count: number }
type ReportData = {
  claimIncome: { monthly: Record<number, ClaimPeriodData>; quarterly: Record<number, ClaimPeriodData>; total: ClaimPeriodData }
  expense: { totalPaid: number; count: number }
}

function currency(n: number) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default function NurseTaxReportPage() {
  const [isPaidSubscriber, setIsPaidSubscriber] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportData | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [quarter, setQuarter] = useState<number | null>(null)
  const [filterKey, setFilterKey] = useState('all_financial')
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')

  useEffect(() => {
    fetch('/api/nurse/plan', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { isPaidSubscriber: false })
      .then(d => setIsPaidSubscriber(!!d.isPaidSubscriber))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!isPaidSubscriber) return
    fetch(`/api/nurse/tax-report?year=${year}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.claimIncome) setData(d) })
  }, [isPaidSubscriber, year])

  async function exportReport() {
    setExporting(true)
    setExportMsg('')
    const res = await fetch('/api/nurse/tax-report/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ year, quarter, filterKey }),
    })
    const body = await res.json()
    setExporting(false)
    if (res.ok && body.url) {
      window.open(body.url, '_blank')
      setExportMsg('Saved to your Documents (Tax category) — you can re-download it there anytime.')
    } else {
      setExportMsg(body.error || 'Export failed')
    }
  }

  if (loading) return <div className="p-8 text-[#7A8F79]">Loading…</div>

  if (!isPaidSubscriber) return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8 flex items-start justify-center pt-20">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-[#2F3E4E] mb-2">myProvider Premium Required</h2>
        <p className="text-sm text-[#7A8F79] mb-6">
          Your Year-End Tax Summary is included with a paid myProvider subscription. Contact Coming Home Care to upgrade.
        </p>
        <div className="bg-[#F4F6F5] rounded-xl p-4 text-left space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">Included</p>
          <p className="text-sm text-[#2F3E4E]">✓ Income billed through the service, by quarter or year</p>
          <p className="text-sm text-[#2F3E4E]">✓ Medicaid vs. Commercial breakdown</p>
          <p className="text-sm text-[#2F3E4E]">✓ Deductible platform-cost summary</p>
          <p className="text-sm text-[#2F3E4E]">✓ Printable PDF to hand your accountant</p>
        </div>
      </div>
    </div>
  )

  const claimTotal = quarter && data ? data.claimIncome.quarterly[quarter] : data?.claimIncome.total
  const months = quarter ? [1, 2, 3].map(m => (quarter - 1) * 3 + m) : Array.from({ length: 12 }, (_, i) => i + 1)
  const showMedicaid = filterKey === 'all_claims' || filterKey === 'medicaid' || filterKey === 'all_financial'
  const showCommercial = filterKey === 'all_claims' || filterKey === 'commercial' || filterKey === 'all_financial'
  const showExpenses = filterKey === 'expenses' || filterKey === 'all_financial'
  const showClaims = showMedicaid || showCommercial

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8 pl-0 md:pl-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">my</span>Tax Summary
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">Income billed through the service and your deductible platform costs, by tax period.</p>
      </div>

      <PortalMessages priority="General" />

      <div className="max-w-3xl space-y-4">
        {/* Year selector */}
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(y => y - 1)} className="bg-white border border-[#D9E1E8] px-3 py-1.5 rounded-lg text-sm font-semibold text-[#2F3E4E] hover:border-[#7A8F79] transition">← {year - 1}</button>
          <span className="text-lg font-bold text-[#2F3E4E]">{year}</span>
          <button onClick={() => setYear(y => y + 1)} disabled={year >= new Date().getFullYear()} className="bg-white border border-[#D9E1E8] px-3 py-1.5 rounded-lg text-sm font-semibold text-[#2F3E4E] hover:border-[#7A8F79] transition disabled:opacity-40">{year + 1} →</button>
        </div>

        {/* Quarter pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setQuarter(null)} className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${quarter === null ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'}`}>Full Year</button>
          {[1, 2, 3, 4].map(q => (
            <button key={q} onClick={() => setQuarter(q)} className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${quarter === q ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'}`}>Q{q}</button>
          ))}
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilterKey(f.key)} className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${filterKey === f.key ? 'bg-[#7A8F79] text-white border-[#7A8F79]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'}`}>{f.label}</button>
          ))}
        </div>

        {!data ? (
          <p className="text-sm text-[#7A8F79]">Loading report data…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              {showClaims && (
                <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-[#7A8F79]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">Total Claim Income</p>
                  <p className="text-2xl font-black text-[#2F3E4E] mt-1">{currency((claimTotal?.medicaid || 0) + (claimTotal?.commercial || 0))}</p>
                </div>
              )}
              {showExpenses && (
                <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-red-400">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">Platform / Billing Service Expense</p>
                  <p className="text-2xl font-black text-red-600 mt-1">{currency(data.expense.totalPaid)}</p>
                </div>
              )}
            </div>

            {showClaims && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-[#2F3E4E] uppercase tracking-widest mb-3 pb-2 border-b border-[#D9E1E8]">Income Billed Through Service</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#7A8F79] text-[10px] uppercase tracking-wide border-b border-[#D9E1E8]">
                      <th className="text-left py-1.5 pr-4">Month</th>
                      {showMedicaid && <th className="text-right py-1.5 pr-4">Medicaid</th>}
                      {showCommercial && <th className="text-right py-1.5 pr-4">Commercial</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {months.map(m => {
                      const row = data.claimIncome.monthly[m]
                      return (
                        <tr key={m} className="border-b border-[#D9E1E8] last:border-0">
                          <td className="py-1.5 pr-4 font-semibold text-[#2F3E4E] text-xs">{MONTHS[m - 1]} {year}</td>
                          {showMedicaid && <td className="py-1.5 pr-4 text-right text-xs text-[#2F3E4E]">{row.medicaid > 0 ? currency(row.medicaid) : '—'}</td>}
                          {showCommercial && <td className="py-1.5 pr-4 text-right text-xs text-[#2F3E4E]">{row.commercial > 0 ? currency(row.commercial) : '—'}</td>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {showExpenses && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-[#2F3E4E] uppercase tracking-widest mb-3 pb-2 border-b border-[#D9E1E8]">Deductible Business Expense</h2>
                <p className="text-sm text-[#2F3E4E]">{data.expense.count} invoice(s) paid to Coming Home Care this period — <span className="font-semibold">{currency(data.expense.totalPaid)}</span></p>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-5">
              <button onClick={exportReport} disabled={exporting} className="bg-[#2F3E4E] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                {exporting ? 'Generating…' : `Generate & Download PDF`}
              </button>
              {exportMsg && <p className="text-xs text-[#7A8F79] mt-2">{exportMsg}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
