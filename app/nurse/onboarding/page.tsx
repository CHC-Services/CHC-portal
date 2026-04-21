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
  const [optedOutConfirm, setOptedOutConfirm] = useState(false)
  const [answers, setAnswers] = useState<Answers>({
    enrolledInBilling: null,
    carrierCount: 1,
    billingDurationType: null,
    billingDurationNote: '',
    signature: '',
  })

  const set = (patch: Partial<Answers>) => setAnswers(a => ({ ...a, ...patch }))

  // Suggested plan label
  const planLabel =
    answers.carrierCount === 1 ? 'Plan A1 or A2 — Single Payer ($2–$3/date of service)' :
    answers.carrierCount === 2 ? 'Plan B — Dual Payer ($4/date of service)' :
    'Custom Multi-Carrier — we\'ll discuss your rate'

  // Auto-generate agreement text from answers
  const agreementSummary = `
I, the undersigned, agree to engage Coming Home Care billing services under the following terms:

Carrier Coverage: I am enrolling for billing across ${answers.carrierCount === 1 ? '1 insurance carrier' : answers.carrierCount === 2 ? '2 insurance carriers (dual payer)' : `${answers.carrierCount} insurance carriers`}.

Suggested Plan: ${planLabel}.

Billing Duration: ${
    answers.billingDurationType === 'full_year'
      ? 'I am requesting billing services on a full-year, ongoing basis.'
      : `I am requesting billing services for the following specific policy duration: ${answers.billingDurationNote || '(see notes)'}.`
  }

Modifications & Cancellation: I understand that I may cancel this agreement or request changes to the number of carriers billed or the billing duration at any time by contacting Coming Home Care directly. Changes will take effect upon confirmation.

Billing will be invoiced monthly for transparency. All services qualify as tax-deductible business expenses at year end. Accepted payment methods include Venmo, Zelle, Apple Pay, ACH Bank Transfer, Personal Check, and Cash.

By typing my full legal name below, I acknowledge that I have read and agree to these terms. This constitutes a legally binding electronic signature.
`.trim()

  async function submit() {
    setSubmitting(true)
    const res = await fetch('/api/nurse/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(answers),
    })
    if (res.ok) {
      router.push('/nurse')
    } else {
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
              subNode={<>Enroll in billing services at any time by clicking &lsquo;Start Enrollment&rsquo; in your <em>my</em><stong>Billing</stong> section, or by{' '}<a href="mailto:enroll@cominghomecare.com?subject=Billing%20Enrollment%20Request&body=Hi%20Coming%20Home%20Care%2C%0A%0AI%20would%20like%20to%20enroll%20in%20billing%20services.%0A%0AName%3A%20%0A%0AThank%20you." className="underline text-[#2F3E4E] hover:text-[#7A8F79]" onClick={e => e.stopPropagation()}>contacting us</a>.</>}
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

      {/* Step 4 — Review & Sign */}
      {!optedOutConfirm && step === 4 && (
        <StepCard>
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-2">Step 4 of 4 — Review & Sign</p>
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-xl font-bold text-[#2F3E4E]">Service Agreement</h2>
            <p className="text-xs text-[#7A8F79] italic">(scroll to bottom to review before continuing)</p>
          </div>

          <div className="bg-[#F4F6F5] rounded-lg p-4 text-sm text-[#2F3E4E] whitespace-pre-line leading-relaxed max-h-64 overflow-y-auto mb-6 border border-[#D9E1E8]">
            {agreementSummary}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">
              Type your full legal name to sign
            </label>
            <input
              type="text"
              value={answers.signature}
              onChange={e => set({ signature: e.target.value })}
              placeholder="Your full legal name"
              className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            />
            <p className="text-xs text-[#7A8F79] mt-1">
              By signing, you confirm you have read and agree to the terms above. 
              <p><b>Date:</b> {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={() => setStep(3)} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-3 rounded-xl hover:border-[#7A8F79] transition font-semibold">
              Back
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!answers.signature.trim() || submitting}
              className="flex-1 bg-[#2F3E4E] text-white py-3 rounded-xl hover:bg-[#7A8F79] transition font-semibold disabled:opacity-40"
            >
              {submitting ? 'Saving…' : 'Sign & Continue'}
            </button>
          </div>
        </StepCard>
      )}

    </div>
  )
}
