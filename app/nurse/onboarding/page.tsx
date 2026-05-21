'use client'

import { useState, useEffect } from 'react'
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

type EnrollmentInfo = {
  firstName: string
  lastName: string
  dob: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
  npiNumber: string
  etin: string
  epacesUserId: string
  ssn: string
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
  const [enrollInfo, setEnrollInfo] = useState<EnrollmentInfo>({
    firstName: '',
    lastName: '',
    dob: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    npiNumber: '',
    etin: '',
    epacesUserId: '',
    ssn: '',
  })

  const set = (patch: Partial<Answers>) => setAnswers(a => ({ ...a, ...patch }))
  const setInfo = (patch: Partial<EnrollmentInfo>) => setEnrollInfo(a => ({ ...a, ...patch }))
  const selectedPlan = derivePlan(answers.termType, answers.carrierType)
  const totalSteps = answers.enrolledInBilling === false ? 1 : 5
  const isCommercial = answers.carrierType === 'commercial' || answers.carrierType === 'dual'

  // Pre-fill enrollment info from existing profile
  useEffect(() => {
    fetch('/api/nurse/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(({ profile }) => {
        if (!profile) return
        setEnrollInfo(prev => ({
          ...prev,
          firstName:    profile.firstName    || '',
          lastName:     profile.lastName     || '',
          dob:          profile.dob          || '',
          address:      profile.address      || '',
          city:         profile.city         || '',
          state:        profile.state        || '',
          zip:          profile.zip          || '',
          phone:        profile.phone        || '',
          npiNumber:    profile.npiNumber    || '',
          etin:         profile.etin         || '',
          epacesUserId: profile.epacesUserId || '',
        }))
      })
      .catch(() => {})
  }, [])

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

  // Step 4: sign billing agreement → advance to step 5
  async function signAgreement() {
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

    setSubmitting(false)
    setStep(5)
  }

  // Step 5: save profile data, generate remittance form, complete onboarding
  async function submitEnrollmentInfo() {
    setSubmitting(true); setError('')

    // Save profile fields (etin, epacesUserId, and any updated personal info)
    const profileRes = await fetch('/api/nurse/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        firstName:    enrollInfo.firstName,
        lastName:     enrollInfo.lastName,
        dob:          enrollInfo.dob,
        address:      enrollInfo.address,
        city:         enrollInfo.city,
        state:        enrollInfo.state,
        zip:          enrollInfo.zip,
        phone:        enrollInfo.phone,
        npiNumber:    enrollInfo.npiNumber,
        etin:         enrollInfo.etin,
        epacesUserId: enrollInfo.epacesUserId,
        ...(isCommercial && enrollInfo.ssn ? { ssn: enrollInfo.ssn } : {}),
      }),
    })
    if (!profileRes.ok) {
      setError('Failed to save provider information. Please try again.')
      setSubmitting(false)
      return
    }

    // Generate and download the remittance form
    try {
      const pdfRes = await fetch('/api/nurse/remittance-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(enrollInfo),
      })
      if (pdfRes.ok) {
        const blob = await pdfRes.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'Electronic_Remittance_Enrollment.pdf'
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // Non-fatal — continue even if PDF fails
    }

    // Complete onboarding
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

  const step5RequiredFilled =
    enrollInfo.firstName.trim() &&
    enrollInfo.lastName.trim() &&
    enrollInfo.dob.trim() &&
    enrollInfo.address.trim() &&
    enrollInfo.npiNumber.trim() &&
    enrollInfo.etin.trim() &&
    enrollInfo.epacesUserId.trim() &&
    enrollInfo.phone.trim() &&
    (!isCommercial || enrollInfo.ssn.trim())

  return (
    <div className="min-h-screen bg-[#D9E1E8] flex flex-col items-center pt-8 pb-12 px-6">

      {/* Welcome banner — first-time landing, step 1 only */}
      {!optedOutConfirm && step === 1 && (
        <div className="w-full max-w-xl mb-5 rounded-2xl overflow-hidden shadow-md">
          <div
            className="px-6 pt-6 pb-5"
            style={{ background: 'linear-gradient(135deg, #2F3E4E 0%, #3a4f61 100%)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A8F79] mb-2">
              Coming Home Care Services
            </p>
            <h2 className="text-2xl font-bold text-white leading-snug">
              Welcome to your <span className="italic text-[#7A8F79]">my</span>Provider Portal
            </h2>
            <p className="text-sm text-white/65 mt-2 leading-relaxed">
              We&apos;re glad to have you. This short setup connects your provider account to our billing
              services — it only takes a minute and you can update your preferences at any time.
            </p>
          </div>
          <div
            className="px-6 py-3 border-t border-white/10"
            style={{ background: 'rgba(30,42,54,0.85)' }}
          >
            <p className="text-xs text-white/50">
              Questions? Reach us at{' '}
              <a
                href="mailto:enroll@cominghomecare.com"
                className="text-[#7A8F79] font-semibold hover:text-white transition"
              >
                enroll@cominghomecare.com
              </a>
            </p>
          </div>
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
              <strong className="text-[#2F3E4E]">&ldquo;Enroll in Services&rdquo;</strong> in your provider dashboard.
              There&apos;s no deadline — whenever you&apos;re ready, we&apos;re here.
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
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-2">Step 2 of 5</p>
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
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-2">Step 3 of 5</p>
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
                      {rate && (
                        <span className="flex items-center gap-1.5">
                          <strong className="text-[#2F3E4E]">{rate.dos}</strong>
                          {rate.weekMax && <span className="italic">{rate.weekMax}</span>}
                        </span>
                      )}
                      {type === 'dual' && (
                        <span className="text-[#7A8F79] text-[10px] font-bold italic">Once Primary Insurance benefit max is met, rate drops to <span className="text-[#2F3E4E] font-bold">$2 Medicaid</span> pricing.</span>
                      )}
                    </span>
                  }
                />
              )
            })}
          </div>

          <NavRow onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={!answers.carrierType} />
        </StepCard>
      )}

      {/* Progress dots — below card */}
      {!optedOutConfirm && step < 4 && (
        <div className="flex gap-2 mt-5">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map(n => (
            <div key={n} className={`w-2.5 h-2.5 rounded-full transition-all ${step >= n ? 'bg-[#2F3E4E]' : 'bg-[#D9E1E8] border border-[#7A8F79]'}`} />
          ))}
        </div>
      )}

      {/* ── Step 4 — Agreement ── */}
      {!optedOutConfirm && step === 4 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">

            {/* Modal header */}
            <div className="bg-[#1c2433] rounded-t-2xl px-6 py-5 shrink-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-0.5">Step 4 of 5</p>
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
                    <strong> $4 credit</strong> applied to your next month&apos;s invoice.
                    Applies to invoices of <strong>$20.00 or more</strong>.
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

              {/* Records & EOB Authorization */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2">Records &amp; EOB Authorization</p>
                <p className="text-xs text-[#4a5568] leading-relaxed">
                  By enrolling in billing services, the provider authorizes Coming Home Care Services, LLC to
                  request and access Explanation of Benefits (EOB) documents, remittance advice, and related
                  claim records from payers and clearinghouses as necessary to fulfill contracted billing
                  services, resolve claim disputes, and reconcile payments on the provider&apos;s behalf.
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
                By entering your initials and clicking Sign &amp; Continue, you confirm you have read and agree to all terms above.
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
                <button type="button" onClick={signAgreement} disabled={!answers.signature.trim() || submitting}
                  className="flex-1 bg-[#2F3E4E] text-white py-2.5 rounded-xl hover:bg-[#7A8F79] transition font-semibold text-sm disabled:opacity-40">
                  {submitting ? 'Saving…' : 'Sign & Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5 — Provider Enrollment Information ── */}
      {!optedOutConfirm && step === 5 && (
        <div className="w-full max-w-xl space-y-0">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-1">Step 5 of 5</p>
            <h2 className="text-xl font-bold text-[#2F3E4E] mb-1 leading-snug">Provider Enrollment Information</h2>
            <p className="text-sm text-[#7A8F79] mb-6 leading-relaxed">
              This information will be used to complete your electronic remittance enrollment form.
              Fields pre-filled from your profile — update anything that needs correcting.
            </p>

            <div className="space-y-4">

              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">First Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={enrollInfo.firstName}
                    onChange={e => setInfo({ firstName: e.target.value })}
                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Last Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={enrollInfo.lastName}
                    onChange={e => setInfo({ lastName: e.target.value })}
                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  />
                </div>
              </div>

              {/* DOB + Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Date of Birth <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={enrollInfo.dob}
                    onChange={e => setInfo({ dob: e.target.value })}
                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Phone <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    value={enrollInfo.phone}
                    onChange={e => setInfo({ phone: e.target.value })}
                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">Street Address <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={enrollInfo.address}
                  onChange={e => setInfo({ address: e.target.value })}
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
              </div>

              {/* City / State / Zip */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">City</label>
                  <input
                    type="text"
                    value={enrollInfo.city}
                    onChange={e => setInfo({ city: e.target.value })}
                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">State</label>
                  <input
                    type="text"
                    value={enrollInfo.state}
                    maxLength={2}
                    onChange={e => setInfo({ state: e.target.value.toUpperCase() })}
                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] uppercase"
                  />
                </div>
              </div>

              {/* NPI */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">NPI Number <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={enrollInfo.npiNumber}
                  onChange={e => setInfo({ npiNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="10-digit NPI"
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] font-mono"
                />
              </div>

              {/* ETIN + ePaces User ID */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">
                    ETIN <span className="text-red-500">*</span>
                    <span className="ml-1 normal-case font-normal text-[#aab]">(3–4 chars)</span>
                  </label>
                  <input
                    type="text"
                    value={enrollInfo.etin}
                    onChange={e => setInfo({ etin: e.target.value.slice(0, 4) })}
                    placeholder="e.g. A1B"
                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">ePaces User ID <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={enrollInfo.epacesUserId}
                    onChange={e => setInfo({ epacesUserId: e.target.value })}
                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  />
                </div>
              </div>

              {/* SS# — commercial only */}
              {isCommercial && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1">
                    Social Security Number <span className="text-red-500">*</span>
                    <span className="ml-2 text-[10px] normal-case font-normal bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">
                      required for commercial billing · stored encrypted
                    </span>
                  </label>
                  <input
                    type="password"
                    value={enrollInfo.ssn}
                    onChange={e => setInfo({ ssn: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                    placeholder="9 digits, no dashes"
                    className="w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] font-mono"
                  />
                </div>
              )}

            </div>

            <div className="mt-5 p-4 bg-[#F4F6F5] rounded-lg text-xs text-[#7A8F79] leading-relaxed">
              After submitting, your data will be used to auto-fill the NYS Electronic Remittance enrollment form.
              The completed form will download automatically.
            </div>

            {error && <p className="text-xs text-red-600 font-medium mt-3">{error}</p>}

            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setStep(4)}
                className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-3 rounded-xl hover:border-[#7A8F79] transition font-semibold">
                Back
              </button>
              <button
                type="button"
                onClick={submitEnrollmentInfo}
                disabled={!step5RequiredFilled || submitting}
                className="flex-1 bg-[#2F3E4E] text-white py-3 rounded-xl hover:bg-[#7A8F79] transition font-semibold disabled:opacity-40"
              >
                {submitting ? 'Completing enrollment…' : 'Complete Enrollment'}
              </button>
            </div>
          </div>

          {/* Progress dots for step 5 */}
          <div className="flex gap-2 mt-5 justify-center">
            {Array.from({ length: 5 }, (_, i) => i + 1).map(n => (
              <div key={n} className={`w-2.5 h-2.5 rounded-full transition-all ${5 >= n ? 'bg-[#2F3E4E]' : 'bg-[#D9E1E8] border border-[#7A8F79]'}`} />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
