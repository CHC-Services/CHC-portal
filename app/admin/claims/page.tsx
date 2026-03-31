'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import AdminNav from '../../components/AdminNav'

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
  nurse: { displayName: string; accountNumber: string | null }
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

type ClaimGroup = { primary: Claim; originals: Claim[] }

function groupClaims(claims: Claim[]): ClaimGroup[] {
  const superseded = new Set(claims.filter(c => c.resubmissionOf).map(c => c.resubmissionOf!))
  const byClaimId = new Map(claims.filter(c => c.claimId).map(c => [c.claimId!, c]))
  const groups: ClaimGroup[] = []
  for (const c of claims) {
    if (superseded.has(c.claimId || '')) continue
    const originals = c.resubmissionOf && byClaimId.has(c.resubmissionOf)
      ? [byClaimId.get(c.resubmissionOf)!]
      : []
    groups.push({ primary: c, originals })
  }
  return groups
}

function LinkButton({ claim, onLinked }: { claim: Claim; onLinked: () => void }) {
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

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number } | null>(null)
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [expandedOriginals, setExpandedOriginals] = useState<Set<string>>(new Set())

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

  // Exclude superseded originals from totals — only count the most recent submission
  const filteredResubIds = new Set(filtered.filter(c => c.resubmissionOf).map(c => c.resubmissionOf as string))
  const activeFiltered = filtered.filter(c => !c.claimId || !filteredResubIds.has(c.claimId))

  const totalBilled = activeFiltered.reduce((s, c) => s + (c.totalBilled || 0), 0)
  const totalReimbursed = activeFiltered.reduce((s, c) => s + (c.totalReimbursed || 0), 0)
  const totalBalance = activeFiltered.reduce((s, c) => s + (c.remainingBalance || 0), 0)

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
          <div className="flex items-center gap-3">
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

        {/* EDI drop zone */}
        <div className="mb-4 bg-white rounded-xl border-2 border-dashed border-[#D9E1E8] overflow-hidden">
          {/* Mode toggle */}
          <div className="flex border-b border-[#D9E1E8]">
            <button
              type="button"
              onClick={() => setEdiDryRun(false)}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold transition text-center ${
                !ediDryRun
                  ? 'bg-[#2F3E4E] text-white'
                  : 'text-[#7A8F79] hover:bg-[#F4F6F5]'
              }`}
            >
              ✅ Update live claims
            </button>
            <button
              type="button"
              onClick={() => setEdiDryRun(true)}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold transition text-center border-l border-[#D9E1E8] ${
                ediDryRun
                  ? 'bg-amber-500 text-white'
                  : 'text-[#7A8F79] hover:bg-[#F4F6F5]'
              }`}
            >
              👁 Preview only — email summary, no changes
            </button>
          </div>

          {/* Drop area */}
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

            {/* Summary pills */}
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

            {/* Matched detail */}
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

            {/* Unmatched */}
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
                  <th className="px-4 py-3">Link</th>
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
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E1E8]">
                {groupClaims(filtered).map(({ primary: c, originals }) => {
                  const isExpanded = expandedOriginals.has(c.id)
                  const toggleOriginals = () => setExpandedOriginals(prev => {
                    const next = new Set(prev)
                    if (next.has(c.id)) next.delete(c.id); else next.add(c.id)
                    return next
                  })
                  return (
                    <Fragment key={c.id}>
                      <tr className="hover:bg-[#F4F6F5] transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <LinkButton claim={c} onLinked={loadClaims} />
                            {originals.length > 0 && (
                              <button onClick={toggleOriginals} title={isExpanded ? 'Hide original' : 'Show original'} className="text-[11px] text-[#7A8F79] hover:text-[#2F3E4E] transition ml-1 leading-none">
                                {isExpanded ? '▲' : '▼'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#2F3E4E] whitespace-nowrap">{c.providerName || c.nurse?.displayName}</td>
                        <td className="px-4 py-3 text-[#7A8F79] font-mono text-xs">
                          {c.resubmissionOf && <span className="block text-blue-500 text-[10px] mb-0.5">↻ resubmission</span>}
                          {c.claimId || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-[#2F3E4E]">{fmtDOS(c.dosStart, c.dosStop)}</td>
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
                        <td className={`px-4 py-3 text-right font-semibold ${(c.remainingBalance || 0) > 0 ? 'text-red-600' : 'text-[#2F3E4E]'}`}>{fmt(c.remainingBalance, '$')}</td>
                        <td className="px-4 py-3 text-xs text-[#7A8F79] whitespace-nowrap">{fmtDate(c.dateFullyFinalized)}</td>
                        <td className="px-4 py-3 text-xs text-[#7A8F79] max-w-xs truncate">{c.processingNotes || '—'}</td>
                      </tr>
                      {isExpanded && originals.map(orig => (
                        <tr key={orig.id} className="bg-red-50 text-xs text-[#7A8F79] border-l-4 border-red-200">
                          <td className="px-4 py-2 text-[10px] text-red-400 font-semibold whitespace-nowrap">Original</td>
                          <td className="px-4 py-2">{orig.providerName || orig.nurse?.displayName}</td>
                          <td className="px-4 py-2 font-mono">{orig.claimId || '—'}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{fmtDOS(orig.dosStart, orig.dosStop)}</td>
                          <td className="px-4 py-2"><StageBadge stage={orig.claimStage} /></td>
                          <td className="px-4 py-2 text-right">{fmt(orig.totalBilled, '$')}</td>
                          <td className="px-4 py-2 border-l border-[#D9E1E8]">{orig.primaryPayer || '—'}</td>
                          <td className="px-4 py-2 text-right">{fmt(orig.primaryAllowedAmt, '$')}</td>
                          <td className="px-4 py-2 text-right">{fmt(orig.primaryPaidAmt, '$')}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{fmtDate(orig.primaryPaidDate)}</td>
                          <td className="px-4 py-2">{orig.primaryPaidTo || '—'}</td>
                          <td className="px-4 py-2 border-l border-[#D9E1E8]">{orig.secondaryPayer || '—'}</td>
                          <td className="px-4 py-2 text-right">{fmt(orig.secondaryAllowedAmt, '$')}</td>
                          <td className="px-4 py-2 text-right">{fmt(orig.secondaryPaidAmt, '$')}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{fmtDate(orig.secondaryPaidDate)}</td>
                          <td className="px-4 py-2">{orig.secondaryPaidTo || '—'}</td>
                          <td className="px-4 py-2 border-l border-[#D9E1E8] text-right">{fmt(orig.totalReimbursed, '$')}</td>
                          <td className="px-4 py-2 text-right">{fmt(orig.remainingBalance, '$')}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{fmtDate(orig.dateFullyFinalized)}</td>
                          <td className="px-4 py-2 max-w-xs truncate">{orig.processingNotes || '—'}</td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}
