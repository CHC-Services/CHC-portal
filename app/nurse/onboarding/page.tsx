'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Answers = {
  enrolledInBilling: boolean | null
  carrierCount: number
  billingDurationType: 'full_year' | 'policy_specific' | null
  billingDurationNote: string
  signature: string
}

function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-8 max-w-xl w-full">
      {children}
    </div>
  )
}

function Question({ text }: { text: string }) {
  return <h2 className="text-xl font-bold text-[#2F3E4E] mb-6 leading-snug">{text}</h2>
}

function ChoiceButton({
  label,
  sub,
  subNode,
  selected,
  onClick,
}: {
  label: string
  sub?: string
  subNode?: React.ReactNode
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border-2 transition ${
        selected
          ? 'border-[#7A8F79] bg-[#F4F6F5] text-[#2F3E4E]'
          : 'border-[#D9E1E8] hover:border-[#7A8F79] text-[#2F3E4E]'
      }`}
    >
      <p className="font-semibold">{label}</p>
      {sub && <p className="text-sm text-[#7A8F79] mt-0.5">{sub}</p>}
      {subNode && <p className="text-sm text-[#7A8F79] mt-0.5">{subNode}</p>}
    </button>
  )
}

function NextBtn({ onClick, disabled, label = 'Continue' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-6 w-full bg-[#2F3E4E] text-white py-3 rounded-xl hover:bg-[#7A8F79] transition font-semibold disabled:opacity-40"
    >
      {label}
    </button>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [optedOutConfirm, setOptedOutConfirm] = useState(false)
  const [answers, setAnswers] = useState<Answers>({
    enrolledInBilling: null,
    carrierCount: 1,
    billingDurationType: null,
    billingDurationNote: '',
    signature: '',
  })

  const set = (patch: Partial<Answers>) => setAnswers(a => ({ ...a, ...patch }))

  async function submit() {
    setSubmitting(true)
    setError('')

    // Sign the billing agreement first — generates and saves the document
    const agreeRes = await fetch('/api/nurse/billing-agreement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ initials: answers.signature.trim().toUpperCase() }),
    })
    if (!agreeRes.ok) {
      const data = await agreeRes.json()
      setError(data.error || 'Failed to save agreement. Please try again.')
      setSubmitting(false)
      return
    }

    // Then complete the onboarding enrollment
    const res = await fetch('/api/nurse/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(answers),
    })
    if (res.ok) {
      router.push('/nurse')
    } else {
      setError('Enrollment failed. Please try again.')
      setSubmitting(false)
    }
  }

  async function skipBilling() {
    setSubmitting(true)
    await fetch('/api/nurse/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ enrolledInBilling: false }),
    })
    setSubmitting(false)
    setOptedOutConfirm(true)
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] flex flex-col items-center justify-center p-6">

      {/* Progress dots */}
      <div className="flex gap-2 mb-6">
        {(answers.enrolledInBilling !== false ? [1,2,3,4] : [1]).map(n => (
          <div
            key={n}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              step >= n ? 'bg-[#2F3E4E]' : 'bg-[#D9E1E8] border border-[#7A8F79]'
            }`}
          />
        ))}
      </div>

      {/* Opt-out confirmation */}
      {optedOutConfirm && (
        <StepCard>
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-[#D9E1E8] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#7A8F79]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#2F3E4E] mb-2">Got it — no billing services for now.</h2>
            <p className="text-sm text-[#7A8F79] leading-relaxed mb-6">
              You can enroll in billing services at any time by clicking the{' '}
              <strong className="text-[#2F3E4E]">"Enroll in Services"</strong> button on your provider dashboard.
              There's no deadline — whenever you're ready, we're here.
            </p>
            <button
              onClick={() => router.push('/nurse')}
              className="w-full bg-[#2F3E4E] text-white py-3 rounded-xl hover:bg-[#7A8F79] transition font-semibold"
            >
              Go to My Dashboard
            </button>
          </div>
        </StepCard>
      )}

      {/* Step 1 — Enrollment */}
      {!optedOutConfirm && step === 1 && (
        <StepCard>
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-2">Step 1 of {answers.enrolledInBilling === false ? '1' : '4'}</p>
          <Question text="Would you like to enroll in billing services through Coming Home Care?" />
          <div className="space-y-3">
            <ChoiceButton
              label="Yes — begin my enrollment"
              sub="A short questionnaire & service agreement will follow. You are free to unenroll or make changes to your service plan at any time."
              selected={answers.enrolledInBilling === true}
              onClick={() => set({ enrolledInBilling: true })}
            />
            <ChoiceButton
              label="No — I'll manage my own billing"
              subNode={<>Enroll in billing services at any time by clicking &lsquo;Start Enrollment&rsquo; in your <em>my</em><strong>Billing</strong> section, or by{' '}<a href="mailto:enroll@cominghomecare.com?subject=Billing%20Enrollment%20Request&body=Hi%20Coming%20Home%20Care%2C%0A%0AI%20would%20like%20to%20enroll%20in%20billing%20services.%0A%0AName%3A%20%0A%0AThank%20you." className="underline text-[#2F3E4E] hover:text-[#7A8F79]" onClick={e => e.stopPropagation()}>contacting us</a>.</>}
              selected={answers.enrolledInBilling === false}
              onClick={() => set({ enrolledInBilling: false })}
            />
          </div>
          <NextBtn
            disabled={answers.enrolledInBilling === null}
            onClick={() => answers.enrolledInBilling ? setStep(2) : skipBilling()}
            label={answers.enrolledInBilling === false ? 'Continue to Dashboard' : 'Continue'}
          />
        </StepCard>
      )}

      {/* Step 2 — Carrier count */}
      {!optedOutConfirm && step === 2 && (
        <StepCard>
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-2">Step 2 of 4</p>
          <Question text="How many insurance carriers will you need billed?" />
          <div className="space-y-3">
            <ChoiceButton
              label="1 carrier — Single Payer"
              sub="Plan A1 (BCBS) or A2 (Medicaid) · $2–$3 per date of service"
              selected={answers.carrierCount === 1}
              onClick={() => set({ carrierCount: 1 })}
            />
            <ChoiceButton
              label="2 carriers — Dual Payer"
              sub="Plan B (BCBS + Medicaid) · $4 per date of service"
              selected={answers.carrierCount === 2}
              onClick={() => set({ carrierCount: 2 })}
            />
            <ChoiceButton
              label="3 or more carriers"
              sub="Custom arrangement — we'll discuss your specific situation."
              selected={answers.carrierCount >= 3}
              onClick={() => set({ carrierCount: 3 })}
            />
          </div>
          {/* Availity callout — shown for any plan that includes BCBS */}
          {answers.carrierCount <= 2 && (
            <div className="mt-5 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm space-y-1.5">
              <p className="font-semibold text-[#2F3E4E]">Don't have a clearinghouse yet?</p>
              <p className="text-xs text-[#7A8F79] leading-relaxed">
                Submitting BCBS claims electronically requires a clearinghouse or compatible billing software.
                If you don't already have one, <strong className="text-[#2F3E4E]">Availity Essentials</strong> is
                a free option used widely by NY home care providers — no subscription required.
              </p>
              <a
                href="https://essentials.availity.com/static/public/onb/onboarding-ui-apps/availity-fr-ui/#/login"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
              >
                Register or log in to Availity Essentials →
              </a>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={() => setStep(1)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-3 rounded-xl hover:border-[#7A8F79] transition font-semibold">
              Back
            </button>
            <button type="button" onClick={() => setStep(3)} className="flex-1 bg-[#2F3E4E] text-white py-3 rounded-xl hover:bg-[#7A8F79] transition font-semibold">
              Continue
            </button>
          </div>
        </StepCard>
      )}

      {/* Step 3 — Duration */}
      {!optedOutConfirm && step === 3 && (
        <StepCard>
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-2">Step 3 of 4</p>
          <Question text="How long would you like billing services to continue?" />
          <div className="space-y-3">
            <ChoiceButton
              label="Full year — ongoing"
              sub="Billing continues for the full plan year & will adjust to the lower rate if plan maximums warrant no longer being required to bill a carrier."
              selected={answers.billingDurationType === 'full_year'}
              onClick={() => set({ billingDurationType: 'full_year', billingDurationNote: '' })}
            />
            <ChoiceButton
              label="Policy-specific duration"
              sub="Example: only needing BCBS billing for the first 100 days, or through a specific end date. Provider will take over their billing again once duration reached."
              selected={answers.billingDurationType === 'policy_specific'}
              onClick={() => set({ billingDurationType: 'policy_specific' })}
            />
          </div>

          {answers.billingDurationType === 'policy_specific' && (
            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">
                Please describe the duration or conditions
              </label>
              <textarea
                rows={3}
                value={answers.billingDurationNote}
                onChange={e => set({ billingDurationNote: e.target.value })}
                placeholder="e.g. First 100 days of Blue Cross coverage only"
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none"
              />
            </div>
          )}

          <div className="mt-5 p-4 bg-[#F4F6F5] rounded-lg text-xs text-[#7A8F79] leading-relaxed">
            There is no minimum enrollment obligation. You are free to make changes to the plan or discontinue services at any time by navigating to <i>Billing Update</i> under your <i>my</i>Profile area, or submitting a request to <a href='mailto:support@cominghomecare.com' className="text-[#2F3E4E] underline">Coming Home Support</a> and we'll update your profile.
          </div>
          

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={() => setStep(2)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-3 rounded-xl hover:border-[#7A8F79] transition font-semibold">
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              disabled={!answers.billingDurationType || (answers.billingDurationType === 'policy_specific' && !answers.billingDurationNote.trim())}
              className="flex-1 bg-[#2F3E4E] text-white py-3 rounded-xl hover:bg-[#7A8F79] transition font-semibold disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </StepCard>
      )}

      {/* Step 4 — Billing Agreement Modal */}
      {!optedOutConfirm && step === 4 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">

            {/* Modal header */}
            <div className="bg-[#1c2433] rounded-t-2xl px-6 py-5 flex items-center justify-between shrink-0">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-0.5">Step 4 of 4</p>
                <h2 className="text-lg font-bold text-white">Medical Claim Billing Service Agreement</h2>
                <p className="text-xs text-white/50 mt-0.5">Coming Home Care Services, LLC · Provider Portal</p>
              </div>
            </div>

            {/* Scrollable agreement body */}
            <div className="overflow-y-auto flex-1 px-6 py-6 text-sm text-[#2F3E4E] space-y-5">

              <p className="text-xs text-[#7A8F79] leading-relaxed border-b border-[#D9E1E8] pb-4">
                Billing services are provided by <strong>Coming Home Care Services LLC</strong> based on the selected billing plan and volume of claims submitted.
              </p>

              {/* Plans */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3">Weekly Billing Memberships by Date of Service (DOS) Volume</p>
                <p className="text-xs text-[#7A8F79] mb-3 leading-relaxed">
                  Plans are flexible. If you add/drop a case that changes your billing needs, email <strong className="text-[#2F3E4E]">billing@cominghomecare.com</strong> and we can adjust the plan to fit your needs.<br/>
                  All plans include a 2-week preview of <span className="italic text-[#7A8F79]">my</span><strong>Portal</strong> Basic access.
                </p>
                <div className="rounded-xl overflow-hidden border border-[#D9E1E8] mb-2">
                  {[
                    { code: '#M1', name: 'The Side-Gig',    rate: '$5/week',  dos: '1–2 dates of service' },
                    { code: '#M2', name: 'The Full-Timer',  rate: '$10/week', dos: '3–5 dates of service' },
                    { code: '#M3', name: 'The Work-a-Holic',rate: '$15/week', dos: 'Up to 7 dates of service' },
                  ].map((p, i, a) => (
                    <div key={p.code} className={`flex items-center px-4 py-3 gap-4 ${i < a.length - 1 ? 'border-b border-[#D9E1E8]' : ''}`}>
                      <span className="text-xs font-bold text-[#2F3E4E] w-8 shrink-0">{p.code}</span>
                      <span className="text-xs text-[#7A8F79] italic flex-1">{p.name}</span>
                      <span className="text-xs font-bold text-[#2F3E4E] w-16 text-right shrink-0">{p.rate}</span>
                      <span className="text-xs text-[#7A8F79] text-right shrink-0">{p.dos}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-[#7A8F79] italic">*Each additional DOS submitted above the enrolled plan max will incur a fee of $2.</p>
                <p className="text-xs text-[#4a5568] mt-2 leading-relaxed">
                  Claims are grouped according to the New York State Medicaid billing cycle (Thursday–Wednesday). Fees are calculated based on the number of dates of service within each billing cycle, not based on upload timing.
                </p>
              </div>

              {/* Invoicing */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2">Invoicing &amp; Payment Terms</p>
                <p className="text-xs text-[#4a5568] leading-relaxed mb-1">Invoices are issued on a biweekly to monthly basis depending on claim volume, and sent to the email address on file. Payment is due within <strong>30 days</strong> of the invoice date.</p>
                <ul className="text-xs text-[#4a5568] list-disc list-inside space-y-1 leading-relaxed">
                  <li>Balances unpaid after 30 days may incur a <strong>15% late fee</strong>.</li>
                  <li>Balances unpaid after 60 days may incur a <strong>20% late fee</strong>.</li>
                  <li>Balances unpaid 90 days or more may incur a <strong>22% late fee</strong> per additional month.</li>
                  <li>Services may be paused at any time for overdue balances.</li>
                </ul>
              </div>

              {/* Submission Deadlines */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2">Submission Deadlines</p>
                <ul className="text-xs text-[#4a5568] list-disc list-inside space-y-1 leading-relaxed">
                  <li>Dates of service submitted by <strong>Monday at 11:59 PM</strong> will be included in the current billing cycle when possible.</li>
                  <li>Urgent requests made after the deadline may incur a <strong>$10 same-day service fee</strong>. Expedited requests must be confirmed directly via phone or text.</li>
                </ul>
              </div>

              {/* Corrections */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2">Corrections &amp; Adjustments</p>
                <ul className="text-xs text-[#4a5568] list-disc list-inside space-y-1 leading-relaxed">
                  <li>Corrections due to billing errors will be completed at <strong>no cost</strong>.</li>
                  <li>Corrections from inaccurate provider-supplied information will incur a <strong>$3 fee per occurrence</strong> for void &amp; reprocessing.</li>
                </ul>
              </div>

              {/* Provider Responsibility */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2">Provider Responsibility</p>
                <p className="text-xs text-[#4a5568] leading-relaxed">The provider is responsible for ensuring that all submitted information is accurate and complete. Coming Home Care Services, LLC is not responsible for claim delays or denials resulting from incorrect or incomplete information provided.</p>
              </div>

              {/* Rate Changes */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2">Rate Changes</p>
                <p className="text-xs text-[#4a5568] leading-relaxed">All rates are subject to change with prior notice. Any increase to service fees will be given a <strong>30-day notice</strong>. Any reductions in service fees will take place immediately. By using billing services, the provider agrees to the terms outlined above.</p>
              </div>

            </div>

            {/* Signature footer — pinned to bottom */}
            <div className="border-t border-[#D9E1E8] px-6 py-5 bg-[#f9fafb] rounded-b-2xl shrink-0">
              <p className="text-xs font-semibold text-[#2F3E4E] mb-1">Your Initials</p>
              <p className="text-xs text-[#7A8F79] mb-3">By entering your initials and clicking Sign &amp; Enroll, you confirm you have read and agree to all terms above. A signed copy will be saved to your account documents.</p>
              <div className="flex items-end gap-4 mb-4">
                <div className="flex-1 max-w-[160px]">
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Initials</label>
                  <input
                    type="text"
                    value={answers.signature}
                    onChange={e => set({ signature: e.target.value.replace(/[^a-zA-Z.]/g, '').slice(0, 5) })}
                    placeholder="e.g. J.B."
                    maxLength={5}
                    className="w-full border-2 border-[#D9E1E8] px-3 py-2 rounded-lg text-xl font-bold text-[#2F3E4E] tracking-widest focus:outline-none focus:border-[#7A8F79] uppercase"
                  />
                </div>
                {answers.signature && (
                  <p className="text-xs text-[#7A8F79] pb-2">Signing as <strong className="text-[#2F3E4E]">{answers.signature.toUpperCase()}</strong></p>
                )}
              </div>
              {error && <p className="text-xs text-red-600 font-medium mb-3">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(3)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2.5 rounded-xl hover:border-[#7A8F79] transition font-semibold text-sm">
                  Back
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!answers.signature.trim() || submitting}
                  className="flex-1 bg-[#2F3E4E] text-white py-2.5 rounded-xl hover:bg-[#7A8F79] transition font-semibold text-sm disabled:opacity-40"
                >
                  {submitting ? 'Saving…' : 'Sign & Enroll'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
