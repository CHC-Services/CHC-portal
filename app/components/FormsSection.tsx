'use client'

import { useEffect, useState } from 'react'

type PlanData = {
  effectiveTier: string
  isTrialing: boolean
  isPaidSubscriber: boolean
}

type PrefillFields = {
  patientName: string
  patientId: string
  dos: string
  hrIn: string
  hrOut: string
  totalHr: string
  arrivalFindings: string
}

function today() {
  return new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

function calcTotal(hrIn: string, hrOut: string): string {
  if (!hrIn || !hrOut) return ''
  const [inH, inM] = hrIn.split(':').map(Number)
  const [outH, outM] = hrOut.split(':').map(Number)
  if (isNaN(inH) || isNaN(outH)) return ''
  const diff = (outH * 60 + outM) - (inH * 60 + inM)
  if (diff <= 0) return ''
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function FormsSection() {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [progressNoteOpen, setProgressNoteOpen] = useState(false)
  const [prefillOpen, setPrefillOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [fields, setFields] = useState<PrefillFields>({
    patientName: '',
    patientId: '',
    dos: today(),
    hrIn: '',
    hrOut: '',
    totalHr: '',
    arrivalFindings: '',
  })

  useEffect(() => {
    fetch('/api/nurse/plan', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setPlan(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function setField(key: keyof PrefillFields, value: string) {
    setFields(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'hrIn' || key === 'hrOut') {
        next.totalHr = calcTotal(
          key === 'hrIn' ? value : prev.hrIn,
          key === 'hrOut' ? value : prev.hrOut,
        )
      }
      return next
    })
  }

  function handleDownload() {
    setGenerating(true)
    const params = new URLSearchParams({
      patientName: fields.patientName,
      patientId: fields.patientId,
      dos: fields.dos,
      hrIn: fields.hrIn,
      hrOut: fields.hrOut,
      totalHr: fields.totalHr,
      arrivalFindings: fields.arrivalFindings,
    })
    const link = document.createElement('a')
    link.href = `/api/nurse/progress-note?${params}`
    link.download = `Progress-Note-${fields.dos.replace(/\//g, '-') || 'blank'}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => setGenerating(false), 1500)
  }

  const canViewProgressNote = plan && plan.effectiveTier !== 'FREE'
  const canDownloadProgressNote = plan?.isPaidSubscriber === true

  return (
    <section id="claim-forms" className="bg-white rounded-2xl shadow-sm overflow-hidden scroll-mt-28 md:scroll-mt-56">
      {/* Header */}
      <div className="bg-[#2F3E4E] px-6 py-5">
        <div className="flex items-start gap-3">
          <span className="text-3xl">📝</span>
          <div>
            <h2 className="text-xl font-bold text-white">Claim Forms &amp; Blank Templates</h2>
            <p className="text-sm text-[#D9E1E8] mt-1">
              Standard forms used when submitting healthcare claims. The CMS-1500 (HCFA) is the universal paper claim form accepted by Medicare, Medicaid, and most commercial insurers including BCBS.
            </p>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="mx-6 mt-5 bg-[#f0f4f0] border-l-4 border-[#7A8F79] rounded-r-lg px-4 py-3">
        <p className="text-xs text-[#4a5a6a] leading-relaxed">
          Most claims submitted through Coming Home Care are filed electronically — you do not need to mail a paper CMS-1500 unless specifically requested by a payer. These downloads are provided as reference tools.
        </p>
      </div>

      <div className="px-6 py-5 space-y-4">

        {/* CMS-1500 — always available */}
        <a
          href="/CMS-1500-HCFA.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col gap-1.5 border border-[#D9E1E8] rounded-xl p-4 hover:border-[#7A8F79] hover:shadow-sm transition"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-[#2F3E4E] text-sm group-hover:text-[#7A8F79] transition">
              CMS-1500 Claim Form (HCFA) →
            </p>
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-[#D9E1E8] text-[#2F3E4E] px-2 py-0.5 rounded-full">
              Download PDF
            </span>
          </div>
          <p className="text-xs text-[#7A8F79] leading-relaxed">
            The standard paper claim form required by Medicare, Medicaid, and most commercial insurers. Download and print for manual submissions or reference.
          </p>
        </a>

        {/* Progress Note — gated */}
        <div className="border border-[#D9E1E8] rounded-xl overflow-hidden">
          <div className="flex items-start justify-between gap-3 p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-[#2F3E4E] text-sm">Progress Note w/ Vitals Chart</p>
                {plan?.isTrialing && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-[#f0f4f0] text-[#7A8F79] border border-[#7A8F79] px-2 py-0.5 rounded-full">
                    Trial
                  </span>
                )}
                {plan?.isPaidSubscriber && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-[#2F3E4E] text-white px-2 py-0.5 rounded-full">
                    Basic
                  </span>
                )}
              </div>
              <p className="text-xs text-[#7A8F79] leading-relaxed">
                Coming Home Care&apos;s custom visit progress note with integrated vitals chart. View, fill out, and print directly in your browser.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              {/* View / Preview button */}
              {loading ? (
                <div className="h-8 w-24 bg-[#D9E1E8] rounded-lg animate-pulse" />
              ) : canViewProgressNote ? (
                <button
                  onClick={() => { setProgressNoteOpen(v => !v); setPrefillOpen(false) }}
                  className="text-xs font-semibold bg-[#7A8F79] text-white px-3 py-1.5 rounded-lg hover:bg-[#657a64] transition"
                >
                  {progressNoteOpen ? 'Close Preview' : 'View / Print'}
                </button>
              ) : (
                <span className="text-xs font-semibold bg-[#D9E1E8] text-[#7A8F79] px-3 py-1.5 rounded-lg cursor-not-allowed">
                  🔒 Subscription Required
                </span>
              )}

              {/* Download / Pre-fill button */}
              {loading ? (
                <div className="h-8 w-24 bg-[#D9E1E8] rounded-lg animate-pulse" />
              ) : canDownloadProgressNote ? (
                <button
                  onClick={() => { setPrefillOpen(v => !v); setProgressNoteOpen(false) }}
                  className="text-xs font-semibold bg-[#2F3E4E] text-white px-3 py-1.5 rounded-lg hover:bg-[#7A8F79] transition"
                >
                  {prefillOpen ? 'Cancel' : 'Download / Pre-fill'}
                </button>
              ) : (
                <div className="text-right">
                  <button
                    disabled
                    className="text-xs font-semibold bg-[#D9E1E8] text-[#a0adb8] px-3 py-1.5 rounded-lg cursor-not-allowed"
                  >
                    Download PDF
                  </button>
                  <p className="text-[10px] text-[#7A8F79] mt-1 max-w-[160px] leading-tight">
                    Available with Basic or higher subscription
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Locked state for FREE users */}
          {!loading && !canViewProgressNote && (
            <div className="mx-4 mb-4 bg-[#f9fafb] border border-[#D9E1E8] rounded-lg p-4 flex items-center gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <p className="text-sm font-semibold text-[#2F3E4E]">Sign up to access this form</p>
                <p className="text-xs text-[#7A8F79] mt-0.5">
                  Create an account to start your free 14-day trial and unlock view, print, and fill access.
                </p>
              </div>
            </div>
          )}

          {/* Pre-fill panel */}
          {prefillOpen && canDownloadProgressNote && (
            <div className="border-t border-[#D9E1E8] bg-[#f9fafb] px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-4">
                Pre-fill Header Fields
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Patient Name</label>
                  <input
                    type="text"
                    value={fields.patientName}
                    onChange={e => setField('patientName', e.target.value)}
                    placeholder="Full name"
                    className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Patient ID / Medicaid #</label>
                  <input
                    type="text"
                    value={fields.patientId}
                    onChange={e => setField('patientId', e.target.value)}
                    placeholder="e.g. 12345678A"
                    className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Date of Service</label>
                  <input
                    type="text"
                    value={fields.dos}
                    onChange={e => setField('dos', e.target.value)}
                    placeholder="MM/DD/YYYY"
                    className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Time In</label>
                    <input
                      type="time"
                      value={fields.hrIn}
                      onChange={e => setField('hrIn', e.target.value)}
                      className="w-full border border-[#D9E1E8] rounded-lg px-2 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Time Out</label>
                    <input
                      type="time"
                      value={fields.hrOut}
                      onChange={e => setField('hrOut', e.target.value)}
                      className="w-full border border-[#D9E1E8] rounded-lg px-2 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">Total</label>
                    <input
                      type="text"
                      value={fields.totalHr}
                      readOnly
                      placeholder="Auto"
                      className="w-full border border-[#D9E1E8] rounded-lg px-2 py-2 text-sm text-[#7A8F79] bg-[#f4f6f5] cursor-default"
                    />
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#2F3E4E] mb-1">
                  Arrival Findings <span className="text-[#7A8F79] font-normal">(optional)</span>
                </label>
                <textarea
                  value={fields.arrivalFindings}
                  onChange={e => setField('arrivalFindings', e.target.value)}
                  placeholder="Patient presentation at arrival, initial assessment notes…"
                  rows={3}
                  className="w-full border border-[#D9E1E8] rounded-lg px-3 py-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-[#7A8F79]">
                  Your name is filled automatically. Leave any field blank to fill it by hand.
                </p>
                <button
                  onClick={handleDownload}
                  disabled={generating}
                  className="shrink-0 bg-[#2F3E4E] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50"
                >
                  {generating ? 'Generating…' : 'Generate & Download'}
                </button>
              </div>
            </div>
          )}

          {/* PDF embed */}
          {progressNoteOpen && canViewProgressNote && (
            <div className="border-t border-[#D9E1E8]">
              <iframe
                src="/Progress-Note-BLANK.pdf"
                className="w-full"
                style={{ height: '680px' }}
                title="Progress Note w/ Vitals Chart"
              />
              <div className="px-4 py-3 bg-[#f9fafb] border-t border-[#D9E1E8] flex items-center justify-between gap-3">
                <p className="text-xs text-[#7A8F79]">
                  Use your browser&apos;s print button (Ctrl/Cmd+P) to print or save as PDF after filling.
                </p>
                {canDownloadProgressNote && (
                  <button
                    onClick={() => { setProgressNoteOpen(false); setPrefillOpen(true) }}
                    className="shrink-0 text-xs font-semibold bg-[#2F3E4E] text-white px-3 py-1.5 rounded-lg hover:bg-[#7A8F79] transition"
                  >
                    Pre-fill & Download
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </section>
  )
}
