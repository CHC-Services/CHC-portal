'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type TermType = 'short_term' | 'long_term'
type CarrierType = 'commercial' | 'medicaid' | 'dual'

type Answers = {
  enrolledInBilling: boolean | null
  termType: TermType | null
  carrierType: CarrierType | null
  billingDurationNote: string
  signature: string
}

// ── Rates per plan ──────────────────────────────────────────────────────────
const RATES: Record<string, { dos: string; weekMax?: string }> = {
  'ST-COM':  { dos: '$4 per date of service' },
  'ST-MED':  { dos: '$3 per date of service' },
  'ST-DUAL': { dos: '$5 per date of service' },
  'LT-COM':  { dos: '$3 per date of service', weekMax: 'max $10 / week' },
  'LT-MED':  { dos: '$2 per date of service', weekMax: 'max $10 / week' },
  'LT-DUAL': { dos: '$4 per date of service', weekMax: 'max $15 / week' },
}

function derivePlan(termType: TermType | null, carrierType: CarrierType | null): string {
  if (!termType || !carrierType) return ''
  const prefix = termType === 'short_term' ? 'ST' : 'LT'
  const suffix = carrierType === 'commercial' ? 'COM' : carrierType === 'medicaid' ? 'MED' : 'DUAL'
  return `${prefix}-${suffix}`
}

// ── Shared UI components ────────────────────────────────────────────────────
function StepCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-xl shadow-sm p-8 max-w-xl w-full">{children}</div>
}

function Question({ text }: { text: string }) {
  return <h2 className="text-xl font-bold text-[#2F3E4E] mb-6 leading-snug">{text}</h2>
}

