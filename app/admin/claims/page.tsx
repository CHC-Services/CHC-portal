'use client'

import { useState, useEffect, useRef } from 'react'

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
  nurse: { displayName: string; accountNumber: string | null }
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
    'bg-gray-100 text-gray-600'
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

  const headers = splitLine(lines[0])
  return lines.slice(1).map(line => {
    const vals = splitLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
}

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number } | null>(null)
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadClaims() {
    setLoading(true)
    const res = await fetch('/api/admin/claims', { credentials: 'include' })
    const data = await res.json()
    setClaims(data.claims || [])
    setLoading(false)
  }

  useEffect(() => { loadClaims() }, [])

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    const text = await file.text()
    const rows = parseCSV(text)
    const res = await fetch('/api/admin/claims/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rows })
    })
    const data = await res.json()
    setImportResult(data)
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
    loadClaims()
  }

  const stages = [...new Set(claims.map(c => c.claimStage).filter(Boolean))] as string[]

  const filtered = claims.filter(c => {
    const matchSearch = !search ||
      (c.providerName || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.nurse?.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.claimId || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.primaryPayer || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.secondaryPayer || '').toLowerCase().includes(search.toLowerCase())
    const matchStage = !filterStage || c.claimStage === filterStage
    return matchSearch && matchStage
  })

  const totalBilled = filtered.reduce((s, c) => s + (c.totalBilled || 0), 0)
  const totalReimbursed = filtered.reduce((s, c) => s + (c.totalReimbursed || 0), 0)
  const totalBalance = filtered.reduce((s, c) => s + (c.remainingBalance || 0), 0)

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6">
      <div className="max-w-screen-xl mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#2F3E4E]">Claims</h1>
            <p className="text-sm text-[#7A8F79] mt-0.5">Import from CSV or manage claims below.</p>
          </div>
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileImport} className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className="cursor-pointer bg-[#2F3E4E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition">
              {importing ? 'Importing…' : 'Import CSV'}
            </label>
          </div>
        </div>

        {/* Import result */}
        {importResult && (
          <div className="bg-white border border-[#7A8F79] rounded-xl p-4 mb-4 text-sm text-[#2F3E4E] flex gap-6">
            <span>✓ Import complete</span>
            <span className="text-green-700 font-semibold">{importResult.created} created</span>
            <span className="text-blue-700 font-semibold">{importResult.updated} updated</span>
            {importResult.skipped > 0 && (
              <span className="text-red-600 font-semibold">{importResult.skipped} skipped — provider name not matched</span>
            )}
          </div>
        )}

        {/* Summary strip */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Total Claims</p>
            <p className="text-2xl font-bold text-[#2F3E4E] mt-1">{filtered.length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Total Billed</p>
            <p className="text-2xl font-bold text-[#2F3E4E] mt-1">{fmt(totalBilled, '$')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Total Reimbursed</p>
            <p className="text-2xl font-bold text-[#7A8F79] mt-1">{fmt(totalReimbursed, '$')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Remaining Balance</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{fmt(totalBalance, '$')}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
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
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center text-[#7A8F79] py-16">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-[#7A8F79] shadow-sm">
            No claims yet. Import a CSV to get started.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#F4F6F5] text-xs uppercase tracking-widest text-[#7A8F79]">
                <tr>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Claim ID</th>
                  <th className="px-4 py-3">DOS</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Total Billed</th>
                  <th className="px-4 py-3 border-l border-[#D9E1E8]">Primary Payer</th>
                  <th className="px-4 py-3">Allowed</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Paid Date</th>
                  <th className="px-4 py-3">Paid To</th>
                  <th className="px-4 py-3 border-l border-[#D9E1E8]">Secondary Payer</th>
                  <th className="px-4 py-3">Allowed</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Paid Date</th>
                  <th className="px-4 py-3">Paid To</th>
                  <th className="px-4 py-3 border-l border-[#D9E1E8]">Reimbursed</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-4 py-3">Finalized</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E1E8]">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-[#F4F6F5] transition">
                    <td className="px-4 py-3 font-semibold text-[#2F3E4E] whitespace-nowrap">{c.providerName || c.nurse?.displayName}</td>
                    <td className="px-4 py-3 text-[#7A8F79] font-mono text-xs">{c.claimId || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-[#2F3E4E]">
                      {fmtDate(c.dosStart)}{c.dosStop ? ` – ${fmtDate(c.dosStop)}` : ''}
                    </td>
                    <td className="px-4 py-3"><StageBadge stage={c.claimStage} /></td>
                    <td className="px-4 py-3 text-right text-[#2F3E4E]">{fmt(c.totalBilled, '$')}</td>
                    <td className="px-4 py-3 border-l border-[#D9E1E8] text-[#2F3E4E]">{c.primaryPayer || '—'}</td>
                    <td className="px-4 py-3 text-right text-[#2F3E4E]">{fmt(c.primaryAllowedAmt, '$')}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#7A8F79]">{fmt(c.primaryPaidAmt, '$')}</td>
                    <td className="px-4 py-3 text-xs text-[#7A8F79] whitespace-nowrap">{fmtDate(c.primaryPaidDate)}</td>
                    <td className="px-4 py-3 text-xs text-[#2F3E4E]">{c.primaryPaidTo || '—'}</td>
                    <td className="px-4 py-3 border-l border-[#D9E1E8] text-[#2F3E4E]">{c.secondaryPayer || '—'}</td>
                    <td className="px-4 py-3 text-right text-[#2F3E4E]">{fmt(c.secondaryAllowedAmt, '$')}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#7A8F79]">{fmt(c.secondaryPaidAmt, '$')}</td>
                    <td className="px-4 py-3 text-xs text-[#7A8F79] whitespace-nowrap">{fmtDate(c.secondaryPaidDate)}</td>
                    <td className="px-4 py-3 text-xs text-[#2F3E4E]">{c.secondaryPaidTo || '—'}</td>
                    <td className="px-4 py-3 border-l border-[#D9E1E8] text-right font-semibold text-[#7A8F79]">{fmt(c.totalReimbursed, '$')}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${(c.remainingBalance || 0) > 0 ? 'text-red-600' : 'text-[#2F3E4E]'}`}>
                      {fmt(c.remainingBalance, '$')}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#7A8F79] whitespace-nowrap">{fmtDate(c.dateFullyFinalized)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}
