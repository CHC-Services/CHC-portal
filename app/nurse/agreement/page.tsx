'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const POLICIES = [
  {
    heading: 'Account Security',
    body: 'My login credentials are personal and confidential. I will not share my username or password with anyone. I will notify Coming Home Care Services immediately if I believe my account has been accessed without my authorization.',
  },
  {
    heading: 'Data Encryption & PHI Responsibility',
    body: 'I understand that all data stored on this portal is protected under AWS S3 HIPAA-compliant encryption standards while at rest and in transit. If I choose to print, download, or save any Protected Health Information (PHI) outside of this portal, I accept full responsibility for continuing to manage and protect that information in accordance with applicable privacy laws.',
  },
  {
    heading: 'Confidentiality of Portal Data',
    body: 'Claim submissions, payment records, invoices, and any documents visible in this portal are confidential. I will not screenshot, copy, forward, or distribute this information to any unauthorized party.',
  },
  {
    heading: 'Electronic Communications',
    body: 'By using this portal, I grant Coming Home Care Services, LLC permission to contact me by email, text message, or phone for purposes including but not limited to: submission reminders, billing alerts, data clarification requests, and other business-related communications. I understand I may update my communication preferences at any time from my profile settings.',
  },
  {
    heading: 'Data Privacy — No Sale or Sharing',
    body: 'I understand that my personal information, claim data, and any files stored in this portal will never be sold, rented, or shared with any third party for any reason other than the direct fulfillment of services offered through this portal (such as submitting claims to payers on my behalf).',
  },
  {
    heading: 'Right to Delete',
    body: 'I understand that I may request the deletion of my user profile, personal information, and personal files from this portal at any time by contacting Coming Home Care Services at support@cominghomecare.com. Requests will be processed promptly and I will receive confirmation when completed.',
  },
  {
    heading: 'Billing Services — No Minimum Commitment',
    body: 'I understand that if I choose to enroll in billing services through this portal, I may cancel that enrollment at any time with no minimum length of service, no cancellation fees, and no penalty. Cancellation requests should be submitted in writing to support@cominghomecare.com. A notice to any increase to the cost of service will be given 30 days prior to the change taking effeect. Any decrease to a cost of service will take effecr immediatelty without notice.',
  },
  {
    heading: 'Accuracy of Submitted Information',
    body: 'I am responsible for the accuracy of all hours, dates of service, and other information I submit through this portal. I understand that intentional misrepresentation of submitted data may result in immediate termination of services.',
  },
  {
    heading: 'Scope of Services',
    body: 'Coming Home Care Services, LLC provides billing facilitation and administrative support only. Nothing in this portal constitutes medical advice, legal counsel, or a guarantee of insurance reimbursement. All reimbursement determinations are made solely by the relevant payers.',
  },
  {
    heading: 'Acceptable Use',
    body: 'This portal is for professional use exclusively in connection with my relationship with Coming Home Care Services, LLC. I will not attempt to access data belonging to other providers or use the portal for any purpose outside of its intended billing and administrative functions.',
  },
  {
    heading: 'Policy Updates',
    body: 'Coming Home Care Services, LLC reserves the right to update these terms at any time. I will be notified of material changes with reasonable advance notice. My continued use of the portal following such notification constitutes my acceptance of the updated terms.',
  },
]

const CLOSING_REMARK = `This portal was built with you in mind — with the genuine goal of streamlining your workflow and reducing the time you spend tracking income, submitting hours, and managing documents. If there's a feature you'd like to see added, something that would make your day easier, or anything we can do better, please don't hesitate to reach out. We're always listening.`