function ChoiceButton({ label, sub, subNode, selected, onClick }: {
  label: string; sub?: string; subNode?: React.ReactNode; selected: boolean; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border-2 transition ${selected ? 'border-[#7A8F79] bg-[#F4F6F5]' : 'border-[#D9E1E8] hover:border-[#7A8F79]'} text-[#2F3E4E]`}>
      <p className="font-semibold">{label}</p>
      {sub && <p className="text-sm text-[#7A8F79] mt-0.5">{sub}</p>}
      {subNode && <div className="text-sm text-[#7A8F79] mt-0.5">{subNode}</div>}
    </button>
  )
}

function NavRow({ onBack, onNext, nextDisabled, nextLabel = 'Continue' }: {
  onBack: () => void; onNext: () => void; nextDisabled?: boolean; nextLabel?: string
}) {
  return (
    <div className="flex gap-3 mt-6">
      <button type="button" onClick={onBack} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-3 rounded-xl hover:border-[#7A8F79] transition font-semibold">
        Back
      </button>
      <button type="button" onClick={onNext} disabled={nextDisabled}
        className="flex-1 bg-[#2F3E4E] text-white py-3 rounded-xl hover:bg-[#7A8F79] transition font-semibold disabled:opacity-40">
        {nextLabel}
      </button>
    </div>
  )
}

// ── Rate table shown in Step 3 and Agreement ────────────────────────────────
function RateTable({ selectedPlan }: { selectedPlan: string }) {
  const cell = (plan: string) => {
    const r = RATES[plan]
    const active = selectedPlan === plan
    return (
      <div className={`px-3 py-3 text-center border-r border-[#D9E1E8] last:border-r-0 ${active ? 'bg-[#7A8F79]/10' : ''}`}>
        <p className={`text-sm font-bold ${active ? 'text-[#2F3E4E]' : 'text-[#7A8F79]'}`}>{r?.dos ?? '—'}</p>
        {r?.weekMax && <p className="text-[10px] text-[#7A8F79] italic mt-0.5">{r.weekMax}</p>}
        {active && <p className="text-[9px] font-bold uppercase tracking-wide text-[#7A8F79] mt-1">Your Plan</p>}
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden border border-[#D9E1E8] text-xs">
      {/* Header */}
      <div className="grid grid-cols-4 bg-[#2F3E4E] text-white text-[10px] font-bold uppercase tracking-wide">
        <div className="px-3 py-2">Term</div>
        <div className="px-3 py-2 text-center">Commercial</div>
        <div className="px-3 py-2 text-center">Medicaid</div>
        <div className="px-3 py-2 text-center">Dual (Both)</div>
      </div>
      {/* Short-term row */}
      <div className={`grid grid-cols-4 border-b border-[#D9E1E8] ${selectedPlan.startsWith('ST') ? 'bg-[#f8faf8]' : ''}`}>
        <div className="px-3 py-3 border-r border-[#D9E1E8]">
          <p className="font-semibold text-[#2F3E4E]">Short-Term</p>
          <p className="text-[10px] text-[#7A8F79]">≤ 30 days</p>
        </div>
        {cell('ST-COM')}{cell('ST-MED')}{cell('ST-DUAL')}
      </div>
      {/* Long-term row */}
      <div className={`grid grid-cols-4 ${selectedPlan.startsWith('LT') ? 'bg-[#f8faf8]' : ''}`}>
        <div className="px-3 py-3 border-r border-[#D9E1E8]">
          <p className="font-semibold text-[#2F3E4E]">Long-Term</p>
          <p className="text-[10px] text-[#7A8F79]">Ongoing</p>
        </div>
        {cell('LT-COM')}{cell('LT-MED')}{cell('LT-DUAL')}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [optedOutConfirm, setOptedOutConfirm] = useState(false)
  const [answers, setAnswers] = useState<Answers>({
    enrolledInBilling: null,
    termType: null,
    carrierType: null,
    billingDurationNote: '',
    signature: '',
  })

  const set = (patch: Partial<Answers>) => setAnswers(a => ({ ...a, ...patch }))
  const selectedPlan = derivePlan(answers.termType, answers.carrierType)
  const totalSteps = answers.enrolledInBilling === false ? 1 : 4

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

  async function submit() {
    setSubmitting(true); setError('')

    const agreeRes = await fetch('/api/nurse/billing-agreement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        initials: answers.signature.trim().toUpperCase(),
        termType: answers.termType,
        carrierType: answers.carrierType,
      }),
    })
    if (!agreeRes.ok) {
      const data = await agreeRes.json()
      setError(data.error || 'Failed to save agreement. Please try again.')
      setSubmitting(false)
      return
    }

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

  return (
    <div className="min-h-screen bg-[#D9E1E8] flex flex-col items-center justify-center p-6">

      {/* Progress dots */}
      {!optedOutConfirm && (
        <div className="flex gap-2 mb-6">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map(n => (
            <div key={n} className={`w-2.5 h-2.5 rounded-full transition-all ${step >= n ? 'bg-[#2F3E4E]' : 'bg-[#D9E1E8] border border-[#7A8F79]'}`} />
          ))}
        </div>
      )}

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
              You can enroll in billing services at any time by clicking{' '}
              <strong className="text-[#2F3E4E]">"Enroll in Services"</strong> in your provider dashboard.
              There's no deadline — whenever you're ready, we're here.
            </p>
            <button onClick={() => router.push('/nurse')}
              className="w-full bg-[#2F3E4E] text-white py-3 rounded-xl hover:bg-[#7A8F79] transition font-semibold">
              Go to My Dashboard
            </button>
          </div>
        </StepCard>
      )}

      {/* ── Step 1 — Enroll? ── */}
      {!optedOutConfirm && step === 1 && (
        <StepCard>
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-2">Step 1 of {totalSteps}</p>
          <Question text="Would you like to enroll in billing services through Coming Home Care?" />
          <div className="space-y-3">
            <ChoiceButton
              label="Yes — begin my enrollment"
              sub="A short questionnaire and service agreement will follow. You may unenroll or change plans at any time."
              selected={answers.enrolledInBilling === true}
              onClick={() => set({ enrolledInBilling: true })}
            />
            <ChoiceButton
              label="No — I'll manage my own billing"
              subNode={
                <>Enroll at any time by clicking &lsquo;Start Enrollment&rsquo; in your profile, or by{' '}
                  <a href="mailto:enroll@cominghomecare.com?subject=Billing%20Enrollment%20Request"
                    className="underline text-[#2F3E4E] hover:text-[#7A8F79]" onClick={e => e.stopPropagation()}>
                    contacting us
                  </a>.</>
              }
              selected={answers.enrolledInBilling === false}
              onClick={() => set({ enrolledInBilling: false })}
            />
          </div>
          <button
            type="button"
            disabled={answers.enrolledInBilling === null || submitting}
            onClick={() => answers.enrolledInBilling ? setStep(2) : skipBilling()}
            className="mt-6 w-full bg-[#2F3E4E] text-white py-3 rounded-xl hover:bg-[#7A8F79] transition font-semibold disabled:opacity-40"
          >
            {answers.enrolledInBilling === false ? (submitting ? 'Saving…' : 'Continue to Dashboard') : 'Continue'}
          </button>
        </StepCard>
      )}

      {/* ── Step 2 — Short-term or Long-term ── */}
      {!optedOutConfirm && step === 2 && (
        <StepCard>
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-2">Step 2 of 4</p>
          <Question text="How long will you need billing services?" />
          <div className="space-y-3">
            <ChoiceButton
              label="Short-Term — 30 days or less"
              sub="For a limited, time-specific billing need. Ideal for a single patient case, a coverage gap, or a one-time event. You may extend to long-term at any time."
              selected={answers.termType === 'short_term'}
              onClick={() => set({ termType: 'short_term', billingDurationNote: '' })}
            />
            <ChoiceButton
              label="Long-Term — ongoing"
              sub="For continuous billing support with no defined end date. Includes a weekly cap on charges regardless of DOS volume."
              selected={answers.termType === 'long_term'}
              onClick={() => set({ termType: 'long_term', billingDurationNote: '' })}
            />
          </div>

          {answers.termType === 'short_term' && (
            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">
                Please describe the duration or specific event <span className="normal-case font-normal text-[#aab]">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={answers.billingDurationNote}
                onChange={e => set({ billingDurationNote: e.target.value })}
                placeholder="e.g. First 100 days of Blue Cross coverage only"
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none text-sm"
              />
            </div>
          )}

          <div className="mt-4 p-4 bg-[#F4F6F5] rounded-lg text-xs text-[#7A8F79] leading-relaxed">
            There is no minimum enrollment obligation. You may make changes or discontinue services at any time
            from your profile or by contacting{' '}
            <a href="mailto:support@cominghomecare.com" className="text-[#2F3E4E] underline">Coming Home Support</a>.
          </div>

          <NavRow onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!answers.termType} />
        </StepCard>
      )}

      {/* ── Step 3 — Carrier type ── */}
      {!optedOutConfirm && step === 3 && (
        <StepCard>
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-2">Step 3 of 4</p>
          <Question text="Which insurance carrier(s) will need to be billed?" />
          <div className="space-y-3 mb-5">
            {([
              { type: 'commercial' as CarrierType, label: 'Commercial only', sub: 'BCBS, Aetna, United, etc.' },
              { type: 'medicaid'   as CarrierType, label: 'Medicaid only',   sub: 'New York State Medicaid / Managed Medicaid' },
              { type: 'dual'      as CarrierType, label: 'Both — Dual Payer', sub: 'Primary commercial + Medicaid as secondary' },
            ]).map(({ type, label, sub }) => {
              const plan = derivePlan(answers.termType, type)
              const rate = RATES[plan]
              return (
                <ChoiceButton
                  key={type}
                  label={label}
                  selected={answers.carrierType === type}
                  onClick={() => set({ carrierType: type })}
                  subNode={
                    <span className="flex flex-col gap-0.5 mt-0.5">
                      <span>{sub}</span>
                      {rate && <strong className="text-[#2F3E4E]">{rate.dos}</strong>}
                      {rate?.weekMax && <span className="italic">{rate.weekMax}</span>}
                    </span>
                  }
                />
              )
            })}
          </div>

          {/* Availity callout for any plan including commercial */}
          {(answers.carrierType === 'commercial' || answers.carrierType === 'dual') && (
            <div className="mb-1 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm space-y-1.5">
              <p className="font-semibold text-[#2F3E4E]">Don't have a clearinghouse yet?</p>
              <p className="text-xs text-[#7A8F79] leading-relaxed">
                Submitting commercial claims electronically requires a clearinghouse or compatible billing software.
                <strong className="text-[#2F3E4E]"> Availity Essentials</strong> is a free option used widely by NY home care providers.
              </p>
              <a href="https://essentials.availity.com/static/public/onb/onboarding-ui-apps/availity-fr-ui/#/login"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition">
                Register or log in to Availity Essentials →
              </a>
            </div>
          )}

          <NavRow onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={!answers.carrierType} />
        </StepCard>
      )}

      {/* ── Step 4 — Agreement ── */}
      {!optedOutConfirm && step === 4 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">

            {/* Modal header */}
            <div className="bg-[#1c2433] rounded-t-2xl px-6 py-5 shrink-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-0.5">Step 4 of 4</p>
              <h2 className="text-lg font-bold text-white">Medical Claim Billing Service Agreement</h2>
              <p className="text-xs text-white/50 mt-0.5">Coming Home Care Services, LLC · Provider Portal</p>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-6 text-sm text-[#2F3E4E] space-y-5">

              <p className="text-xs text-[#7A8F79] leading-relaxed border-b border-[#D9E1E8] pb-4">
                Billing services are provided by <strong>Coming Home Care Services LLC</strong> based on the selected plan
                and the volume of claims submitted each billing cycle.
              </p>

              {/* Your selected plan callout */}
              {selectedPlan && (
                <div className="bg-[#2F3E4E] text-white rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] mb-0.5">Your Selected Plan</p>
                  <p className="text-sm font-bold">{RATES[selectedPlan]?.dos}</p>
                  {RATES[selectedPlan]?.weekMax && <p className="text-xs text-white/60 mt-0.5">{RATES[selectedPlan].weekMax}</p>}
                  <p className="text-[10px] text-white/50 mt-1">
                    {answers.termType === 'short_term' ? 'Short-Term' : 'Long-Term'} ·{' '}
                    {answers.carrierType === 'commercial' ? 'Commercial' : answers.carrierType === 'medicaid' ? 'Medicaid' : 'Dual Payer'}
                    {answers.billingDurationNote && ` — ${answers.billingDurationNote}`}
                  </p>
                </div>
              )}

              {/* Full rate table */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2">Full Rate Schedule</p>
                <p className="text-xs text-[#7A8F79] mb-3 leading-relaxed">
                  Claims are grouped by the NY State Medicaid billing cycle (Thursday–Wednesday). Plans are flexible —
                  email <strong className="text-[#2F3E4E]">billing@cominghomecare.com</strong> if your needs change.
                </p>
                <RateTable selectedPlan={selectedPlan} />
              </div>

              {/* Invoicing & Late Fees */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2">Invoicing &amp; Payment Terms</p>
                <p className="text-xs text-[#4a5568] leading-relaxed mb-2">
                  Invoices are issued biweekly to monthly depending on claim volume, sent to the email on file.
                  Payment is due within <strong>30 days</strong> of the invoice date.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 mb-3">
                  <p className="text-xs font-bold text-green-800">Early Payment Credit</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    Pay your invoice in full within <strong>7 days</strong> of the invoice date and receive a
                    <strong> $4 credit</strong> applied to your next month's invoice.
                  </p>
                </div>
                <ul className="text-xs text-[#4a5568] list-disc list-inside space-y-1 leading-relaxed">
                  <li>Balances unpaid after 30 days may incur a <strong>15% late fee</strong>.</li>
                  <li>Balances unpaid after 60 days may incur a <strong>20% late fee</strong>.</li>
                  <li>Balances unpaid 90+ days may incur a <strong>22% late fee</strong> per additional month.</li>
                  <li>Services may be paused at any time for overdue balances.</li>
                </ul>
              </div>

              {/* Submission Deadlines */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2">Submission Deadlines</p>
                <ul className="text-xs text-[#4a5568] list-disc list-inside space-y-1 leading-relaxed">
                  <li>DOS submitted by <strong>Monday at 11:59 PM</strong> will be included in the current billing cycle when possible.</li>
                  <li>Urgent after-deadline requests may incur a <strong>$10 same-day service fee</strong> and must be confirmed by phone or text.</li>
                </ul>
              </div>

              {/* Corrections */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2">Corrections &amp; Adjustments</p>
                <ul className="text-xs text-[#4a5568] list-disc list-inside space-y-1 leading-relaxed">
                  <li>Corrections due to billing errors are completed at <strong>no cost</strong>.</li>
                  <li>Corrections from inaccurate provider-supplied information incur a <strong>$3 fee per occurrence</strong> for void &amp; reprocessing.</li>
                </ul>
              </div>

              {/* Provider Responsibility */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2">Provider Responsibility</p>
                <p className="text-xs text-[#4a5568] leading-relaxed">
                  The provider is responsible for ensuring all submitted information is accurate and complete.
                  Coming Home Care Services, LLC is not responsible for claim delays or denials resulting from
                  incorrect or incomplete information provided.
                </p>
              </div>

              {/* Rate Changes */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2">Rate Changes</p>
                <p className="text-xs text-[#4a5568] leading-relaxed">
                  All rates are subject to change with prior notice. Any increase to service fees will be communicated
                  with a <strong>30-day notice</strong>. Reductions take effect immediately. Continued use of
                  billing services constitutes acceptance of the current terms.
                </p>
              </div>

            </div>

            {/* Signature footer */}
            <div className="border-t border-[#D9E1E8] px-6 py-5 bg-[#f9fafb] rounded-b-2xl shrink-0">
              <p className="text-xs font-semibold text-[#2F3E4E] mb-1">Your Initials</p>
              <p className="text-xs text-[#7A8F79] mb-3">
                By entering your initials and clicking Sign &amp; Enroll, you confirm you have read and agree to all terms above.
                A signed copy will be saved to your account documents.
              </p>
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
                <button type="button" onClick={() => setStep(3)}
                  className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2.5 rounded-xl hover:border-[#7A8F79] transition font-semibold text-sm">
                  Back
                </button>
                <button type="button" onClick={submit} disabled={!answers.signature.trim() || submitting}
                  className="flex-1 bg-[#2F3E4E] text-white py-2.5 rounded-xl hover:bg-[#7A8F79] transition font-semibold text-sm disabled:opacity-40">
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
