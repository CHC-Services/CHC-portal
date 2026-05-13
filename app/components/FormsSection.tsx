'use client'

import { useEffect, useState } from 'react'

type PlanData = {
  effectiveTier: string
  isTrialing: boolean
  isPaidSubscriber: boolean
}

export default function FormsSection() {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [progressNoteOpen, setProgressNoteOpen] = useState(false)

  useEffect(() => {
    fetch('/api/nurse/plan', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setPlan(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

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
                <p className="font-semibold text-[#2F3E4E] text-sm">Progress Note — Blank Template</p>
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
                Coming Home Care&apos;s custom visit progress note template. View, fill out, and print directly in your browser.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              {/* View / Preview button */}
              {loading ? (
                <div className="h-8 w-24 bg-[#D9E1E8] rounded-lg animate-pulse" />
              ) : canViewProgressNote ? (
                <button
                  onClick={() => setProgressNoteOpen(v => !v)}
                  className="text-xs font-semibold bg-[#7A8F79] text-white px-3 py-1.5 rounded-lg hover:bg-[#657a64] transition"
                >
                  {progressNoteOpen ? 'Close Preview' : 'View / Print'}
                </button>
              ) : (
                <span className="text-xs font-semibold bg-[#D9E1E8] text-[#7A8F79] px-3 py-1.5 rounded-lg cursor-not-allowed">
                  🔒 Trial Required
                </span>
              )}

              {/* Download button */}
              {loading ? (
                <div className="h-8 w-24 bg-[#D9E1E8] rounded-lg animate-pulse" />
              ) : canDownloadProgressNote ? (
                <a
                  href="/Progress-Note-BLANK.pdf"
                  download
                  className="text-xs font-semibold bg-[#2F3E4E] text-white px-3 py-1.5 rounded-lg hover:bg-[#7A8F79] transition"
                >
                  Download PDF
                </a>
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

          {/* PDF embed */}
          {progressNoteOpen && canViewProgressNote && (
            <div className="border-t border-[#D9E1E8]">
              <iframe
                src="/Progress-Note-BLANK.pdf"
                className="w-full"
                style={{ height: '680px' }}
                title="Progress Note — Blank Template"
              />
              <div className="px-4 py-3 bg-[#f9fafb] border-t border-[#D9E1E8] flex items-center justify-between gap-3">
                <p className="text-xs text-[#7A8F79]">
                  Use your browser&apos;s print button (Ctrl/Cmd+P) to print or save as PDF after filling.
                </p>
                {canDownloadProgressNote && (
                  <a
                    href="/Progress-Note-BLANK.pdf"
                    download
                    className="shrink-0 text-xs font-semibold bg-[#2F3E4E] text-white px-3 py-1.5 rounded-lg hover:bg-[#7A8F79] transition"
                  >
                    Download PDF
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </section>
  )
}