export default function AgreementPage() {
  const router = useRouter()
  const [checked, setChecked] = useState<boolean[]>(Array(POLICIES.length).fill(false))
  const [initials, setInitials] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    fetch('/api/nurse/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (!data.profile) { router.replace('/login'); return }
        if (data.profile.portalAgreementSignedAt) { router.replace('/nurse'); return }
        setDisplayName(data.profile.displayName || '')
      })
  }, [router])

  const allChecked = checked.every(Boolean) && initials.trim().length >= 1

  function toggle(i: number) {
    setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allChecked) return
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/nurse/agreement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ initials: initials.trim().toUpperCase() }),
    })

    if (res.ok) {
      window.location.href = '/nurse'
    } else {
      const data = await res.json()
      setError(data.error || 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] px-4 py-10 md:py-16">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Coming Home Care Services, LLC</p>
          <h1 className="text-3xl font-bold text-[#2F3E4E]">
            <span className="italic text-[#7A8F79]">my</span>Provider User Agreement
          </h1>
          {displayName && (
            <p className="text-sm text-[#7A8F79] mt-2">Welcome, <strong className="text-[#2F3E4E]">{displayName}</strong>. Please read and acknowledge each item below before accessing your portal.</p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Intro */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <p className="text-sm text-[#4a5568] leading-relaxed">
              This agreement outlines how to responsibly use the <b><span className="italic text-[#7A8F79]">my</span>Provider</b> portal. We&apos;ve written it in plain language — no hidden traps, no fine print designed to confuse. Protecting patient and user data is a team effort. By acknowledging the points below, you affirm your understanding that once PHI is downloaded/saved/printed from the site it becomes the user's responsibility to maintian the confidentiality of its contents and you agree to uphold your side of the parntership by keeping said data securely stored until it can be disposed of properly when no longer needed. 
            </p>
            <p className="text-xs text-[#7A8F79] mt-3 font-medium">Check each box to confirm you have read and understood that item.</p>
          </div>

          {/* Policy checkboxes */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
            {POLICIES.map((policy, i) => (
              <label
                key={i}
                className={`flex gap-4 p-5 cursor-pointer transition-colors ${
                  i < POLICIES.length - 1 ? 'border-b border-[#D9E1E8]' : ''
                } ${checked[i] ? 'bg-[#f4f9f4]' : 'hover:bg-[#f9fafb]'}`}
              >
                {/* Checkbox */}
                <div className="shrink-0 mt-0.5">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      checked[i] ? 'bg-[#7A8F79] border-[#7A8F79]' : 'border-[#D9E1E8] bg-white'
                    }`}
                  >
                    {checked[i] && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked[i]}
                  onChange={() => toggle(i)}
                />
                {/* Text */}
                <div>
                  <p className="text-sm font-semibold text-[#2F3E4E] mb-1">
                    {i + 1}. {policy.heading}
                  </p>
                  <p className="text-sm text-[#4a5568] leading-relaxed">{policy.body}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Closing remark */}
          <div className="bg-[#2F3E4E] rounded-2xl p-6 mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-2">A Note From Us</p>
            <p className="text-sm text-white/90 leading-relaxed">{CLOSING_REMARK}</p>
            <p className="text-xs text-[#7A8F79] mt-3">— The Coming Home Care Services Team</p>
          </div>

          {/* Signature block */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <p className="text-sm font-semibold text-[#2F3E4E] mb-1">Your Initials</p>
            <p className="text-xs text-[#7A8F79] mb-4">
              By entering your initials below and clicking Submit, you confirm that you have read, understood, and agree to all items above. A signed copy will be saved to your account.
            </p>
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-[180px]">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Initials</label>
                <input
                  type="text"
                  value={initials}
                  onChange={e => setInitials(e.target.value.replace(/[^a-zA-Z.]/g, '').slice(0, 5))}
                  placeholder="e.g. J.B."
                  maxLength={5}
                  className="w-full border-2 border-[#D9E1E8] px-3 py-2 rounded-lg text-xl font-bold text-[#2F3E4E] tracking-widest focus:outline-none focus:border-[#7A8F79] uppercase"
                />
              </div>
              {initials && (
                <p className="text-xs text-[#7A8F79] pb-2">Signing as <strong className="text-[#2F3E4E]">{initials.toUpperCase()}</strong></p>
              )}
            </div>
          </div>

          {/* Progress + submit */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 bg-[#D9E1E8] rounded-full h-2">
                <div
                  className="bg-[#7A8F79] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(checked.filter(Boolean).length / POLICIES.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-[#7A8F79] shrink-0">
                {checked.filter(Boolean).length} / {POLICIES.length} acknowledged
              </span>
            </div>

            {error && (
              <p className="text-sm text-red-600 font-medium mb-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={!allChecked || submitting}
              className="w-full bg-[#2F3E4E] text-white font-bold py-3 rounded-xl hover:bg-[#7A8F79] transition disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              {submitting
                ? 'Saving agreement…'
                : !checked.every(Boolean)
                  ? `Acknowledge all ${POLICIES.length - checked.filter(Boolean).length} remaining items to continue`
                  : !initials.trim()
                    ? 'Enter your initials to continue'
                    : 'I Agree — Submit & Enter Portal'}
            </button>

            <p className="text-xs text-[#7A8F79] text-center mt-3">
              A copy of this agreement will be saved to your account documents.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
