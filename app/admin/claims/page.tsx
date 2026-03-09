'use client'

import { useState, useEffect, useRef } from 'react'

type Claim = {
  id: string
  claimCtrlId: string | null
  transId: string | null
  submitStatus: string | null
  submitDate: string | null
  status: string | null
  dosStart: string | null
  dosStop: string | null
  hoursBilled: number | null
  chargeAmount: number | null
  allowedAmount: number | null
  paidAmount: number | null
  remitCheckNumber: string | null
  checkAmount: number | null
  finalizedDate: string | null
  eobDate: string | null
  statusNote: string | null
  innOon: string | null
  dedCoin: number | null
  allowRate: number | null
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

// Parse CSV text into array of row objects
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
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
  const [filterStatus, setFilterStatus] = useState('')
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

  const statuses = [...new Set(claims.map(c => c.status).filter(Boolean))] as string[]

  const filtered = claims.filter(c => {
    const matchSearch = !search ||
      (c.nurse?.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.claimCtrlId || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.statusNote || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || c.status === filterStatus
    return matchSearch && matchStatus
  })

  const totalBilled = filtered.reduce((s, c) => s + (c.chargeAmount || 0), 0)
  const totalPaid = filtered.reduce((s, c) => s + (c.paidAmount || 0), 0)

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6">
      <div className="max-w-screen-xl mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#2F3E4E]">Claims</h1>
            <p className="text-sm text-[#7A8F79] mt-0.5">Import from Excel/CSV or manage individual claims below.</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileImport}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="cursor-pointer bg-[#2F3E4E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition"
            >
              {importing ? 'Importing…' : 'Import CSV'}
            </label>
          </div>
        </div>

        {/* Import result banner */}
        {importResult && (
          <div className="bg-white border border-[#7A8F79] rounded-xl p-4 mb-4 text-sm text-[#2F3E4E] flex gap-6">
            <span>✓ Import complete</span>
            <span className="text-green-700 font-semibold">{importResult.created} created</span>
            <span className="text-blue-700 font-semibold">{importResult.updated} updated</span>
            {importResult.skipped > 0 && <span className="text-red-600 font-semibold">{importResult.skipped} skipped (nurse not found)</span>}
          </div>
        )}

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Total Claims</p>
            <p className="text-2xl font-bold text-[#2F3E4E] mt-1">{filtered.length}</p>
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

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Search nurse, claim ID, comments…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] w-72"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
          >
            <option value="">All Statuses</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
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
                  <th className="px-4 py-3">Nurse</th>
                  <th className="px-4 py-3">Claim Ctrl ID</th>
                  <th className="px-4 py-3">DOS</th>
                  <th className="px-4 py-3">Submit Status</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Billed</th>
                  <th className="px-4 py-3">Allowed</th>
                  <th className="px-4 py-3">BCBS Paid</th>
                  <th className="px-4 py-3">Check #</th>
                  <th className="px-4 py-3">EOB Date</th>
                  <th className="px-4 py-3">INN/OON</th>
                  <th className="px-4 py-3">Comments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E1E8]">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-[#F4F6F5] transition">
                    <td className="px-4 py-3 font-semibold text-[#2F3E4E] whitespace-nowrap">{c.nurse?.displayName}</td>
                    <td className="px-4 py-3 text-[#7A8F79] font-mono text-xs">{c.claimCtrlId || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-[#2F3E4E]">
                      {fmtDate(c.dosStart)}{c.dosStop ? ` – ${fmtDate(c.dosStop)}` : ''}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={c.submitStatus} /></td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-right text-[#2F3E4E]">{fmt(c.chargeAmount, '$')}</td>
                    <td className="px-4 py-3 text-right text-[#2F3E4E]">{fmt(c.allowedAmount, '$')}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#7A8F79]">{fmt(c.paidAmount, '$')}</td>
                    <td className="px-4 py-3 text-xs text-[#7A8F79]">{c.remitCheckNumber || '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#7A8F79] whitespace-nowrap">{fmtDate(c.eobDate)}</td>
                    <td className="px-4 py-3 text-xs text-[#2F3E4E]">{c.innOon || '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#7A8F79] max-w-xs truncate">{c.statusNote || '—'}</td>
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
