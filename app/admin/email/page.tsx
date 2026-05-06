'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AdminNav from '../../components/AdminNav'

// ─── Types ────────────────────────────────────────────────────────────────────
type Nurse = {
  id: string
  displayName: string
  receiveNotifications: boolean
  user: { email: string }
}

type PortalMessage = {
  id: string
  title?: string | null
  body: string
  category: string
  audiences: string[]
  createdAt: string
}

type ClaimForLetter = {
  id: string; claimId: string | null; providerName: string | null
  dosStart: string | null; dosStop: string | null; submitDate: string | null
  primaryPayer: string | null; nurseId: string; nurse: { displayName: string }
}

type NurseProfile = {
  id: string; displayName: string; firstName: string | null
  lastName: string | null; npiNumber: string | null; phone: string | null
}

type PPSettings = {
  'promptPay.reminderEnabled': string
  'promptPay.triggerDays': string
  'promptPay.fromEmail': string
  'promptPay.toEmail': string
  'promptPay.formUrl': string
  'promptPay.formS3Key': string
  'promptPay.formFileName': string
  'promptPay.formLinkName': string
  'promptPay.subjectTemplate': string
  'promptPay.customNote': string
}

type LatestLog = {
  id: string
  sentAt: string
  recipientName: string | null
  subject: string
  category: string
  status: string
} | null

// ─── Constants ────────────────────────────────────────────────────────────────
const PP_DEFAULTS: PPSettings = {
  'promptPay.reminderEnabled': 'true',
  'promptPay.triggerDays': '28',
  'promptPay.fromEmail': 'alerts@cominghomecare.com',
  'promptPay.toEmail': 'support@cominghomecare.com',
  'promptPay.formUrl': '',
  'promptPay.formS3Key': '',
  'promptPay.formFileName': '',
  'promptPay.formLinkName': 'Prompt Pay Interest Form',
  'promptPay.subjectTemplate': 'Prompt Pay Alert: Claim {claimId} — {provider} — Day 30 on {day30}',
  'promptPay.customNote': '',
}

const MSG_CATEGORIES = ['General', 'Claims', 'Invoices', 'Events']
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

