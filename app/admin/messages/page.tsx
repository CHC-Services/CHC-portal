'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminNav from '../../components/AdminNav'

// ─── Shared types ─────────────────────────────────────────────────────────────
type PortalMessage = {
  id: string
  title?: string | null
  body: string
  category: string
  audiences: string[]
  createdAt: string
}
type Nurse = { id: string; displayName: string; user: { email: string } }
type ClaimForLetter = {
  id: string; claimId: string | null; providerName: string | null
  dosStart: string | null; dosStop: string | null; submitDate: string | null
  primaryPayer: string | null; nurseId: string; nurse: { displayName: string }
}
type NurseProfile = {
  id: string; displayName: string; firstName: string | null
  lastName: string | null; npiNumber: string | null; phone: string | null
}

// ─── Utilities ────────────────────────────────────────────────────────────────
const CATEGORIES = ['General', 'Claims', 'Invoices', 'Events']
const SYSTEM_AUDIENCES = [
  { value: 'All Users',      label: 'All Users',       desc: 'Every logged-in user' },
  { value: 'All Nurses',     label: 'All Nurses',      desc: 'All accounts with nurse role' },
  { value: 'Active Billing', label: 'Active Billing',  desc: 'Nurses enrolled in billing services' },
  { value: 'Non-Provider',   label: 'Non-Provider',    desc: 'Nurses not enrolled in billing' },
  { value: 'Admins',         label: 'Admins',          desc: 'Admin accounts only' },
]
const CATEGORY_STYLE: Record<string, string> = {
  General: 'bg-[#F4F6F5] text-[#7A8F79] border-[#D9E1E8]',
  Claims:  'bg-blue-50 text-blue-700 border-blue-200',
  Invoices:'bg-green-50 text-green-700 border-green-200',
  Events:  'bg-amber-50 text-amber-700 border-amber-200',
}

