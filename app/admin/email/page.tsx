'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AdminNav from '../../components/AdminNav'

type Nurse = {
  id: string
  displayName: string
  receiveNotifications: boolean
  user: { email: string }
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

export default function AdminEmailPage() {
  const router = useRouter()

  // ── Broadcast email state ──────────────────────────────────────────────────
  const [nurses, setNurses] = useState<Nurse[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [selectAll, setSelectAll] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [error, setError] = useState('')

  // ── Prompt Pay settings state ──────────────────────────────────────────────
  const [pp, setPp] = useState<PPSettings>(PP_DEFAULTS)
  const [ppSaving, setPpSaving] = useState(false)
  const [ppSaved, setPpSaved] = useState(false)
  const [ppError, setPpError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/nurses', { credentials: 'include' })
      .then(r => { if (r.status === 401) { router.push('/login'); return } return r.json() })
      .then(data => { if (Array.isArray(data)) setNurses(data) })

    fetch('/api/admin/prompt-pay-settings', { credentials: 'include' })
      .then(r => r.ok ? r.json() : {})
      .then((data: Partial<PPSettings>) => {
        setPp(prev => ({ ...prev, ...data }))
      })
  }, [router])

  // ── Broadcast email helpers ────────────────────────────────────────────────
  function toggleNurse(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    setSelectAll(false)
  }
  function toggleAll() {
    if (selectAll) { setSelectAll(false); setSelected(new Set()) }
    else { setSelectAll(true); setSelected(new Set()) }
  }
  const recipientCount = selectAll ? nurses.length : selected.size

  async function send(e: React.FormEvent) {
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
    } else {
      const data = await res.json(); setError(data.error || 'Failed to send.')
    }
  }

  // ── Prompt Pay settings helpers ────────────────────────────────────────────
  function ppSet(key: keyof PPSettings, value: string) {
    setPp(prev => ({ ...prev, [key]: value }))
    setPpSaved(false)
  }

  async function savePpSettings(e: React.FormEvent) {
    e.preventDefault()
    setPpSaving(true); setPpError(''); setPpSaved(false)
    const res = await fetch('/api/admin/prompt-pay-settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ settings: pp }),
    })
    setPpSaving(false)
    if (res.ok) setPpSaved(true)
    else setPpError('Failed to save settings.')
  }

  async function uploadForm(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadMsg('')
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/admin/prompt-pay-settings/upload', {
      method: 'POST', credentials: 'include', body: fd,
    })
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
    const data = await res.json()
    if (data.url) window.open(data.url, '_blank')
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

  const hasUploadedForm = !!pp['promptPay.formS3Key']
  const hasExternalUrl  = !!pp['promptPay.formUrl'].trim()

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">

        <div className="mb-2">
          <AdminNav />
          <h1 className="text-3xl font-bold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">ad</span>Email
          </h1>
          <p className="text-sm text-[#7A8F79] mt-1">Compose and send a message to one or more providers.</p>
        </div>

        {/* ── Broadcast Email Form ────────────────────────────────────────── */}
        <form onSubmit={send} className="space-y-5">

          {/* Recipients */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-3 border-b border-[#D9E1E8] mb-4">
              Recipients
            </h2>
            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input type="checkbox" checked={selectAll} onChange={toggleAll} className="w-4 h-4 rounded accent-[#2F3E4E]" />
              <span className="text-sm font-semibold text-[#2F3E4E]">All Providers ({nurses.length})</span>
            </label>
            <div className="divide-y divide-[#D9E1E8] border border-[#D9E1E8] rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              {nurses.map(nurse => (
                <label key={nurse.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition ${(selectAll || selected.has(nurse.id)) ? 'bg-[#f4f6f5]' : 'hover:bg-[#fafbfa]'}`}>
                  <input type="checkbox" checked={selectAll || selected.has(nurse.id)} onChange={() => !selectAll && toggleNurse(nurse.id)} disabled={selectAll} className="w-4 h-4 rounded accent-[#2F3E4E]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#2F3E4E]">{nurse.displayName}</p>
                    <p className="text-xs text-[#7A8F79] truncate">{nurse.user.email}</p>
                  </div>
                  {!nurse.receiveNotifications && (
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">Reminders off</span>
                  )}
                </label>
              ))}
            </div>
            {recipientCount > 0 && <p className="mt-3 text-xs text-[#7A8F79]">{recipientCount} recipient{recipientCount !== 1 ? 's' : ''} selected</p>}
          </div>

          {/* Compose */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] pb-3 border-b border-[#D9E1E8]">Message</h2>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Subject</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Important Update from Coming Home Care" className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Body</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Write your message here…" className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-y" />
              <p className="mt-1 text-xs text-[#7A8F79]">Line breaks are preserved. The recipient&apos;s name will be added as a greeting automatically.</p>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
          {result && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-700">
                Sent to {result.sent} of {result.total} recipients.
                {result.failed > 0 && <span className="text-red-500 ml-1">{result.failed} failed.</span>}
              </p>
            </div>
          )}

          <button type="submit" disabled={sending || recipientCount === 0} className="w-full bg-[#2F3E4E] text-white font-semibold py-3 rounded-xl hover:bg-[#7A8F79] transition disabled:opacity-50">
            {sending ? `Sending to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}…` : `Send Email to ${recipientCount} Recipient${recipientCount !== 1 ? 's' : ''}`}
          </button>

        </form>

        {/* ── Prompt Pay Reminder Settings ────────────────────────────────── */}
        <form onSubmit={savePpSettings}>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">

            {/* Section header */}
            <div className="bg-[#2F3E4E] px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Prompt Pay Interest Reminders</h2>
                <p className="text-xs text-[#D9E1E8] mt-0.5">Automated alert sent when a claim reaches N days since Submit Date</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-semibold text-[#D9E1E8]">{pp['promptPay.reminderEnabled'] === 'true' ? 'Enabled' : 'Disabled'}</span>
                <div
                  onClick={() => ppSet('promptPay.reminderEnabled', pp['promptPay.reminderEnabled'] === 'true' ? 'false' : 'true')}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${pp['promptPay.reminderEnabled'] === 'true' ? 'bg-[#7A8F79]' : 'bg-[#4a5568]'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${pp['promptPay.reminderEnabled'] === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>

            <div className="p-6 space-y-6">

              {/* Trigger + Routing */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-4">Alert Routing</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Trigger Day</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min="1" max="365"
                        value={pp['promptPay.triggerDays']}
                        onChange={e => ppSet('promptPay.triggerDays', e.target.value)}
                        className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                      />
                      <span className="text-xs text-[#7A8F79] whitespace-nowrap">days after submit</span>
                    </div>
                    <p className="text-[11px] text-[#7A8F79] mt-1">Default: 28 (email fires, day 30 is deadline)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">From Email</label>
                    <input
                      type="email" value={pp['promptPay.fromEmail']}
                      onChange={e => ppSet('promptPay.fromEmail', e.target.value)}
                      placeholder="alerts@cominghomecare.com"
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Send Alert To</label>
                    <input
                      type="email" value={pp['promptPay.toEmail']}
                      onChange={e => ppSet('promptPay.toEmail', e.target.value)}
                      placeholder="support@cominghomecare.com"
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                    />
                  </div>
                </div>
              </div>

              {/* Subject + Custom Note */}
              <div className="border-t border-[#D9E1E8] pt-5">
                <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-4">Email Content</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Subject Line Template</label>
                    <input
                      type="text" value={pp['promptPay.subjectTemplate']}
                      onChange={e => ppSet('promptPay.subjectTemplate', e.target.value)}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                    />
                    <p className="text-[11px] text-[#7A8F79] mt-1">
                      Variables: <code className="bg-gray-100 px-1 rounded">{'{claimId}'}</code> · <code className="bg-gray-100 px-1 rounded">{'{provider}'}</code> · <code className="bg-gray-100 px-1 rounded">{'{day30}'}</code>
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Custom Note <span className="font-normal text-[#7A8F79]">(optional — appended to email body)</span></label>
                    <textarea
                      value={pp['promptPay.customNote']}
                      onChange={e => ppSet('promptPay.customNote', e.target.value)}
                      rows={3}
                      placeholder="e.g. Please file the interest form immediately and track in the portal."
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Prompt Pay Interest Form */}
              <div className="border-t border-[#D9E1E8] pt-5">
                <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-4">Prompt Pay Interest Form</p>

                <div className="space-y-4">
                  {/* Link button display name */}
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Button / Link Name in Email</label>
                    <input
                      type="text" value={pp['promptPay.formLinkName']}
                      onChange={e => ppSet('promptPay.formLinkName', e.target.value)}
                      placeholder="Prompt Pay Interest Form"
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                    />
                  </div>

                  {/* Option A — external URL */}
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">
                      Option A: External Link URL
                      {hasUploadedForm && <span className="ml-2 text-amber-600 font-normal">(disabled — uploaded file takes priority)</span>}
                    </label>
                    <input
                      type="url" value={pp['promptPay.formUrl']}
                      onChange={e => ppSet('promptPay.formUrl', e.target.value)}
                      placeholder="https://example.com/prompt-pay-interest-form.pdf"
                      disabled={hasUploadedForm}
                      className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] disabled:opacity-40 disabled:bg-gray-50"
                    />
                  </div>

                  {/* Option B — file upload */}
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-2">
                      Option B: Upload Form File
                      {hasExternalUrl && !hasUploadedForm && <span className="ml-2 text-amber-600 font-normal">(will override external URL)</span>}
                    </label>

                    {hasUploadedForm ? (
                      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                        <span className="text-green-700 text-sm font-semibold flex-1 truncate">
                          📎 {pp['promptPay.formFileName'] || 'Uploaded form'}
                        </span>
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
                      <p className={`mt-2 text-xs font-semibold ${uploadMsg.includes('fail') || uploadMsg.includes('failed') ? 'text-red-500' : 'text-green-600'}`}>
                        {uploadMsg}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="border-t border-[#D9E1E8] pt-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {ppSaved && <span className="text-xs font-semibold text-green-600">✓ Settings saved</span>}
                  {ppError && <span className="text-xs font-semibold text-red-500">{ppError}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={sendTestEmail}
                    disabled={testSending}
                    className="px-4 py-2 rounded-lg border border-[#D9E1E8] text-sm font-semibold text-[#7A8F79] hover:border-[#7A8F79] hover:text-[#2F3E4E] transition disabled:opacity-50"
                  >
                    {testSending ? 'Sending…' : 'Send Test Email'}
                  </button>
                  <button
                    type="submit"
                    disabled={ppSaving}
                    className="px-5 py-2 rounded-lg bg-[#2F3E4E] text-white text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-60"
                  >
                    {ppSaving ? 'Saving…' : 'Save Settings'}
                  </button>
                </div>
              </div>
              {testMsg && <p className={`text-xs font-semibold ${testMsg.includes('failed') ? 'text-red-500' : 'text-green-600'}`}>{testMsg}</p>}

            </div>
          </div>
        </form>

      </div>
    </div>
  )
}