// ─── Utilities ────────────────────────────────────────────────────────────────
function fmtDateShort(val: string | null) {
  if (!val) return ''
  return new Date(val).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' })
}
function fmtDOS(start: string | null, stop: string | null) {
  const s = fmtDateShort(start); const e = fmtDateShort(stop)
  return !s ? '' : (e && e !== s ? `${s} – ${e}` : s)
}
function addDays(dateStr: string, days: number) {
  if (!dateStr) return ''
  const d = new Date(dateStr); d.setUTCDate(d.getUTCDate() + days)
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' })
}
function escHtml(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─── Letter HTML builder ──────────────────────────────────────────────────────
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
      <div class="sig-left">Billing on behalf of<br>provider <span class="sig-name">${escHtml(f.sigProviderName) || '[Provider Name]'}</span>.</div>
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

  const [postAction, setPostAction] = useState<{ type: 'save' | 'print'; fileName: string } | null>(null)
  const [cloudSaving, setCloudSaving]   = useState(false)
  const [cloudResult, setCloudResult]   = useState<{ fileName: string; version: number } | null>(null)
  const [cloudError, setCloudError]     = useState('')
  const [sendLoading, setSendLoading]   = useState(false)
  const [sendResult, setSendResult]     = useState<{ fileName: string; version: number } | null>(null)
  const [sendError, setSendError]       = useState('')

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
    setClaimNum(claim.claimId || ''); setProviderId(nurse?.npiNumber || '')
    setDos(dosRange); setSubmitDateHdr(submitFmt); setBodySubmitDate(submitFmt)
    setPayerName(claim.primaryPayer || '[Payer Name]'); setBodyDos(dosRange); setDay30(d30)
    setSigProviderName(claim.providerName || nurse?.displayName || '')
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

  function handleSave() {
    const html = buildLetterHTML(getLetterFields())
    const fileName = `PPR-${(claimNum || 'letter').replace(/[^a-zA-Z0-9_-]/g, '_')}.html`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = fileName
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setPostAction({ type: 'save', fileName }); setCloudResult(null); setCloudError(''); setSendResult(null)
  }

  function handlePrint() {
    const html = buildLetterHTML(getLetterFields())
    const win = window.open('', '_blank', 'width=960,height=1100,resizable=yes,scrollbars=yes')
    if (!win) { alert('Please allow pop-ups for this site to use the print preview.'); return }
    win.document.open(); win.document.write(html); win.document.close()
    setPostAction({ type: 'print', fileName: `PPR-${(claimNum || 'letter').replace(/[^a-zA-Z0-9_-]/g, '_')}.html` })
    setCloudResult(null); setCloudError(''); setSendResult(null)
  }

  async function uploadToCloud() {
    const html = buildLetterHTML(getLetterFields())
    const res = await fetch('/api/admin/prompt-pay-letter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ html, claimRef: claimNum || 'DRAFT', claimDbId: selectedDbId || null }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    return data as { fileName: string; version: number }
  }

  async function handleCloudYes() {
    setCloudSaving(true); setCloudError('')
    try { const result = await uploadToCloud(); setCloudResult(result); setPostAction(null) }
    catch (e: unknown) { setCloudError(e instanceof Error ? e.message : 'Upload failed') }
    setCloudSaving(false)
  }

  async function handleSend() {
    setSendLoading(true); setSendError(''); setSendResult(null)
    try { const result = await uploadToCloud(); setSendResult(result); setPostAction(null) }
    catch (e: unknown) { setSendError(e instanceof Error ? e.message : 'Upload failed') }
    setSendLoading(false)
  }

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
        <div className="pp-no-print shrink-0 bg-[#2F3E4E] px-4 py-2.5 flex flex-wrap items-center gap-3 shadow-lg">
          <div className="min-w-0 mr-1">
            <p className="text-white font-bold text-sm leading-tight tracking-wide">Prompt Pay Violation &amp; Interest Request</p>
            <p className="text-[#7A8F79] text-[10.5px] mt-0.5">NY §3224-a · Fill fields, then Save, Print, or Send</p>
          </div>
          <div className="flex-1 min-w-[180px] max-w-xs">
            <select value={selectedDbId} onChange={e => selectClaim(e.target.value)} disabled={loadingData}
              className="w-full rounded-lg px-3 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] disabled:opacity-50">
              <option value="">{loadingData ? 'Loading claims…' : '— Auto-fill from claim —'}</option>
              {[...claims].sort((a,b) => (a.claimId||'').localeCompare(b.claimId||'')).map(c => (
                <option key={c.id} value={c.id}>{c.claimId || c.id.slice(0,8)} · {c.providerName || '—'}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <button onClick={handleSave} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#7A8F79] text-white text-xs font-bold hover:bg-white hover:text-[#2F3E4E] transition">⬇ Save</button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#7A8F79] text-white text-xs font-bold hover:bg-white hover:text-[#2F3E4E] transition">🖨 Print</button>
            <button onClick={handleSend} disabled={sendLoading} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#7A8F79] text-white text-xs font-bold hover:bg-white hover:text-[#2F3E4E] transition disabled:opacity-50">{sendLoading ? '…' : '☁ Send'}</button>
            <span className="text-[#4a5568] text-lg leading-none select-none">|</span>
            <button onClick={handleDeleteForm} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-red-400/40 text-red-300 text-xs font-bold hover:bg-red-500 hover:text-white hover:border-red-500 transition">🗑 Delete Form</button>
            <button onClick={onClose} className="px-3.5 py-1.5 rounded-lg border border-[#4a5568] text-[#D9E1E8] text-xs font-bold hover:bg-[#7A8F79] hover:border-[#7A8F79] transition">✕ Close</button>
          </div>
        </div>
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
              <button onClick={handleCloudYes} disabled={cloudSaving} className="px-4 py-1 rounded-lg bg-[#7A8F79] text-white text-xs font-bold hover:bg-white hover:text-[#2F3E4E] transition disabled:opacity-50">{cloudSaving ? 'Saving…' : '✓ Yes, Save to Cloud'}</button>
              <button onClick={() => { setPostAction(null); setCloudError('') }} className="px-4 py-1 rounded-lg border border-[#4a5568] text-[#7A8F79] text-xs font-semibold hover:border-[#7A8F79] transition">No thanks</button>
            </div>
          </div>
        )}
        {(cloudResult || sendResult) && (
          <div className="pp-no-print shrink-0 bg-green-900/80 border-b border-green-700 px-5 py-2 flex items-center gap-3">
            <span className="text-green-300 text-xs font-bold">☁ Saved to Billing Support:</span>
            <span className="text-white text-xs font-semibold font-mono">{(cloudResult || sendResult)!.fileName}</span>
            <span className="text-green-400 text-[11px]">· Version {(cloudResult || sendResult)!.version}</span>
            <button onClick={() => { setCloudResult(null); setSendResult(null) }} className="ml-auto text-green-400 hover:text-white text-sm leading-none transition">✕</button>
          </div>
        )}
        {sendError && (
          <div className="pp-no-print shrink-0 bg-red-900/70 border-b border-red-700 px-5 py-2 flex items-center gap-3">
            <span className="text-red-300 text-xs font-semibold">☁ Send failed: {sendError}</span>
            <button onClick={() => setSendError('')} className="ml-auto text-red-400 hover:text-white text-sm">✕</button>
          </div>
        )}
        <div className="pp-scroll flex-1 overflow-y-auto p-6 md:p-10">
          <div className="pp-letter max-w-[760px] mx-auto bg-white shadow-xl rounded-sm px-14 py-12"
            style={{ fontFamily: "'Georgia','Times New Roman',serif", fontSize:'13.5px', lineHeight:'1.75', color:'#1a1a1a' }}>
            <p className="text-right text-[11px] text-gray-400 mb-8" style={{ fontFamily:'sans-serif' }}>{today}</p>
            <p className="font-bold text-gray-900 text-[14px] mb-1" style={{ fontFamily:'sans-serif' }}>Re: Prompt Pay Violation and Interest Request — NY §3224-a</p>
            <div className="border-b-2 border-[#2F3E4E] mb-6" />
            <div className="rounded border border-gray-300 p-4 mb-7 space-y-2" style={{ background:'#f7f8f7', fontFamily:'sans-serif' }}>
              <HeaderField label="Claim Number:"         value={claimNum}      onChange={setClaimNum}      widthCh={24} />
              <HeaderField label="Member ID:"            value={memberId}      onChange={setMemberId}      widthCh={24} />
              <HeaderField label="Provider ID (NPI):"    value={providerId}    onChange={setProviderId}    widthCh={24} />
              <HeaderField label="Date(s) of Service:"   value={dos}           onChange={setDos}           widthCh={28} />
              <HeaderField label="Date Submitted (EDI):" value={submitDateHdr} onChange={setSubmitDateHdr} widthCh={20} />
            </div>
            <div className="space-y-5">
              <p>This correspondence is to formally dispute the delayed adjudication of the above-referenced claim.</p>
              <p>The claim was submitted electronically on{' '}
                <InlineField value={bodySubmitDate} onChange={setBodySubmitDate} widthCh={12} placeholder="MM/DD/YYYY" />{' '}
                and meets the definition of a &ldquo;clean claim&rdquo; under NY Insurance Law §3224-a. As of today, the claim remains in a pend status&nbsp;(
                <InlineField value={pendStatus} onChange={setPendStatus} widthCh={8} placeholder="PEND-P" />
                )&nbsp;and{' '}
                <InlineField value={payerName} onChange={setPayerName} widthCh={18} placeholder="[Payer Name]" />{' '}
                has not provided documented justification — there is no documented request for additional information, no eligibility or coordination of benefits issue, and no valid basis for failing to adjudicate the claim.
              </p>
              <p>A prior authorization was obtained for the services rendered, and similar services by the same member
                &nbsp;(DOS{' '}
                <InlineField value={bodyDos} onChange={setBodyDos} widthCh={22} placeholder="DOS range" />
                )&nbsp;have been adjudicated and paid by other providers, further supporting that no systemic eligibility or coverage issue exists.
              </p>
              <p>Per NY Prompt Pay law, clean claims submitted electronically must be adjudicated within 30 days. This timeframe has been exceeded, and no billing event has occurred. Accordingly, this delay constitutes a violation of §3224-a.</p>
              <div>
                <p className="font-bold mb-2" style={{ fontFamily:'sans-serif', fontSize:'13px', color:'#2F3E4E' }}>We Request:</p>
                <ol style={{ paddingLeft:'1.5rem', margin:0, listStyleType:'decimal' }}>
                  <li style={{ marginBottom:'0.5rem' }}>Immediate adjudication of the claim.</li>
                  <li>Payment of applicable statutory interest (12% annually) calculated from{' '}
                    <InlineField value={day30} onChange={setDay30} widthCh={12} placeholder="MM/DD/YYYY" />{' '}
                    until the date of payment.
                  </li>
                </ol>
              </div>
              <p>Please provide written confirmation of claim status and resolution. If additional information is required, please respond clearly and promptly.</p>
            </div>
            <div className="mt-10 pt-2">
              <p className="mb-6" style={{ fontFamily:'sans-serif', fontSize:'13px' }}>Sincerely,</p>
              <div className="flex items-center gap-0">
                <div className="flex flex-col justify-center pr-6" style={{ borderRight:'1px solid #D9E1E8' }}>
                  <span className="block leading-tight mb-0.5" style={{ fontFamily:'sans-serif', fontSize:'12px', fontWeight:700, color:'#7A8F79', WebkitTextStroke:'1.5px rgba(183,210,181,.5)', letterSpacing:'.01em' }}>Billing on behalf of</span>
                  <span className="block leading-tight" style={{ fontFamily:'sans-serif', fontSize:'12px', fontWeight:700, color:'#7A8F79', WebkitTextStroke:'1.5px rgba(183,210,181,.5)', letterSpacing:'.01em' }}>
                    provider{' '}
                    <span style={{ color:'#2F3E4E', WebkitTextStroke:'0px', fontWeight:700 }}>
                      {sigProviderName || <span style={{ opacity:.35, fontWeight:400 }}>[Provider Name]</span>}
                    </span>.
                  </span>
                </div>
                <div className="flex flex-col items-center pl-6">
                  <img src="/chc_logo.png" alt="Coming Home Care" style={{ height:'44px', width:'auto', objectFit:'contain', marginBottom:'4px' }} />
                  <span style={{ fontFamily:'sans-serif', fontSize:'10px', fontWeight:600, color:'#2F3E4E', lineHeight:1.3, textAlign:'center' }}>Coming Home Care<br />Services, LLC</span>
                </div>
              </div>
              <div className="mt-5 pt-3 flex flex-wrap items-center gap-1.5" style={{ borderTop:'1px solid #D9E1E8' }}>
                {[
                  { icon:'🌐', text:'cominghomecare.com', editable:false },
                  { icon:'📠', text:'', editable:true },
                  { icon:'✉',  text:'support@cominghomecare.com', editable:false },
                ].map((item, i) => (
                  <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:'4px', background:'#F4F6F5', border:'1px solid #D9E1E8', borderRadius:'999px', padding:'2px 10px', fontFamily:'sans-serif', fontSize:'10.5px', color:'#2F3E4E', fontWeight:600 }}>
                    <span>{item.icon}</span>
                    {item.editable ? (
                      <input type="text" value={faxNumber} onChange={e => setFaxNumber(e.target.value)} placeholder="(XXX) XXX-XXXX"
                        className="focus:outline-none"
                        style={{ background:'transparent', border:'none', borderBottom:'1px dashed #7A8F79', fontFamily:'inherit', fontSize:'inherit', color:'inherit', padding:0, width:`${Math.max(14, faxNumber.length+1)}ch` }} />
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
export default function AdminMessagingPage() {
  const router = useRouter()

  // ── Broadcast email state ────────────────────────────────────────────────
  const [nurses, setNurses] = useState<Nurse[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [selectAll, setSelectAll] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [error, setError] = useState('')

  // ── Template preview state ───────────────────────────────────────────────
  const [previewTemplate, setPreviewTemplate] = useState('')
  const [previewSending, setPreviewSending] = useState(false)
  const [previewMsg, setPreviewMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // ── Sent log state ───────────────────────────────────────────────────────
  const [latestLog, setLatestLog] = useState<LatestLog>(undefined as unknown as LatestLog)
  const [logLoaded, setLogLoaded] = useState(false)

  // ── Prompt Pay settings state ────────────────────────────────────────────
  const [pp, setPp] = useState<PPSettings>(PP_DEFAULTS)
  const [ppSaving, setPpSaving] = useState(false)
  const [ppSaved, setPpSaved] = useState(false)
  const [ppError, setPpError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Portal messages state ────────────────────────────────────────────────
  const [messages, setMessages] = useState<PortalMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(true)
  const [deletingMsg, setDeletingMsg] = useState<string | null>(null)
  const [showMsgForm, setShowMsgForm] = useState(false)
  const [msgSaving, setMsgSaving] = useState(false)
  const [msgSaveMsg, setMsgSaveMsg] = useState('')
  const [msgTitle, setMsgTitle] = useState('')
  const [msgBody, setMsgBody] = useState('')
  const [msgCategory, setMsgCategory] = useState('General')
  const [msgAudiences, setMsgAudiences] = useState<string[]>([])
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editMsgSaving, setEditMsgSaving] = useState(false)
  const [editMsgTitle, setEditMsgTitle] = useState('')
  const [editMsgBody, setEditMsgBody] = useState('')
  const [editMsgCategory, setEditMsgCategory] = useState('General')
  const [editMsgAudiences, setEditMsgAudiences] = useState<string[]>([])
  const [showPromptPay, setShowPromptPay] = useState(false)

  useEffect(() => {
    fetch('/api/admin/nurses', { credentials: 'include' })
      .then(r => { if (r.status === 401) { router.push('/login'); return } return r.json() })
      .then(data => { if (Array.isArray(data)) setNurses(data) })

    fetch('/api/admin/prompt-pay-settings', { credentials: 'include' })
      .then(r => r.ok ? r.json() : {})
      .then((data: Partial<PPSettings>) => { setPp(prev => ({ ...prev, ...data })) })

    fetch('/api/admin/email/log/latest', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setLatestLog(data); setLogLoaded(true) })
      .catch(() => setLogLoaded(true))

    fetch('/api/admin/messages', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMessages(data) })
      .finally(() => setMsgLoading(false))
  }, [router])

  // ── Broadcast email helpers ──────────────────────────────────────────────
  function toggleNurse(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    setSelectAll(false)
  }
  function toggleAll() {
    if (selectAll) { setSelectAll(false); setSelected(new Set()) }
    else { setSelectAll(true); setSelected(new Set()) }
  }
  const recipientCount = selectAll ? nurses.length : selected.size

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setResult(null)
    if (!subject.trim() || !body.trim()) { setError('Subject and body are required.'); return }
    if (recipientCount === 0) { setError('Select at least one recipient.'); return }
    setSending(true)
    const res = await fetch('/api/admin/email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ subject, body, recipientIds: selectAll ? ['all'] : Array.from(selected) }),
    })
    setSending(false)
    if (res.ok) {
      const data = await res.json()
      setResult(data); setSubject(''); setBody(''); setSelected(new Set()); setSelectAll(false)
      fetch('/api/admin/email/log/latest', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null).then(setLatestLog).catch(() => {})
    } else {
      const data = await res.json(); setError(data.error || 'Failed to send.')
    }
  }

  // ── Template preview helpers ─────────────────────────────────────────────
  async function sendPreview() {
    if (!previewTemplate) return
    setPreviewSending(true); setPreviewMsg(null)
    const res = await fetch('/api/admin/email/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ template: previewTemplate }),
    })
    setPreviewSending(false)
    if (res.ok) {
      const data = await res.json()
      setPreviewMsg({ ok: true, text: `Preview sent to ${data.to}` })
    } else {
      const data = await res.json()
      setPreviewMsg({ ok: false, text: data.error || 'Send failed.' })
    }
  }

  // ── Prompt Pay helpers ───────────────────────────────────────────────────
  function ppSet(key: keyof PPSettings, value: string) {
    setPp(prev => ({ ...prev, [key]: value })); setPpSaved(false)
  }

  async function savePpSettings(e: React.FormEvent) {
    e.preventDefault(); setPpSaving(true); setPpError(''); setPpSaved(false)
    const res = await fetch('/api/admin/prompt-pay-settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ settings: pp }),
    })
    setPpSaving(false)
    if (res.ok) setPpSaved(true)
    else setPpError('Failed to save settings.')
  }

  async function uploadForm(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setUploadMsg('')
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/admin/prompt-pay-settings/upload', { method: 'POST', credentials: 'include', body: fd })
    setUploading(false)
    if (res.ok) {
      const data = await res.json()
      setPp(prev => ({ ...prev, 'promptPay.formS3Key': 'set', 'promptPay.formFileName': data.fileName, 'promptPay.formUrl': '' }))
      setUploadMsg(`Uploaded: ${data.fileName}`)
    } else {
      const data = await res.json(); setUploadMsg(data.error || 'Upload failed.')
    }
    e.target.value = ''
  }

  async function deleteForm() {
    if (!confirm('Remove the uploaded form? This cannot be undone.')) return
    const res = await fetch('/api/admin/prompt-pay-settings/upload', { method: 'DELETE', credentials: 'include' })
    if (res.ok) {
      setPp(prev => ({ ...prev, 'promptPay.formS3Key': '', 'promptPay.formFileName': '' }))
      setUploadMsg('Form removed.')
    }
  }

  async function previewForm() {
    const res = await fetch('/api/admin/prompt-pay-settings/upload', { credentials: 'include' })
    const data = await res.json(); if (data.url) window.open(data.url, '_blank')
  }

  async function sendTestEmail() {
    setTestSending(true); setTestMsg('')
    const res = await fetch('/api/cron/claim-reminders-test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ settings: pp }),
    })
    setTestSending(false)
    if (res.ok) setTestMsg('Test email sent — check your inbox.')
    else setTestMsg('Test send failed.')
  }

  // ── Portal message helpers ───────────────────────────────────────────────
  function resetMsgCreate() { setMsgTitle(''); setMsgBody(''); setMsgCategory('General'); setMsgAudiences([]); setMsgSaveMsg('') }

  function openEditMsg(msg: PortalMessage) {
    setEditingMsgId(msg.id); setEditMsgTitle(msg.title || ''); setEditMsgBody(msg.body)
    setEditMsgCategory(msg.category); setEditMsgAudiences(msg.audiences)
    setShowMsgForm(false); resetMsgCreate()
  }

  async function handleCreateMsg(e: React.FormEvent) {
    e.preventDefault(); if (!msgBody.trim()) return
    setMsgSaving(true); setMsgSaveMsg('')
    const res = await fetch('/api/admin/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ title: msgTitle, body: msgBody, category: msgCategory, audiences: msgAudiences }),
    })
    const data = await res.json(); setMsgSaving(false)
    if (res.ok) { setMessages(prev => [data, ...prev]); resetMsgCreate(); setShowMsgForm(false) }
    else setMsgSaveMsg(data.error || 'Failed to save message.')
  }

  async function handleUpdateMsg(id: string) {
    if (!editMsgBody.trim()) return; setEditMsgSaving(true)
    const res = await fetch(`/api/admin/messages/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ title: editMsgTitle, body: editMsgBody, category: editMsgCategory, audiences: editMsgAudiences }),
    })
    const data = await res.json(); setEditMsgSaving(false)
    if (res.ok) { setMessages(prev => prev.map(m => m.id === id ? { ...m, ...data } : m)); setEditingMsgId(null) }
  }

  async function handleDeleteMsg(id: string) {
    setDeletingMsg(id)
    await fetch(`/api/admin/messages/${id}`, { method: 'DELETE', credentials: 'include' })
    setMessages(prev => prev.filter(m => m.id !== id))
    if (editingMsgId === id) setEditingMsgId(null)
    setDeletingMsg(null)
  }

  function audienceLabel(a: string) {
    if (a.startsWith('user:')) {
      const nurse = nurses.find(n => n.id === a.replace('user:', ''))
      return nurse ? nurse.displayName : a
    }
    return a
  }

  const hasUploadedForm = !!pp['promptPay.formS3Key']
  const hasExternalUrl  = !!pp['promptPay.formUrl'].trim()

  function fmtLog(iso: string) {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
  }

  return (
    <>
      {showPromptPay && <PromptPayOverlay onClose={() => setShowPromptPay(false)} />}

      <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
        <div className="max-w-6xl mx-auto">

          <div className="mb-6">
            <AdminNav />
            <h1 className="text-3xl font-bold text-[#2F3E4E]">
              <span className="text-[#7A8F79] italic">ad</span>Messaging
            </h1>
          </div>

          {/* ── Two-column layout ──────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row gap-6 items-start">

            {/* ── Left Sidebar ──────────────────────────────────────────────── */}
            <div className="w-full md:w-[260px] shrink-0 space-y-4">

              {/* adTemplates */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="bg-[#2F3E4E] px-4 py-3">
                  <h2 className="text-sm font-bold text-white"><span className="text-[#7A8F79] italic">ad</span>Templates</h2>
                  <p className="text-[11px] text-[#D9E1E8] mt-0.5">Send a mock preview to your inbox.</p>
                </div>
                <div className="p-4 space-y-3">
                  <select value={previewTemplate} onChange={e => { setPreviewTemplate(e.target.value); setPreviewMsg(null) }}
                    className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-xs text-[#2F3E4E] bg-white focus:outline-none focus:ring-2 focus:ring-[#7A8F79]">
                    <option value="">— Choose a template —</option>
                    <optgroup label="Account / Auth">
                      <option value="welcome_admin">Welcome — Admin-Created</option>
                      <option value="welcome_self">Welcome — Self-Registration</option>
                      <option value="password_reset_admin">Password Reset by Admin</option>
                    </optgroup>
                    <optgroup label="Billing / Invoices">
                      <option value="invoice">Invoice Sent to Provider</option>
                      <option value="receipt">Payment Receipt</option>
                      <option value="enrollment_alert_in">Billing Enrollment — Opted In</option>
                      <option value="enrollment_alert_out">Billing Enrollment — Opted Out</option>
                      <option value="billing_inquiry">Billing Inquiry (Public Form)</option>
                    </optgroup>
                    <optgroup label="Reminders / Alerts">
                      <option value="weekly_reminder">Weekly Hours Reminder</option>
                      <option value="doc_expiring">Doc Expiration (25 days)</option>
                      <option value="doc_expiring_urgent">Doc Expiration — Urgent (4 days)</option>
                      <option value="prompt_pay">Prompt Pay Interest Alert</option>
                    </optgroup>
                    <optgroup label="Claims / Documents">
                      <option value="new_claim">New Claim Added</option>
                      <option value="new_document">New Document Added</option>
                      <option value="nurse_shared_doc">Provider Shared Document</option>
                      <option value="bulk_import">Bulk Import Summary</option>
                      <option value="edi_summary">EDI Upload Summary</option>
                    </optgroup>
                    <optgroup label="Portal Documents">
                      <option value="user_agreement">User Agreement (signed copy)</option>
                    </optgroup>
                  </select>
                  {previewTemplate === 'user_agreement'
                    ? <p className="text-[11px] text-[#7A8F79]">Opens a sample signed agreement in a new tab — no email sent.</p>
                    : previewTemplate
                      ? <p className="text-[11px] text-[#7A8F79]">Preview sends to your admin email with sample data.</p>
                      : null}
                  <button type="button" onClick={previewTemplate === 'user_agreement' ? () => window.open('/api/admin/email/preview?template=user_agreement', '_blank') : sendPreview} disabled={!previewTemplate || previewSending}
                    className="w-full px-3 py-2 rounded-lg bg-[#2F3E4E] text-white text-xs font-semibold hover:bg-[#7A8F79] transition disabled:opacity-40">
                    {previewSending ? 'Sending…' : 'Send Preview Email'}
                  </button>
                  {previewMsg && (
                    <p className={`text-[11px] font-semibold ${previewMsg.ok ? 'text-green-600' : 'text-red-500'}`}>
                      {previewMsg.ok ? '✓ ' : '✗ '}{previewMsg.text}
                    </p>
                  )}
                </div>
              </div>

              {/* Sent Communications */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="bg-[#2F3E4E] px-4 py-3">
                  <h2 className="text-sm font-bold text-white">Sent Communications</h2>
                  <p className="text-[11px] text-[#D9E1E8] mt-0.5">Email activity log</p>
                </div>
                <div className="p-4 space-y-3">
                  {!logLoaded ? (
                    <p className="text-xs text-[#7A8F79]">Loading…</p>
                  ) : latestLog ? (
                    <div className="space-y-1">
                      <p className="text-[11px] text-[#7A8F79] uppercase tracking-widest font-semibold">Most Recent</p>
                      <p className="text-xs font-semibold text-[#2F3E4E]">{fmtLog(latestLog.sentAt)}</p>
                      <p className="text-xs text-[#7A8F79] truncate">{latestLog.subject}</p>
                      <p className="text-[11px] text-[#7A8F79] truncate">{latestLog.recipientName || latestLog.category}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border capitalize ${latestLog.status === 'sent' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                          {latestLog.status}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#7A8F79]">No emails logged yet.</p>
                  )}
                  <button type="button" onClick={() => router.push('/admin/email/log')}
                    className="w-full px-3 py-2 rounded-lg border border-[#D9E1E8] text-xs font-semibold text-[#7A8F79] hover:border-[#7A8F79] hover:text-[#2F3E4E] transition">
                    View Full Log →
                  </button>
                </div>
              </div>

            </div>

            {/* ── Main Content ───────────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-6">

              {/* ── Broadcast Email Form ──────────────────────────────────── */}
              <form onSubmit={sendEmail}>
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-[#2F3E4E] px-6 py-4">
                    <h2 className="text-base font-bold text-white"><span className="text-[#7A8F79] italic">ad</span>Email</h2>
                    <p className="text-xs text-[#D9E1E8] mt-0.5">Compose and send a message to one or more providers.</p>
                  </div>
                  <div className="grid md:grid-cols-[240px_1fr] divide-y md:divide-y-0 md:divide-x divide-[#D9E1E8]">
                    <div className="p-5 flex flex-col gap-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79]">Recipients</p>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={selectAll} onChange={toggleAll} className="w-4 h-4 rounded accent-[#2F3E4E]" />
                        <span className="text-sm font-semibold text-[#2F3E4E]">All Providers ({nurses.length})</span>
                      </label>
                      <div className="divide-y divide-[#D9E1E8] border border-[#D9E1E8] rounded-lg overflow-hidden overflow-y-auto" style={{ maxHeight: '320px' }}>
                        {nurses.map(nurse => (
                          <label key={nurse.id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition ${(selectAll || selected.has(nurse.id)) ? 'bg-[#f4f6f5]' : 'hover:bg-[#fafbfa]'}`}>
                            <input type="checkbox" checked={selectAll || selected.has(nurse.id)} onChange={() => !selectAll && toggleNurse(nurse.id)} disabled={selectAll} className="w-4 h-4 rounded accent-[#2F3E4E]" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#2F3E4E] leading-tight">{nurse.displayName}</p>
                              <p className="text-xs text-[#7A8F79] truncate">{nurse.user.email}</p>
                            </div>
                            {!nurse.receiveNotifications && (
                              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">off</span>
                            )}
                          </label>
                        ))}
                      </div>
                      {recipientCount > 0 && <p className="text-xs text-[#7A8F79]">{recipientCount} recipient{recipientCount !== 1 ? 's' : ''} selected</p>}
                    </div>
                    <div className="p-5 flex flex-col gap-4">
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79]">Message</p>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Subject</label>
                        <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Important Update from Coming Home Care"
                          className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                      </div>
                      <div className="flex-1 flex flex-col">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Body</label>
                        <textarea value={body} onChange={e => setBody(e.target.value)} rows={9} placeholder="Write your message here…"
                          className="w-full flex-1 border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
                        <p className="mt-1 text-xs text-[#7A8F79]">Line breaks are preserved. The recipient&apos;s name will be added as a greeting automatically.</p>
                      </div>
                      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                      {result && (
                        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                          <p className="text-sm font-semibold text-green-700">
                            Sent to {result.sent} of {result.total} recipients.
                            {result.failed > 0 && <span className="text-red-500 ml-1">{result.failed} failed.</span>}
                          </p>
                        </div>
                      )}
                      <button type="submit" disabled={sending || recipientCount === 0}
                        className="w-full bg-[#2F3E4E] text-white font-semibold py-2.5 rounded-xl hover:bg-[#7A8F79] transition disabled:opacity-50 text-sm">
                        {sending ? `Sending to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}…` : `Send Email to ${recipientCount} Recipient${recipientCount !== 1 ? 's' : ''}`}
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {/* ── Portal Messages ────────────────────────────────────────── */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="bg-[#2F3E4E] px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white"><span className="text-[#7A8F79] italic">ad</span>Messages</h2>
                    <p className="text-xs text-[#D9E1E8] mt-0.5">Post updates shown across provider portal pages.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setShowPromptPay(true)} title="Prompt Pay Violation Letter (NY §3224-a)"
                      className="text-[#D9E1E8] hover:text-[#7A8F79] transition text-lg font-serif leading-none select-none">§</button>
                    <button onClick={() => { setShowMsgForm(!showMsgForm); setMsgSaveMsg(''); setEditingMsgId(null) }}
                      className="bg-[#7A8F79] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white hover:text-[#2F3E4E] transition">
                      {showMsgForm ? 'Cancel' : '+ New Message'}
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {showMsgForm && (
                    <form onSubmit={handleCreateMsg} className="border border-[#D9E1E8] rounded-xl p-5 space-y-4 bg-[#f9fafb]">
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] pb-2 border-b border-[#D9E1E8]">New Portal Message</p>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Title <span className="normal-case font-normal">(optional)</span></label>
                        <input type="text" value={msgTitle} onChange={e => setMsgTitle(e.target.value)} placeholder="e.g. Important Claims Update"
                          className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Message <span className="text-red-500">*</span></label>
                        <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)} required rows={4} placeholder="Type your update here…"
                          className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-2">Category</label>
                        <div className="flex flex-wrap gap-2">
                          {MSG_CATEGORIES.map(c => (
                            <button key={c} type="button" onClick={() => setMsgCategory(c)}
                              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${msgCategory === c ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'}`}>{c}</button>
                          ))}
                        </div>
                      </div>
                      <AudienceSelector audiences={msgAudiences} nurses={nurses} onChange={setMsgAudiences} />
                      <div className="flex gap-3 pt-1">
                        <button type="button" onClick={() => { setShowMsgForm(false); resetMsgCreate() }}
                          className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:bg-[#F4F6F5] transition">Cancel</button>
                        <button type="submit" disabled={msgSaving || !msgBody.trim()}
                          className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                          {msgSaving ? 'Posting…' : msgAudiences.length === 0 ? 'Save as Draft' : 'Post Message'}
                        </button>
                      </div>
                      {msgSaveMsg && <p className="text-xs text-red-500 text-center">{msgSaveMsg}</p>}
                    </form>
                  )}

                  {msgLoading ? (
                    <p className="text-sm text-[#7A8F79]">Loading…</p>
                  ) : messages.length === 0 && !showMsgForm ? (
                    <p className="text-sm text-[#7A8F79] text-center py-4">No messages yet — post your first update above.</p>
                  ) : (
                    <div className="space-y-3">
                      {messages.map(msg => {
                        const catStyle = CATEGORY_STYLE[msg.category] || CATEGORY_STYLE.General
                        const isDraft  = msg.audiences.length === 0
                        const isEditing = editingMsgId === msg.id
                        return (
                          <div key={msg.id} className={`border border-[#D9E1E8] rounded-xl p-5 ${isEditing ? 'ring-2 ring-[#7A8F79]' : ''}`}>
                            {isEditing ? (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between pb-2 border-b border-[#D9E1E8]">
                                  <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79]">Editing Message</p>
                                  <button onClick={() => setEditingMsgId(null)} className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] font-semibold">Cancel</button>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Title <span className="normal-case font-normal">(optional)</span></label>
                                  <input type="text" value={editMsgTitle} onChange={e => setEditMsgTitle(e.target.value)} placeholder="e.g. Important Claims Update"
                                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Message <span className="text-red-500">*</span></label>
                                  <textarea value={editMsgBody} onChange={e => setEditMsgBody(e.target.value)} rows={4}
                                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-2">Category</label>
                                  <div className="flex flex-wrap gap-2">
                                    {MSG_CATEGORIES.map(c => (
                                      <button key={c} type="button" onClick={() => setEditMsgCategory(c)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${editMsgCategory === c ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'}`}>{c}</button>
                                    ))}
                                  </div>
                                </div>
                                <AudienceSelector audiences={editMsgAudiences} nurses={nurses} onChange={setEditMsgAudiences} />
                                <div className="flex gap-3 pt-1">
                                  <button onClick={() => setEditingMsgId(null)}
                                    className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg text-sm font-semibold hover:bg-[#F4F6F5] transition">Cancel</button>
                                  <button onClick={() => handleUpdateMsg(msg.id)} disabled={editMsgSaving || !editMsgBody.trim()}
                                    className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                                    {editMsgSaving ? 'Saving…' : editMsgAudiences.length === 0 ? 'Save as Draft' : 'Save Changes'}
                                  </button>
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
                                  <button onClick={() => openEditMsg(msg)} className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">Edit</button>
                                  <button onClick={() => handleDeleteMsg(msg.id)} disabled={deletingMsg === msg.id}
                                    className="text-[#D9E1E8] hover:text-red-400 transition text-lg leading-none disabled:opacity-40" title="Delete">✕</button>
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

              {/* ── Prompt Pay Reminder Settings ───────────────────────────── */}
              <form onSubmit={savePpSettings}>
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-[#2F3E4E] px-6 py-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-white">Prompt Pay Interest Reminders</h2>
                      <p className="text-xs text-[#D9E1E8] mt-0.5">Automated alert sent when a claim reaches N days since Submit Date</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs font-semibold text-[#D9E1E8]">{pp['promptPay.reminderEnabled'] === 'true' ? 'Enabled' : 'Disabled'}</span>
                      <div onClick={() => ppSet('promptPay.reminderEnabled', pp['promptPay.reminderEnabled'] === 'true' ? 'false' : 'true')}
                        className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${pp['promptPay.reminderEnabled'] === 'true' ? 'bg-[#7A8F79]' : 'bg-[#4a5568]'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${pp['promptPay.reminderEnabled'] === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                    </label>
                  </div>
                  <div className="p-6 space-y-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-4">Alert Routing</p>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Trigger Day</label>
                          <div className="flex items-center gap-2">
                            <input type="number" min="1" max="365" value={pp['promptPay.triggerDays']} onChange={e => ppSet('promptPay.triggerDays', e.target.value)}
                              className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                            <span className="text-xs text-[#7A8F79] whitespace-nowrap">days after submit</span>
                          </div>
                          <p className="text-[11px] text-[#7A8F79] mt-1">Default: 28 (email fires, day 30 is deadline)</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">From Email</label>
                          <input type="email" value={pp['promptPay.fromEmail']} onChange={e => ppSet('promptPay.fromEmail', e.target.value)} placeholder="alerts@cominghomecare.com"
                            className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Send Alert To</label>
                          <input type="email" value={pp['promptPay.toEmail']} onChange={e => ppSet('promptPay.toEmail', e.target.value)} placeholder="support@cominghomecare.com"
                            className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-[#D9E1E8] pt-5">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-4">Email Content</p>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Subject Line Template</label>
                          <input type="text" value={pp['promptPay.subjectTemplate']} onChange={e => ppSet('promptPay.subjectTemplate', e.target.value)}
                            className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                          <p className="text-[11px] text-[#7A8F79] mt-1">
                            Variables: <code className="bg-gray-100 px-1 rounded">{'{claimId}'}</code> · <code className="bg-gray-100 px-1 rounded">{'{provider}'}</code> · <code className="bg-gray-100 px-1 rounded">{'{day30}'}</code>
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Custom Note <span className="font-normal text-[#7A8F79]">(optional — appended to email body)</span></label>
                          <textarea value={pp['promptPay.customNote']} onChange={e => ppSet('promptPay.customNote', e.target.value)} rows={3}
                            placeholder="e.g. Please file the interest form immediately and track in the portal."
                            className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-[#D9E1E8] pt-5">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-4">Prompt Pay Interest Form</p>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Button / Link Name in Email</label>
                          <input type="text" value={pp['promptPay.formLinkName']} onChange={e => ppSet('promptPay.formLinkName', e.target.value)} placeholder="Prompt Pay Interest Form"
                            className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">
                            Option A: External Link URL
                            {hasUploadedForm && <span className="ml-2 text-amber-600 font-normal">(disabled — uploaded file takes priority)</span>}
                          </label>
                          <input type="url" value={pp['promptPay.formUrl']} onChange={e => ppSet('promptPay.formUrl', e.target.value)}
                            placeholder="https://example.com/prompt-pay-interest-form.pdf" disabled={hasUploadedForm}
                            className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] disabled:opacity-40 disabled:bg-gray-50" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#2F3E4E] mb-2">
                            Option B: Upload Form File
                            {hasExternalUrl && !hasUploadedForm && <span className="ml-2 text-amber-600 font-normal">(will override external URL)</span>}
                          </label>
                          {hasUploadedForm ? (
                            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                              <span className="text-green-700 text-sm font-semibold flex-1 truncate">📎 {pp['promptPay.formFileName'] || 'Uploaded form'}</span>
                              <button type="button" onClick={previewForm} className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] font-semibold transition">Preview</button>
                              <span className="text-[#D9E1E8]">|</span>
                              <label className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] font-semibold transition cursor-pointer">
                                Replace
                                <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={uploadForm} disabled={uploading} />
                              </label>
                              <span className="text-[#D9E1E8]">|</span>
                              <button type="button" onClick={deleteForm} className="text-xs text-red-400 hover:text-red-600 font-semibold transition">Remove</button>
                            </div>
                          ) : (
                            <label className={`flex items-center gap-3 border-2 border-dashed border-[#D9E1E8] rounded-lg px-4 py-4 cursor-pointer hover:border-[#7A8F79] transition ${uploading ? 'opacity-50 cursor-default' : ''}`}>
                              <span className="text-2xl">📤</span>
                              <div>
                                <p className="text-sm font-semibold text-[#2F3E4E]">{uploading ? 'Uploading…' : 'Upload PDF, PNG, or JPEG'}</p>
                                <p className="text-xs text-[#7A8F79]">Max 50 MB · Stored securely in S3</p>
                              </div>
                              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={uploadForm} disabled={uploading} />
                            </label>
                          )}
                          {uploadMsg && (
                            <p className={`mt-2 text-xs font-semibold ${uploadMsg.includes('fail') || uploadMsg.includes('failed') ? 'text-red-500' : 'text-green-600'}`}>{uploadMsg}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-[#D9E1E8] pt-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {ppSaved && <span className="text-xs font-semibold text-green-600">✓ Settings saved</span>}
                        {ppError && <span className="text-xs font-semibold text-red-500">{ppError}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={sendTestEmail} disabled={testSending}
                          className="px-4 py-2 rounded-lg border border-[#D9E1E8] text-sm font-semibold text-[#7A8F79] hover:border-[#7A8F79] hover:text-[#2F3E4E] transition disabled:opacity-50">
                          {testSending ? 'Sending…' : 'Send Test Email'}
                        </button>
                        <button type="submit" disabled={ppSaving}
                          className="px-5 py-2 rounded-lg bg-[#2F3E4E] text-white text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-60">
                          {ppSaving ? 'Saving…' : 'Save Settings'}
                        </button>
                      </div>
                    </div>
                    {testMsg && <p className={`text-xs font-semibold ${testMsg.includes('failed') ? 'text-red-500' : 'text-green-600'}`}>{testMsg}</p>}
                  </div>
                </div>
              </form>

            </div>{/* end main content */}
          </div>{/* end two-column */}
        </div>
      </div>
    </>
  )
}
