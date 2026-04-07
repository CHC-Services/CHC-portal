'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import AdminNav from '../../components/AdminNav'

type EobDoc = {
  id: string
  fileName: string
  claimId: string   // = Claim.id (DB UUID)
  nurseId: string
}

type Claim = {
  id: string
  nurseId: string
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
  const [filterYear, setFilterYear] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [expandedOriginals, setExpandedOriginals] = useState<Set<string>>(new Set())

  // Bulk import mode
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkModeLoading, setBulkModeLoading] = useState(false)
  const [bulkFlushMsg, setBulkFlushMsg] = useState<string | null>(null)

  // Inline editing
  const [editCell, setEditCell] = useState<{ id: string; field: string } | null>(null)
  const [editVal, setEditVal] = useState('')
  const [editVal2, setEditVal2] = useState('') // used for dosStop when editing dosStart

  // Add Claim modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState<Record<string, string>>({ claimStage: 'Draft' })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

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

  // EOB state — keyed by Claim.id (DB UUID), supports multiple EOBs per claim
  const [eobMap, setEobMap] = useState<Record<string, EobDoc[]>>({})
  const [eobUploading, setEobUploading] = useState<string | null>(null)  // claim DB id
  const [eobDeleting, setEobDeleting] = useState<string | null>(null)    // doc id

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

  async function handleEobUpload(claim: Claim, file: File) {
    setEobUploading(claim.id)
    try {
      // Step 1 — presign
      const presignRes = await fetch('/api/admin/documents/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/octet-stream', nurseId: claim.nurseId, category: 'EOB' }),
      })
      const presign = await presignRes.json()
      if (!presignRes.ok) throw new Error(presign.error || 'Presign failed')

      // Step 2 — upload to S3
      const form = new FormData()
      Object.entries(presign.fields as Record<string, string>).forEach(([k, v]) => form.append(k, v))
      form.append('file', file)
      await fetch(presign.url, { method: 'POST', body: form, mode: 'no-cors' })

      // Step 3 — confirm record with claimId + visibleToNurse
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
      if (confirmData.ok) {
        await loadEobs()
      }
    } catch (err) {
      console.error('EOB upload error:', err)
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

  // Load initial state
  useEffect(() => {
    fetch('/api/admin/system-settings', { credentials: 'include' })
      .then(r => r.ok ? r.json() : {})
      .then((s: Record<string, string>) => { if (s.bulkImportMode === 'true') setBulkMode(true) })
      .catch(() => {})
    loadClaims()
    loadEobs()
  }, [])

  async function toggleBulkMode() {
    const next = !bulkMode
    setBulkModeLoading(true)
    setBulkFlushMsg(null)
    // Save the new mode
    await fetch('/api/admin/system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: 'bulkImportMode', value: String(next) }),
    })
    if (!next) {
      // Turning OFF — flush queued notifications
      const res = await fetch('/api/admin/notifications/flush', {
        method: 'POST',
        credentials: 'include',
      })
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

  // Inline editing helpers
  function startEdit(id: string, field: string, currentVal: string, currentVal2 = '') {
    setEditCell({ id, field })
    setEditVal(currentVal)
    setEditVal2(currentVal2)
  }

  async function commitEdit() {
    if (!editCell) return
    const { id, field } = editCell
    setEditCell(null)
    // For DOS, save both start and stop together
    const body = field === 'dosStart'
      ? { dosStart: editVal, dosStop: editVal2 }
      : { [field]: editVal }
    // Optimistic update in local state
    setClaims(prev => prev.map(c => c.id !== id ? c : { ...c, ...body }))
    await fetch(`/api/admin/claims/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    }).catch(() => {})
  }

  function cancelEdit() { setEditCell(null) }

  function openAddModal() {
    setAddForm({ claimStage: 'Draft' })
    setAddError(null)
    setShowAddModal(true)
  }

  async function submitClaim(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.providerName?.trim()) { setAddError('Provider name is required.'); return }
    setAdding(true)
    setAddError(null)
    const res = await fetch('/api/admin/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(addForm),
    })
    const data = await res.json()
    if (!res.ok) { setAddError(data.error || 'Failed to create claim.'); setAdding(false); return }
    setClaims(prev => [data.claim, ...prev])
    setShowAddModal(false)
    setAdding(false)
  }

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
    const matchYear = !filterYear || (c.dosStart ? new Date(c.dosStart).getUTCFullYear().toString() === filterYear : false)
    return matchSearch && matchStage && matchYear
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
          <div className="flex items-center gap-3 flex-wrap">
            {/* Bulk Import Mode toggle */}
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
              onClick={openAddModal}
              className="flex items-center gap-1.5 bg-[#7A8F79] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2F3E4E] transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Claim
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileImport} className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className="cursor-pointer bg-[#2F3E4E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition">
              {importing ? 'Importing…' : 'Import CSV'}
            </label>
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
                  <th className="px-4 py-3">EOB</th>
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
                          <div className="flex flex-col gap-1 min-w-[72px]">
                            {(eobMap[c.id] || []).map((eob, i) => (
                              <div key={eob.id} className="flex items-center gap-1">
                                <button
                                  onClick={async () => {
                                    const res = await fetch(`/api/admin/documents/${eob.id}`, { credentials: 'include' })
                                    const data = await res.json()
                                    if (data.url) window.open(data.url, '_blank')
                                  }}
                                  title={eob.fileName}
                                  className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded hover:bg-green-100 transition whitespace-nowrap"
                                >
                                  📎 EOB {(eobMap[c.id] || []).length > 1 ? i + 1 : ''}
                                </button>
                                <button
                                  onClick={() => deleteEob(eob.id)}
                                  disabled={eobDeleting === eob.id}
                                  title="Delete EOB"
                                  className="text-[10px] text-red-400 hover:text-red-600 border border-red-100 px-1 py-0.5 rounded transition disabled:opacity-40"
                                >
                                  {eobDeleting === eob.id ? '…' : '✕'}
                                </button>
                              </div>
                            ))}
                            <label className={`cursor-pointer text-[10px] font-semibold text-[#7A8F79] border border-dashed border-[#D9E1E8] px-1.5 py-0.5 rounded hover:border-[#7A8F79] hover:text-[#2F3E4E] transition whitespace-nowrap ${eobUploading === c.id ? 'opacity-50 cursor-default' : ''}`}>
                              {eobUploading === c.id ? '…' : '+ EOB'}
                              <input
                                type="file"
                                className="hidden"
                                disabled={eobUploading === c.id}
                                accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
                                onChange={e => {
                                  const file = e.target.files?.[0]
                                  if (file) handleEobUpload(c, file)
                                  e.target.value = ''
                                }}
                              />
                            </label>
                          </div>
                        </td>
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
                        {/* Provider — editable text */}
                        <td className="px-4 py-3 font-semibold text-[#2F3E4E] whitespace-nowrap" onDoubleClick={() => startEdit(c.id, 'providerName', c.providerName || '')}>
                          {editCell?.id === c.id && editCell.field === 'providerName'
                            ? <input autoFocus className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-sm w-32 focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{c.providerName || c.nurse?.displayName}</span>}
                        </td>
                        {/* Claim ID — editable text */}
                        <td className="px-4 py-3 text-[#7A8F79] font-mono text-xs" onDoubleClick={() => startEdit(c.id, 'claimId', c.claimId || '')}>
                          {c.resubmissionOf && <span className="block text-blue-500 text-[10px] mb-0.5">↻ resubmission</span>}
                          {editCell?.id === c.id && editCell.field === 'claimId'
                            ? <input autoFocus className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs font-mono w-28 focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{c.claimId || '—'}</span>}
                        </td>
                        {/* DOS — editable date pair (dosStart + dosStop together) */}
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-[#2F3E4E]" onDoubleClick={() => startEdit(c.id, 'dosStart', c.dosStart ? new Date(c.dosStart).toISOString().slice(0,10) : '', c.dosStop ? new Date(c.dosStop).toISOString().slice(0,10) : '')}>
                          {editCell?.id === c.id && editCell.field === 'dosStart'
                            ? <div className="flex items-center gap-1">
                                <input autoFocus type="date" className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                                <span className="text-[#7A8F79]">–</span>
                                <input type="date" className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editVal2} onChange={e => setEditVal2(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                              </div>
                            : <span title="Double-click to edit">{fmtDOS(c.dosStart, c.dosStop)}</span>}
                        </td>
                        {/* Stage — editable select */}
                        <td className="px-4 py-3" onDoubleClick={() => startEdit(c.id, 'claimStage', c.claimStage || '')}>
                          {editCell?.id === c.id && editCell.field === 'claimStage'
                            ? <select autoFocus className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}>
                                <option value="">—</option>
                                {['Draft','INS-1 Submitted','Resubmitted','Pending','Info Requested','Info Sent','INS-2 Submitted','Appealed','Paid','Denied','Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            : <span title="Double-click to edit"><StageBadge stage={c.claimStage} /></span>}
                        </td>
                        {/* Total Billed — editable number */}
                        <td className="px-4 py-3 text-right text-[#2F3E4E]" onDoubleClick={() => startEdit(c.id, 'totalBilled', c.totalBilled != null ? String(c.totalBilled) : '')}>
                          {editCell?.id === c.id && editCell.field === 'totalBilled'
                            ? <input autoFocus type="number" step="0.01" className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs text-right w-24 focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{fmt(c.totalBilled, '$')}</span>}
                        </td>
                        {/* Primary Payer */}
                        <td className="px-4 py-3 border-l border-[#D9E1E8] text-[#2F3E4E]" onDoubleClick={() => startEdit(c.id, 'primaryPayer', c.primaryPayer || '')}>
                          {editCell?.id === c.id && editCell.field === 'primaryPayer'
                            ? <input autoFocus className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs w-28 focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{c.primaryPayer || '—'}</span>}
                        </td>
                        {/* Primary Allowed */}
                        <td className="px-4 py-3 text-right text-[#2F3E4E]" onDoubleClick={() => startEdit(c.id, 'primaryAllowedAmt', c.primaryAllowedAmt != null ? String(c.primaryAllowedAmt) : '')}>
                          {editCell?.id === c.id && editCell.field === 'primaryAllowedAmt'
                            ? <input autoFocus type="number" step="0.01" className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs text-right w-20 focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{fmt(c.primaryAllowedAmt, '$')}</span>}
                        </td>
                        {/* Primary Paid */}
                        <td className="px-4 py-3 text-right font-semibold text-[#7A8F79]" onDoubleClick={() => startEdit(c.id, 'primaryPaidAmt', c.primaryPaidAmt != null ? String(c.primaryPaidAmt) : '')}>
                          {editCell?.id === c.id && editCell.field === 'primaryPaidAmt'
                            ? <input autoFocus type="number" step="0.01" className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs text-right w-20 focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{fmt(c.primaryPaidAmt, '$')}</span>}
                        </td>
                        {/* Primary Paid Date */}
                        <td className="px-4 py-3 text-xs text-[#7A8F79] whitespace-nowrap" onDoubleClick={() => startEdit(c.id, 'primaryPaidDate', c.primaryPaidDate ? new Date(c.primaryPaidDate).toISOString().slice(0,10) : '')}>
                          {editCell?.id === c.id && editCell.field === 'primaryPaidDate'
                            ? <input autoFocus type="date" className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{fmtDate(c.primaryPaidDate)}</span>}
                        </td>
                        {/* Primary Paid To */}
                        <td className="px-4 py-3 text-xs text-[#2F3E4E]" onDoubleClick={() => startEdit(c.id, 'primaryPaidTo', c.primaryPaidTo || '')}>
                          {editCell?.id === c.id && editCell.field === 'primaryPaidTo'
                            ? <input autoFocus className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs w-24 focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{c.primaryPaidTo || '—'}</span>}
                        </td>
                        {/* Secondary Payer */}
                        <td className="px-4 py-3 border-l border-[#D9E1E8] text-[#2F3E4E]" onDoubleClick={() => startEdit(c.id, 'secondaryPayer', c.secondaryPayer || '')}>
                          {editCell?.id === c.id && editCell.field === 'secondaryPayer'
                            ? <input autoFocus className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs w-28 focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{c.secondaryPayer || '—'}</span>}
                        </td>
                        {/* Secondary Allowed */}
                        <td className="px-4 py-3 text-right text-[#2F3E4E]" onDoubleClick={() => startEdit(c.id, 'secondaryAllowedAmt', c.secondaryAllowedAmt != null ? String(c.secondaryAllowedAmt) : '')}>
                          {editCell?.id === c.id && editCell.field === 'secondaryAllowedAmt'
                            ? <input autoFocus type="number" step="0.01" className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs text-right w-20 focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{fmt(c.secondaryAllowedAmt, '$')}</span>}
                        </td>
                        {/* Secondary Paid */}
                        <td className="px-4 py-3 text-right font-semibold text-[#7A8F79]" onDoubleClick={() => startEdit(c.id, 'secondaryPaidAmt', c.secondaryPaidAmt != null ? String(c.secondaryPaidAmt) : '')}>
                          {editCell?.id === c.id && editCell.field === 'secondaryPaidAmt'
                            ? <input autoFocus type="number" step="0.01" className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs text-right w-20 focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{fmt(c.secondaryPaidAmt, '$')}</span>}
                        </td>
                        {/* Secondary Paid Date */}
                        <td className="px-4 py-3 text-xs text-[#7A8F79] whitespace-nowrap" onDoubleClick={() => startEdit(c.id, 'secondaryPaidDate', c.secondaryPaidDate ? new Date(c.secondaryPaidDate).toISOString().slice(0,10) : '')}>
                          {editCell?.id === c.id && editCell.field === 'secondaryPaidDate'
                            ? <input autoFocus type="date" className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{fmtDate(c.secondaryPaidDate)}</span>}
                        </td>
                        {/* Secondary Paid To */}
                        <td className="px-4 py-3 text-xs text-[#2F3E4E]" onDoubleClick={() => startEdit(c.id, 'secondaryPaidTo', c.secondaryPaidTo || '')}>
                          {editCell?.id === c.id && editCell.field === 'secondaryPaidTo'
                            ? <input autoFocus className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs w-24 focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{c.secondaryPaidTo || '—'}</span>}
                        </td>
                        {/* Total Reimbursed */}
                        <td className="px-4 py-3 border-l border-[#D9E1E8] text-right font-semibold text-[#7A8F79]" onDoubleClick={() => startEdit(c.id, 'totalReimbursed', c.totalReimbursed != null ? String(c.totalReimbursed) : '')}>
                          {editCell?.id === c.id && editCell.field === 'totalReimbursed'
                            ? <input autoFocus type="number" step="0.01" className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs text-right w-20 focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{fmt(c.totalReimbursed, '$')}</span>}
                        </td>
                        {/* Remaining Balance */}
                        <td className={`px-4 py-3 text-right font-semibold ${(c.remainingBalance || 0) > 0 ? 'text-red-600' : 'text-[#2F3E4E]'}`} onDoubleClick={() => startEdit(c.id, 'remainingBalance', c.remainingBalance != null ? String(c.remainingBalance) : '')}>
                          {editCell?.id === c.id && editCell.field === 'remainingBalance'
                            ? <input autoFocus type="number" step="0.01" className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs text-right w-20 focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{fmt(c.remainingBalance, '$')}</span>}
                        </td>
                        {/* Date Fully Finalized */}
                        <td className="px-4 py-3 text-xs text-[#7A8F79] whitespace-nowrap" onDoubleClick={() => startEdit(c.id, 'dateFullyFinalized', c.dateFullyFinalized ? new Date(c.dateFullyFinalized).toISOString().slice(0,10) : '')}>
                          {editCell?.id === c.id && editCell.field === 'dateFullyFinalized'
                            ? <input autoFocus type="date" className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{fmtDate(c.dateFullyFinalized)}</span>}
                        </td>
                        {/* Processing Notes */}
                        <td className="px-4 py-3 text-xs text-[#7A8F79] max-w-xs truncate" onDoubleClick={() => startEdit(c.id, 'processingNotes', c.processingNotes || '')}>
                          {editCell?.id === c.id && editCell.field === 'processingNotes'
                            ? <input autoFocus className="border border-[#7A8F79] rounded px-1.5 py-0.5 text-xs w-48 focus:outline-none" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }} />
                            : <span title="Double-click to edit">{c.processingNotes || '—'}</span>}
                        </td>
                      </tr>
                      {isExpanded && originals.map(orig => (
                        <tr key={orig.id} className="bg-red-50 text-xs text-[#7A8F79] border-l-4 border-red-200">
                          <td className="px-4 py-2"></td>
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

      {/* Add Claim Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9E1E8]">
              <h2 className="text-lg font-bold text-[#2F3E4E]">Add Claim Manually</h2>
              <button onClick={() => setShowAddModal(false)} className="text-[#7A8F79] hover:text-[#2F3E4E] text-xl leading-none">✕</button>
            </div>

            <form onSubmit={submitClaim} className="px-6 py-5 space-y-6">

              {addError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{addError}</div>
              )}

              {/* Provider + Claim ID + Stage */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3">Claim Info</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Provider Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Janine Barone"
                      value={addForm.providerName || ''}
                      onChange={e => setAddForm(f => ({ ...f, providerName: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Claim ID</label>
                    <input type="text" value={addForm.claimId || ''} onChange={e => setAddForm(f => ({ ...f, claimId: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Claim Stage</label>
                    <select value={addForm.claimStage || 'Draft'} onChange={e => setAddForm(f => ({ ...f, claimStage: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]">
                      {['Draft','INS-1 Submitted','Resubmitted','Pending','Info Requested','Info Sent','INS-2 Submitted','Appealed','Paid','Denied','Rejected'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">DOS Start</label>
                    <input type="date" value={addForm.dosStart || ''} onChange={e => setAddForm(f => ({ ...f, dosStart: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">DOS Stop</label>
                    <input type="date" value={addForm.dosStop || ''} onChange={e => setAddForm(f => ({ ...f, dosStop: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Total Billed</label>
                    <input type="number" step="0.01" min="0" value={addForm.totalBilled || ''} onChange={e => setAddForm(f => ({ ...f, totalBilled: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                </div>
              </div>

              {/* Primary Insurance */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3 border-t border-[#D9E1E8] pt-4">Primary Insurance</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Payer</label>
                    <input type="text" value={addForm.primaryPayer || ''} onChange={e => setAddForm(f => ({ ...f, primaryPayer: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Allowed Amt</label>
                    <input type="number" step="0.01" min="0" value={addForm.primaryAllowedAmt || ''} onChange={e => setAddForm(f => ({ ...f, primaryAllowedAmt: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Paid Amt</label>
                    <input type="number" step="0.01" min="0" value={addForm.primaryPaidAmt || ''} onChange={e => setAddForm(f => ({ ...f, primaryPaidAmt: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Paid Date</label>
                    <input type="date" value={addForm.primaryPaidDate || ''} onChange={e => setAddForm(f => ({ ...f, primaryPaidDate: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Paid To</label>
                    <input type="text" value={addForm.primaryPaidTo || ''} onChange={e => setAddForm(f => ({ ...f, primaryPaidTo: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                </div>
              </div>

              {/* Secondary Insurance */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3 border-t border-[#D9E1E8] pt-4">Secondary Insurance</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Payer</label>
                    <input type="text" value={addForm.secondaryPayer || ''} onChange={e => setAddForm(f => ({ ...f, secondaryPayer: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Allowed Amt</label>
                    <input type="number" step="0.01" min="0" value={addForm.secondaryAllowedAmt || ''} onChange={e => setAddForm(f => ({ ...f, secondaryAllowedAmt: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Paid Amt</label>
                    <input type="number" step="0.01" min="0" value={addForm.secondaryPaidAmt || ''} onChange={e => setAddForm(f => ({ ...f, secondaryPaidAmt: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Paid Date</label>
                    <input type="date" value={addForm.secondaryPaidDate || ''} onChange={e => setAddForm(f => ({ ...f, secondaryPaidDate: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Paid To</label>
                    <input type="text" value={addForm.secondaryPaidTo || ''} onChange={e => setAddForm(f => ({ ...f, secondaryPaidTo: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-3 border-t border-[#D9E1E8] pt-4">Summary</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Total Reimbursed</label>
                    <input type="number" step="0.01" min="0" value={addForm.totalReimbursed || ''} onChange={e => setAddForm(f => ({ ...f, totalReimbursed: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Remaining Balance</label>
                    <input type="number" step="0.01" min="0" value={addForm.remainingBalance || ''} onChange={e => setAddForm(f => ({ ...f, remainingBalance: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Date Fully Finalized</label>
                    <input type="date" value={addForm.dateFullyFinalized || ''} onChange={e => setAddForm(f => ({ ...f, dateFullyFinalized: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Processing Notes</label>
                    <textarea rows={2} value={addForm.processingNotes || ''} onChange={e => setAddForm(f => ({ ...f, processingNotes: e.target.value }))}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
                  </div>
                </div>
              </div>

              {/* Actions */}
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
      )}

    </div>
  )
}