function fmtDateShort(val: string | null) {
  if (!val) return ''
  return new Date(val).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' })
}
function fmtDOS(start: string | null, stop: string | null) {
  const s = fmtDateShort(start)
  const e = fmtDateShort(stop)
  return !s ? '' : (e && e !== s ? `${s} – ${e}` : s)
}
function addDays(dateStr: string, days: number) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' })
}
function escHtml(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─── Letter HTML builder — produces a complete standalone HTML document ────────
function buildLetterHTML(f: {
  claimNum: string; memberId: string; providerId: string; dos: string
  submitDateHdr: string; bodySubmitDate: string; payerName: string
  pendStatus: string; bodyDos: string; day30: string
  sigProviderName: string; faxNumber: string; today: string; logoUrl: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Prompt Pay — ${escHtml(f.claimNum || 'Draft')}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,'Times New Roman',serif;font-size:13.5px;line-height:1.75;color:#1a1a1a;background:#fff;padding:1in 1.1in}
.preview-bar{position:fixed;top:0;left:0;right:0;background:#2F3E4E;color:#fff;padding:10px 20px;display:flex;align-items:center;gap:12px;font-family:sans-serif;font-size:13px;z-index:999;box-shadow:0 2px 8px rgba(0,0,0,0.3)}
.preview-bar .spacer{flex:1}
.btn{background:#7A8F79;color:#fff;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:12.5px;font-weight:700;letter-spacing:.02em;transition:background .15s}
.btn:hover{background:#fff;color:#2F3E4E}
.btn-ghost{background:transparent;border:1px solid rgba(255,255,255,.35)}
.btn-ghost:hover{background:rgba(255,255,255,.15);color:#fff}
.letter{padding-top:52px}
.date-right{text-align:right;font-family:sans-serif;font-size:11px;color:#888;margin-bottom:1.5rem}
.subject{font-family:sans-serif;font-size:14px;font-weight:700;color:#111;margin-bottom:.2rem}
.rule{border:none;border-top:2.5px solid #2F3E4E;margin-bottom:1.5rem}
.hbox{background:#f7f8f7;border:1px solid #ccc;border-radius:4px;padding:14px 18px;margin-bottom:1.5rem;font-family:sans-serif;font-size:12.5px}
.hrow{display:flex;align-items:baseline;gap:10px;margin-bottom:5px}
.hrow:last-child{margin-bottom:0}
.hlabel{font-weight:700;color:#444;width:11rem;flex-shrink:0}
.hval{color:#111;flex:1}
p.body{margin-bottom:1rem}
.req-title{font-family:sans-serif;font-size:13px;font-weight:700;color:#2F3E4E;margin-bottom:.5rem}
ol.req{padding-left:1.5rem;margin-bottom:1rem}
ol.req li{margin-bottom:.4rem}
.sig{margin-top:2.5rem}
.sincerely{font-family:sans-serif;font-size:13px;margin-bottom:1.5rem}
.sig-row{display:flex;align-items:center}
.sig-left{padding-right:1.5rem;border-right:1px solid #D9E1E8;font-family:sans-serif;font-size:12px;font-weight:700;color:#7A8F79;-webkit-text-stroke:1.5px rgba(183,210,181,.5);line-height:1.45}
.sig-name{color:#2F3E4E;-webkit-text-stroke:0px}
.sig-right{padding-left:1.5rem;display:flex;flex-direction:column;align-items:center}
.sig-right img{height:44px;width:auto;object-fit:contain;margin-bottom:4px}
.sig-co{font-family:sans-serif;font-size:10px;font-weight:600;color:#2F3E4E;line-height:1.3;text-align:center}
.contacts{margin-top:1rem;padding-top:.75rem;border-top:1px solid #D9E1E8;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.pill{display:inline-flex;align-items:center;gap:4px;background:#F4F6F5;border:1px solid #D9E1E8;border-radius:999px;padding:2px 10px;font-family:sans-serif;font-size:10px;color:#2F3E4E;font-weight:600}
@media print{
  .preview-bar{display:none!important}
  .letter{padding-top:0}
  body{padding:0}
  @page{size:letter portrait;margin:.8in 1in}
}
</style>
</head>
<body>
<div class="preview-bar">
  <span>📄 &nbsp;Prompt Pay Violation &amp; Interest Request &nbsp;·&nbsp; <strong>${escHtml(f.claimNum || 'Draft')}</strong></span>
  <span class="spacer"></span>
  <button class="btn" onclick="window.print()">🖨&nbsp; Print Now</button>
  <button class="btn btn-ghost" onclick="window.close()">✕ &nbsp;Close Preview</button>
</div>
<div class="letter">
  <p class="date-right">${escHtml(f.today)}</p>
  <p class="subject">Re: Prompt Pay Violation and Interest Request — NY §3224-a</p>
  <hr class="rule"/>
  <div class="hbox">
    <div class="hrow"><span class="hlabel">Claim Number:</span><span class="hval">${escHtml(f.claimNum)}</span></div>
    <div class="hrow"><span class="hlabel">Member ID:</span><span class="hval">${escHtml(f.memberId)}</span></div>
    <div class="hrow"><span class="hlabel">Provider ID (NPI):</span><span class="hval">${escHtml(f.providerId)}</span></div>
    <div class="hrow"><span class="hlabel">Date(s) of Service:</span><span class="hval">${escHtml(f.dos)}</span></div>
    <div class="hrow"><span class="hlabel">Date Submitted (EDI):</span><span class="hval">${escHtml(f.submitDateHdr)}</span></div>
  </div>
  <p class="body">This correspondence is to formally dispute the delayed adjudication of the above-referenced claim.</p>
  <p class="body">The claim was submitted electronically on <strong>${escHtml(f.bodySubmitDate)}</strong> and meets the definition of a &ldquo;clean claim&rdquo; under NY Insurance Law §3224-a. As of today, the claim remains in a pend status (${escHtml(f.pendStatus)}) and ${escHtml(f.payerName)} has not provided documented justification — there is no documented request for additional information, no eligibility or coordination of benefits issue, and no valid basis for failing to adjudicate the claim.</p>
  <p class="body">A prior authorization was obtained for the services rendered, and similar services by the same member (DOS ${escHtml(f.bodyDos)}) have been adjudicated and paid by other providers, further supporting that no systemic eligibility or coverage issue exists.</p>
  <p class="body">Per NY Prompt Pay law, clean claims submitted electronically must be adjudicated within 30 days. This timeframe has been exceeded, and no billing event has occurred. Accordingly, this delay constitutes a violation of §3224-a.</p>
  <div>
    <p class="req-title">We Request:</p>
    <ol class="req">
      <li>Immediate adjudication of the claim.</li>
      <li>Payment of applicable statutory interest (12% annually) calculated from <strong>${escHtml(f.day30)}</strong> until the date of payment.</li>
    </ol>
  </div>
  <p class="body">Please provide written confirmation of claim status and resolution. If additional information is required, please respond clearly and promptly.</p>
  <div class="sig">
    <p class="sincerely">Sincerely,</p>
    <div class="sig-row">
      <div class="sig-left">
        Billing on behalf of<br>
        provider <span class="sig-name">${escHtml(f.sigProviderName) || '[Provider Name]'}</span>.
      </div>
      <div class="sig-right">
        <img src="${escHtml(f.logoUrl)}" alt="Coming Home Care"/>
        <span class="sig-co">Coming Home Care<br>Services, LLC</span>
      </div>
    </div>
    <div class="contacts">
      <span class="pill">🌐 cominghomecare.com</span>
      <span class="pill">📠 ${escHtml(f.faxNumber)}</span>
      <span class="pill">✉ support@cominghomecare.com</span>
    </div>
  </div>
</div>
</body>
</html>`
}

// ─── Inline editable field ────────────────────────────────────────────────────
function InlineField({ value, onChange, widthCh = 18, placeholder = '' }: {
  value: string; onChange: (v: string) => void; widthCh?: number; placeholder?: string
}) {
  return (
    <input
      type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      size={Math.max(widthCh, value.length + 2)}
      className="inline-block align-baseline border-b border-[#7A8F79] bg-[#f0f4f0] rounded-sm px-1 py-0 leading-[inherit] focus:outline-none focus:border-[#2F3E4E] focus:bg-green-50 transition-colors"
      style={{ fontFamily: 'inherit', fontSize: 'inherit', minWidth: `${widthCh}ch` }}
    />
  )
}

// ─── Header row field ─────────────────────────────────────────────────────────
function HeaderField({ label, value, onChange, widthCh = 26 }: {
  label: string; value: string; onChange: (v: string) => void; widthCh?: number
}) {
  return (
    <div className="flex items-baseline gap-3 text-[13px]">
      <span className="font-bold text-gray-700 shrink-0" style={{ width: '11rem' }}>{label}</span>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        size={Math.max(widthCh, value.length + 2)}
        className="flex-1 border-b border-gray-400 bg-gray-50 px-1 py-0.5 text-gray-900 focus:outline-none focus:border-[#2F3E4E] focus:bg-green-50 transition-colors"
        style={{ fontFamily: 'inherit', fontSize: 'inherit', minWidth: `${widthCh}ch` }}
      />
    </div>
  )
}

// ─── Prompt Pay Letter Overlay ────────────────────────────────────────────────
function PromptPayOverlay({ onClose }: { onClose: () => void }) {
  const [claims, setClaims]       = useState<ClaimForLetter[]>([])
  const [nurseMap, setNurseMap]   = useState<Record<string, NurseProfile>>({})
  const [selectedDbId, setSelectedDbId] = useState('')
  const [loadingData, setLoadingData] = useState(true)

  // Editable letter fields
  const [claimNum, setClaimNum]             = useState('')
  const [memberId, setMemberId]             = useState('CQP383W14668')
  const [providerId, setProviderId]         = useState('')
  const [dos, setDos]                       = useState('')
  const [submitDateHdr, setSubmitDateHdr]   = useState('')
  const [bodySubmitDate, setBodySubmitDate] = useState('')
  const [payerName, setPayerName]           = useState('[Payer Name]')
  const [pendStatus, setPendStatus]         = useState('PEND-P')
  const [bodyDos, setBodyDos]               = useState('')
  const [day30, setDay30]                   = useState('')
  const [sigProviderName, setSigProviderName] = useState('')
  const [faxNumber, setFaxNumber]           = useState('(XXX) XXX-XXXX')

  // Action state
  const [postAction, setPostAction] = useState<{ type: 'save' | 'print'; fileName: string } | null>(null)
  const [cloudSaving, setCloudSaving]   = useState(false)
  const [cloudResult, setCloudResult]   = useState<{ fileName: string; version: number } | null>(null)
  const [cloudError, setCloudError]     = useState('')
  const [sendLoading, setSendLoading]   = useState(false)
  const [sendResult, setSendResult]     = useState<{ fileName: string; version: number } | null>(null)
  const [sendError, setSendError]       = useState('')

  // Load claims + nurse profiles
  useEffect(() => {
    Promise.all([
      fetch('/api/admin/claims', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/nurses', { credentials: 'include' }).then(r => r.json()),
    ]).then(([cd, nd]) => {
      if (cd.claims) setClaims(cd.claims)
      if (Array.isArray(nd)) {
        const map: Record<string, NurseProfile> = {}
        for (const n of nd) map[n.id] = n
        setNurseMap(map)
      }
    }).finally(() => setLoadingData(false))
  }, [])

  function selectClaim(dbId: string) {
    setSelectedDbId(dbId)
    const claim = claims.find(c => c.id === dbId)
    if (!claim) return
    const nurse = nurseMap[claim.nurseId]
    const dosRange  = fmtDOS(claim.dosStart, claim.dosStop)
    const submitFmt = fmtDateShort(claim.submitDate)
    const d30       = claim.submitDate ? addDays(claim.submitDate, 30) : ''
    setClaimNum(claim.claimId || '')
    setProviderId(nurse?.npiNumber || '')
    setDos(dosRange)
    setSubmitDateHdr(submitFmt)
    setBodySubmitDate(submitFmt)
    setPayerName(claim.primaryPayer || '[Payer Name]')
    setBodyDos(dosRange)
    setDay30(d30)
    setSigProviderName(claim.providerName || nurse?.displayName || '')
    // Reset prior action results when a new claim is selected
    setPostAction(null); setCloudResult(null); setSendResult(null); setSendError('')
  }

  function getLetterFields() {
    return {
      claimNum, memberId, providerId, dos, submitDateHdr,
      bodySubmitDate, payerName, pendStatus, bodyDos, day30,
      sigProviderName, faxNumber,
      today: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      logoUrl: `${window.location.origin}/chc_logo.png`,
    }
  }

  // ── Save (Download to device) ──────────────────────────────────────────────
  function handleSave() {
    const html     = buildLetterHTML(getLetterFields())
    const fileName = `PPR-${(claimNum || 'letter').replace(/[^a-zA-Z0-9_-]/g, '_')}.html`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    // Prompt cloud upload
    setPostAction({ type: 'save', fileName })
    setCloudResult(null); setCloudError(''); setSendResult(null)
  }

  // ── Print (open preview window, auto-show print dialog) ───────────────────
  function handlePrint() {
    const html = buildLetterHTML(getLetterFields())
    const win  = window.open('', '_blank', 'width=960,height=1100,resizable=yes,scrollbars=yes')
    if (!win) {
      alert('Please allow pop-ups for this site to use the print preview.')
      return
    }
    win.document.open()
    win.document.write(html)
    win.document.close()
    // Prompt cloud upload after print window opens
    setPostAction({ type: 'print', fileName: `PPR-${(claimNum || 'letter').replace(/[^a-zA-Z0-9_-]/g, '_')}.html` })
    setCloudResult(null); setCloudError(''); setSendResult(null)
  }

  // ── Cloud upload (used by both post-action prompt and Send button) ─────────
  async function uploadToCloud() {
    const html = buildLetterHTML(getLetterFields())
    const res  = await fetch('/api/admin/prompt-pay-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ html, claimRef: claimNum || 'DRAFT', claimDbId: selectedDbId || null }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    return data as { fileName: string; version: number }
  }

  async function handleCloudYes() {
    setCloudSaving(true); setCloudError('')
    try {
      const result = await uploadToCloud()
      setCloudResult(result)
      setPostAction(null)
    } catch (e: any) {
      setCloudError(e.message || 'Upload failed')
    }
    setCloudSaving(false)
  }

  // ── Send (directly to AWS, no download first) ──────────────────────────────
  async function handleSend() {
    setSendLoading(true); setSendError(''); setSendResult(null)
    try {
      const result = await uploadToCloud()
      setSendResult(result)
      setPostAction(null)
    } catch (e: any) {
      setSendError(e.message || 'Upload failed')
    }
    setSendLoading(false)
  }

  // ── Delete / Reset form ────────────────────────────────────────────────────
  function handleDeleteForm() {
    if (!confirm('Reset all fields and clear the form?')) return
    setClaimNum(''); setMemberId('CQP383W14668'); setProviderId('')
    setDos(''); setSubmitDateHdr(''); setBodySubmitDate('')
    setPayerName('[Payer Name]'); setPendStatus('PEND-P'); setBodyDos('')
    setDay30(''); setSigProviderName(''); setFaxNumber('(XXX) XXX-XXXX')
    setSelectedDbId(''); setPostAction(null); setCloudResult(null)
    setSendResult(null); setSendError(''); setCloudError('')
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <>
      <style>{`
        @media print {
          .pp-no-print { display:none!important }
          .pp-overlay-wrap { position:static!important;background:white!important;overflow:visible!important;display:block!important }
          .pp-scroll { overflow:visible!important;padding:0!important;background:white!important }
          .pp-letter { box-shadow:none!important;border-radius:0!important;max-width:100%!important;width:100%!important;margin:0!important;padding:.65in .9in!important }
          input { border:none!important;background:transparent!important;outline:none!important }
          @page { size:letter portrait;margin:0 }
        }
      `}</style>

      <div className="pp-overlay-wrap fixed inset-0 z-50 bg-[#D9E1E8] flex flex-col">

        {/* ── Toolbar ───────────────────────────────────────────────────────── */}
        <div className="pp-no-print shrink-0 bg-[#2F3E4E] px-4 py-2.5 flex flex-wrap items-center gap-3 shadow-lg">

          {/* Title */}
          <div className="min-w-0 mr-1">
            <p className="text-white font-bold text-sm leading-tight tracking-wide">Prompt Pay Violation &amp; Interest Request</p>
            <p className="text-[#7A8F79] text-[10.5px] mt-0.5">NY §3224-a · Fill fields, then Save, Print, or Send</p>
          </div>

          {/* Claim selector */}
          <div className="flex-1 min-w-[180px] max-w-xs">
            <select
              value={selectedDbId}
              onChange={e => selectClaim(e.target.value)}
              disabled={loadingData}
              className="w-full rounded-lg px-3 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] disabled:opacity-50"
            >
              <option value="">{loadingData ? 'Loading claims…' : '— Auto-fill from claim —'}</option>
              {[...claims].sort((a,b) => (a.claimId||'').localeCompare(b.claimId||'')).map(c => (
                <option key={c.id} value={c.id}>{c.claimId || c.id.slice(0,8)} · {c.providerName || '—'}</option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Save → download */}
            <button
              onClick={handleSave}
              title="Download to device as PPR-[ClaimID].html"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#7A8F79] text-white text-xs font-bold hover:bg-white hover:text-[#2F3E4E] transition"
            >
              ⬇ Save
            </button>

            {/* Print → preview window */}
            <button
              onClick={handlePrint}
              title="Open print preview window"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#7A8F79] text-white text-xs font-bold hover:bg-white hover:text-[#2F3E4E] transition"
            >
              🖨 Print
            </button>

            {/* Send → straight to AWS */}
            <button
              onClick={handleSend}
              disabled={sendLoading}
              title="Send directly to Billing Support cloud storage"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#7A8F79] text-white text-xs font-bold hover:bg-white hover:text-[#2F3E4E] transition disabled:opacity-50"
            >
              {sendLoading ? '…' : '☁ Send'}
            </button>

            {/* Divider */}
            <span className="text-[#4a5568] text-lg leading-none select-none">|</span>

            {/* Delete form */}
            <button
              onClick={handleDeleteForm}
              title="Clear all fields and reset the form"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-red-400/40 text-red-300 text-xs font-bold hover:bg-red-500 hover:text-white hover:border-red-500 transition"
            >
              🗑 Delete Form
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-[#4a5568] text-[#D9E1E8] text-xs font-bold hover:bg-[#7A8F79] hover:border-[#7A8F79] transition"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* ── Post-action cloud prompt ────────────────────────────────────── */}
        {postAction && !cloudResult && (
          <div className="pp-no-print shrink-0 bg-[#1a2a35] border-b border-[#2F3E4E] px-5 py-2.5 flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold">
                {postAction.type === 'save' ? `⬇ Downloaded as ${postAction.fileName}` : '🖨 Print preview opened'}
                <span className="text-[#7A8F79] ml-2">·</span>
                <span className="text-[#D9E1E8] ml-2">Also save a copy to Billing Support (cloud)?</span>
              </p>
              {cloudError && <p className="text-red-400 text-[11px] mt-0.5">{cloudError}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCloudYes}
                disabled={cloudSaving}
                className="px-4 py-1 rounded-lg bg-[#7A8F79] text-white text-xs font-bold hover:bg-white hover:text-[#2F3E4E] transition disabled:opacity-50"
              >
                {cloudSaving ? 'Saving…' : '✓ Yes, Save to Cloud'}
              </button>
              <button
                onClick={() => { setPostAction(null); setCloudError('') }}
                className="px-4 py-1 rounded-lg border border-[#4a5568] text-[#7A8F79] text-xs font-semibold hover:border-[#7A8F79] transition"
              >
                No thanks
              </button>
            </div>
          </div>
        )}

        {/* ── Result banners ─────────────────────────────────────────────── */}
        {(cloudResult || sendResult) && (
          <div className="pp-no-print shrink-0 bg-green-900/80 border-b border-green-700 px-5 py-2 flex items-center gap-3">
            <span className="text-green-300 text-xs font-bold">
              ☁ Saved to Billing Support:
            </span>
            <span className="text-white text-xs font-semibold font-mono">
              {(cloudResult || sendResult)!.fileName}
            </span>
            <span className="text-green-400 text-[11px]">
              · Version {(cloudResult || sendResult)!.version}
            </span>
            <button
              onClick={() => { setCloudResult(null); setSendResult(null) }}
              className="ml-auto text-green-400 hover:text-white text-sm leading-none transition"
            >✕</button>
          </div>
        )}
        {sendError && (
          <div className="pp-no-print shrink-0 bg-red-900/70 border-b border-red-700 px-5 py-2 flex items-center gap-3">
            <span className="text-red-300 text-xs font-semibold">☁ Send failed: {sendError}</span>
            <button onClick={() => setSendError('')} className="ml-auto text-red-400 hover:text-white text-sm">✕</button>
          </div>
        )}

        {/* ── Scrollable letter ──────────────────────────────────────────── */}
        <div className="pp-scroll flex-1 overflow-y-auto p-6 md:p-10">
          <div
            className="pp-letter max-w-[760px] mx-auto bg-white shadow-xl rounded-sm px-14 py-12"
            style={{ fontFamily: "'Georgia','Times New Roman',serif", fontSize:'13.5px', lineHeight:'1.75', color:'#1a1a1a' }}
          >
            {/* Date */}
            <p className="text-right text-[11px] text-gray-400 mb-8" style={{ fontFamily:'sans-serif' }}>{today}</p>

            {/* Subject */}
            <p className="font-bold text-gray-900 text-[14px] mb-1" style={{ fontFamily:'sans-serif' }}>
              Re: Prompt Pay Violation and Interest Request — NY §3224-a
            </p>
            <div className="border-b-2 border-[#2F3E4E] mb-6" />

            {/* Header info box */}
            <div className="rounded border border-gray-300 p-4 mb-7 space-y-2" style={{ background:'#f7f8f7', fontFamily:'sans-serif' }}>
              <HeaderField label="Claim Number:"         value={claimNum}      onChange={setClaimNum}      widthCh={24} />
              <HeaderField label="Member ID:"            value={memberId}      onChange={setMemberId}      widthCh={24} />
              <HeaderField label="Provider ID (NPI):"    value={providerId}    onChange={setProviderId}    widthCh={24} />
              <HeaderField label="Date(s) of Service:"   value={dos}           onChange={setDos}           widthCh={28} />
              <HeaderField label="Date Submitted (EDI):" value={submitDateHdr} onChange={setSubmitDateHdr} widthCh={20} />
            </div>

            {/* Body */}
            <div className="space-y-5">
              <p>This correspondence is to formally dispute the delayed adjudication of the above-referenced claim.</p>

              <p>
                The claim was submitted electronically on{' '}
                <InlineField value={bodySubmitDate} onChange={setBodySubmitDate} widthCh={12} placeholder="MM/DD/YYYY" />{' '}
                and meets the definition of a &ldquo;clean claim&rdquo; under NY Insurance Law §3224-a. As of today, the claim
                remains in a pend status&nbsp;(
                <InlineField value={pendStatus} onChange={setPendStatus} widthCh={8} placeholder="PEND-P" />
                )&nbsp;and{' '}
                <InlineField value={payerName} onChange={setPayerName} widthCh={18} placeholder="[Payer Name]" />{' '}
                has not provided documented justification — there is no documented request for additional information,
                no eligibility or coordination of benefits issue, and no valid basis for failing to adjudicate the claim.
              </p>

              <p>
                A prior authorization was obtained for the services rendered, and similar services by the same member
                &nbsp;(DOS{' '}
                <InlineField value={bodyDos} onChange={setBodyDos} widthCh={22} placeholder="DOS range" />
                )&nbsp;have been adjudicated and paid by other providers, further supporting that no systemic eligibility
                or coverage issue exists.
              </p>

              <p>
                Per NY Prompt Pay law, clean claims submitted electronically must be adjudicated within 30 days.
                This timeframe has been exceeded, and no billing event has occurred. Accordingly, this delay constitutes
                a violation of §3224-a.
              </p>

              <div>
                <p className="font-bold mb-2" style={{ fontFamily:'sans-serif', fontSize:'13px', color:'#2F3E4E' }}>We Request:</p>
                <ol style={{ paddingLeft:'1.5rem', margin:0, listStyleType:'decimal' }}>
                  <li style={{ marginBottom:'0.5rem' }}>Immediate adjudication of the claim.</li>
                  <li>
                    Payment of applicable statutory interest (12% annually) calculated from{' '}
                    <InlineField value={day30} onChange={setDay30} widthCh={12} placeholder="MM/DD/YYYY" />{' '}
                    until the date of payment.
                  </li>
                </ol>
              </div>

              <p>
                Please provide written confirmation of claim status and resolution. If additional information is required,
                please respond clearly and promptly.
              </p>
            </div>

            {/* Signature */}
            <div className="mt-10 pt-2">
              <p className="mb-6" style={{ fontFamily:'sans-serif', fontSize:'13px' }}>Sincerely,</p>

              <div className="flex items-center gap-0">
                {/* Left — billing byline */}
                <div className="flex flex-col justify-center pr-6" style={{ borderRight:'1px solid #D9E1E8' }}>
                  <span
                    className="block leading-tight mb-0.5"
                    style={{ fontFamily:'sans-serif', fontSize:'12px', fontWeight:700, color:'#7A8F79', WebkitTextStroke:'1.5px rgba(183,210,181,.5)', letterSpacing:'.01em' }}
                  >
                    Billing on behalf of
                  </span>
                  <span
                    className="block leading-tight"
                    style={{ fontFamily:'sans-serif', fontSize:'12px', fontWeight:700, color:'#7A8F79', WebkitTextStroke:'1.5px rgba(183,210,181,.5)', letterSpacing:'.01em' }}
                  >
                    provider{' '}
                    <span style={{ color:'#2F3E4E', WebkitTextStroke:'0px', fontWeight:700 }}>
                      {sigProviderName || <span style={{ opacity:.35, fontWeight:400 }}>[Provider Name]</span>}
                    </span>.
                  </span>
                </div>

                {/* Right — logo */}
                <div className="flex flex-col items-center pl-6">
                  <img src="/chc_logo.png" alt="Coming Home Care" style={{ height:'44px', width:'auto', objectFit:'contain', marginBottom:'4px' }} />
                  <span style={{ fontFamily:'sans-serif', fontSize:'10px', fontWeight:600, color:'#2F3E4E', lineHeight:1.3, textAlign:'center' }}>
                    Coming Home Care<br />Services, LLC
                  </span>
                </div>
              </div>

              {/* Contact strip */}
              <div className="mt-5 pt-3 flex flex-wrap items-center gap-1.5" style={{ borderTop:'1px solid #D9E1E8' }}>
                {[
                  { icon:'🌐', text:'cominghomecare.com', editable:false },
                  { icon:'📠', text:'', editable:true },
                  { icon:'✉',  text:'support@cominghomecare.com', editable:false },
                ].map((item, i) => (
                  <span key={i}
                    style={{ display:'inline-flex', alignItems:'center', gap:'4px', background:'#F4F6F5', border:'1px solid #D9E1E8', borderRadius:'999px', padding:'2px 10px', fontFamily:'sans-serif', fontSize:'10.5px', color:'#2F3E4E', fontWeight:600 }}
                  >
                    <span>{item.icon}</span>
                    {item.editable ? (
                      <input
                        type="text" value={faxNumber} onChange={e => setFaxNumber(e.target.value)}
                        placeholder="(XXX) XXX-XXXX"
                        className="focus:outline-none"
                        style={{ background:'transparent', border:'none', borderBottom:'1px dashed #7A8F79', fontFamily:'inherit', fontSize:'inherit', color:'inherit', padding:0, width:`${Math.max(14, faxNumber.length+1)}ch` }}
                      />
                    ) : item.text}
                  </span>
                ))}
              </div>
            </div>

          </div>
          <div className="h-12 pp-no-print" />
        </div>
      </div>
    </>
  )
}

// ─── Audience selector ────────────────────────────────────────────────────────
function AudienceSelector({ audiences, nurses, onChange }: {
  audiences: string[]; nurses: Nurse[]; onChange: (a: string[]) => void
}) {
  function toggle(value: string) {
    onChange(audiences.includes(value) ? audiences.filter(a => a !== value) : [...audiences, value])
  }
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-2">
        Audience <span className="normal-case font-normal">(none = draft, not shown)</span>
      </label>
      <div className="space-y-1.5 mb-3">
        {SYSTEM_AUDIENCES.map(a => (
          <label key={a.value} className="flex items-center gap-3 cursor-pointer group">
            <input type="checkbox" checked={audiences.includes(a.value)} onChange={() => toggle(a.value)} className="w-4 h-4 accent-[#7A8F79]" />
            <span>
              <span className="text-sm font-semibold text-[#2F3E4E] group-hover:text-[#7A8F79] transition">{a.label}</span>
              <span className="text-xs text-[#7A8F79] ml-2">{a.desc}</span>
            </span>
          </label>
        ))}
      </div>
      {nurses.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1.5">Individual Providers</p>
          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto bg-[#F4F6F5] rounded-lg p-3">
            {nurses.map(n => {
              const key = `user:${n.id}`
              return (
                <label key={n.id} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={audiences.includes(key)} onChange={() => toggle(key)} className="w-4 h-4 accent-[#7A8F79]" />
                  <span>
                    <span className="text-xs font-semibold text-[#2F3E4E]">{n.displayName}</span>
                    <span className="text-[10px] text-[#7A8F79] block">{n.user.email}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </>
      )}
      {audiences.length === 0 && (
        <p className="mt-2 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          No audience selected — this message will be saved as a draft and not shown to anyone.
        </p>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminMessagesPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<PortalMessage[]>([])
  const [nurses, setNurses]     = useState<Nurse[]>([])
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState('')
  const [title, setTitle]         = useState('')
  const [body, setBody]           = useState('')
  const [category, setCategory]   = useState('General')
  const [audiences, setAudiences] = useState<string[]>([])

  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editSaving, setEditSaving]     = useState(false)
  const [editTitle, setEditTitle]       = useState('')
  const [editBody, setEditBody]         = useState('')
  const [editCategory, setEditCategory] = useState('General')
  const [editAudiences, setEditAudiences] = useState<string[]>([])

  const [showPromptPay, setShowPromptPay] = useState(false)

  useEffect(() => {
    const p1 = fetch('/api/admin/messages', { credentials: 'include' })
      .then(r => { if (r.status === 401) { router.push('/login'); return null } return r.json() })
      .then(data => { if (Array.isArray(data)) setMessages(data) })
    const p2 = fetch('/api/admin/nurses', { credentials: 'include' })
      .then(r => r.json()).then(data => { if (Array.isArray(data)) setNurses(data) })
    Promise.all([p1, p2]).finally(() => setLoading(false))
  }, [router])

  function resetCreate() { setTitle(''); setBody(''); setCategory('General'); setAudiences([]); setSaveMsg('') }

  function openEdit(msg: PortalMessage) {
    setEditingId(msg.id); setEditTitle(msg.title || ''); setEditBody(msg.body)
    setEditCategory(msg.category); setEditAudiences(msg.audiences)
    setShowForm(false); resetCreate()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); if (!body.trim()) return
    setSaving(true); setSaveMsg('')
    const res = await fetch('/api/admin/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ title, body, category, audiences }),
    })
    const data = await res.json(); setSaving(false)
    if (res.ok) { setMessages(prev => [data, ...prev]); resetCreate(); setShowForm(false) }
    else setSaveMsg(data.error || 'Failed to save message.')
  }

  async function handleUpdate(id: string) {
    if (!editBody.trim()) return; setEditSaving(true)
    const res = await fetch(`/api/admin/messages/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ title: editTitle, body: editBody, category: editCategory, audiences: editAudiences }),
    })
    const data = await res.json(); setEditSaving(false)
    if (res.ok) { setMessages(prev => prev.map(m => m.id === id ? { ...m, ...data } : m)); setEditingId(null) }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await fetch(`/api/admin/messages/${id}`, { method: 'DELETE', credentials: 'include' })
    setMessages(prev => prev.filter(m => m.id !== id))
    if (editingId === id) setEditingId(null)
    setDeleting(null)
  }

  function audienceLabel(a: string) {
    if (a.startsWith('user:')) {
      const nurse = nurses.find(n => n.id === a.replace('user:', ''))
      return nurse ? nurse.displayName : a
    }
    return a
  }

  return (
    <>
      {showPromptPay && <PromptPayOverlay onClose={() => setShowPromptPay(false)} />}

      <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
        <div className="max-w-3xl mx-auto">
          <AdminNav />

          <div className="flex items-center gap-4 mb-8">
            <Link href="/admin" className="text-[#7A8F79] hover:text-[#2F3E4E] text-sm">← Admin</Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[#2F3E4E]"><span className="text-[#7A8F79] italic">ad</span>Messages</h1>
              <p className="text-sm text-[#7A8F79] mt-1">Post updates for nurses and providers — shown across their portal pages.</p>
            </div>
            {/* Hidden § trigger */}
            <button
              onClick={() => setShowPromptPay(true)}
              title="Prompt Pay Violation Letter (NY §3224-a)"
              className="text-[#D9E1E8] hover:text-[#7A8F79] transition text-lg font-serif leading-none select-none"
            >§</button>
            <button
              onClick={() => { setShowForm(!showForm); setSaveMsg(''); setEditingId(null) }}
              className="shrink-0 bg-[#2F3E4E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition"
            >{showForm ? 'Cancel' : '+ New Message'}</button>
          </div>

          {showForm && (
            <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm p-6 mb-6 space-y-5">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8]">New Portal Message</h2>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Title <span className="normal-case font-normal">(optional)</span></label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Important Claims Update"
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Message <span className="text-red-500">*</span></label>
                <textarea value={body} onChange={e => setBody(e.target.value)} required rows={4} placeholder="Type your update here…"
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(c => (
                    <button key={c} type="button" onClick={() => setCategory(c)}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${category === c ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'}`}>{c}</button>
                  ))}
                </div>
              </div>
              <AudienceSelector audiences={audiences} nurses={nurses} onChange={setAudiences} />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); resetCreate() }}
                  className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:bg-[#F4F6F5] transition">Cancel</button>
                <button type="submit" disabled={saving || !body.trim()}
                  className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                  {saving ? 'Posting…' : audiences.length === 0 ? 'Save as Draft' : 'Post Message'}</button>
              </div>
              {saveMsg && <p className="text-xs text-red-500 text-center">{saveMsg}</p>}
            </form>
          )}

          {loading ? (
            <p className="text-sm text-[#7A8F79]">Loading…</p>
          ) : messages.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-10 text-center">
              <p className="text-[#2F3E4E] font-semibold">No messages yet</p>
              <p className="text-sm text-[#7A8F79] mt-1">Post your first update above — it will appear on your providers&apos; portal pages.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map(msg => {
                const catStyle = CATEGORY_STYLE[msg.category] || CATEGORY_STYLE.General
                const isDraft  = msg.audiences.length === 0
                const isEditing = editingId === msg.id

                return (
                  <div key={msg.id} className={`bg-white rounded-xl shadow-sm p-5 ${isEditing ? 'ring-2 ring-[#7A8F79]' : ''}`}>
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-[#D9E1E8]">
                          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79]">Editing Message</p>
                          <button onClick={() => setEditingId(null)} className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] font-semibold">Cancel</button>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Title <span className="normal-case font-normal">(optional)</span></label>
                          <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="e.g. Important Claims Update"
                            className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Message <span className="text-red-500">*</span></label>
                          <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={4}
                            className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-2">Category</label>
                          <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map(c => (
                              <button key={c} type="button" onClick={() => setEditCategory(c)}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${editCategory === c ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'}`}>{c}</button>
                            ))}
                          </div>
                        </div>
                        <AudienceSelector audiences={editAudiences} nurses={nurses} onChange={setEditAudiences} />
                        <div className="flex gap-3 pt-1">
                          <button onClick={() => setEditingId(null)}
                            className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:bg-[#F4F6F5] transition">Cancel</button>
                          <button onClick={() => handleUpdate(msg.id)} disabled={editSaving || !editBody.trim()}
                            className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                            {editSaving ? 'Saving…' : editAudiences.length === 0 ? 'Save as Draft' : 'Save Changes'}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${catStyle}`}>{msg.category}</span>
                            {isDraft ? (
                              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">Draft — not visible</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {msg.audiences.map(a => (
                                  <span key={a} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#D9E1E8] text-[#2F3E4E]">{audienceLabel(a)}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          {msg.title && <p className="text-sm font-semibold text-[#2F3E4E]">{msg.title}</p>}
                          <p className="text-sm text-[#2F3E4E] leading-relaxed mt-0.5 whitespace-pre-wrap">{msg.body}</p>
                          <p className="text-[10px] text-[#7A8F79] mt-2">
                            {new Date(msg.createdAt).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <button onClick={() => openEdit(msg)} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">Edit</button>
                          <button onClick={() => handleDelete(msg.id)} disabled={deleting === msg.id}
                            className="text-[#D9E1E8] hover:text-red-400 transition text-lg leading-none disabled:opacity-40" title="Delete message">✕</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
