'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { fmtPhoneInput } from '../../../lib/formatPhone'
import DateInput from '../../components/DateInput'
import { US_STATES } from '../../components/patient/types'
import { GUARDIAN_RELATIONSHIPS } from '../../../lib/guardianRelationship'

type SearchMatch = {
  id: string
  accountNumber: string
  firstName: string
  lastName: string
  dob: string
  insuranceType: string
  insuranceId: string
  address: string | null
  city: string | null
  state: string | null
  matchToken: string
}

type Step = 'search' | 'found' | 'notfound' | 'newform' | 'done'

function fmtDob(dob: string) {
  if (!dob) return ''
  const [y, m, d] = dob.split('-')
  if (!y || !m || !d) return dob
  return `${m}/${d}/${y}`
}

const inp = 'w-full border border-[#D9E1E8] p-2.5 rounded-lg text-sm text-[#2F3E4E] placeholder:text-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'
const lbl = 'block text-xs font-semibold uppercase tracking-wide text-[#2F3E4E] mb-1'

export default function LinkPatientPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('search')
  const [error, setError] = useState('')
  const [linking, setLinking] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pendingResult, setPendingResult] = useState(false)

  // Step 1 — search fields (exact match only, per HIPAA — no autocomplete)
  const [srchLast, setSrchLast] = useState('')
  const [srchDob, setSrchDob] = useState('')
  const [srchInsType, setSrchInsType] = useState<'Medicaid' | 'Commercial'>('Medicaid')
  const [srchInsId, setSrchInsId] = useState('')
  const [matches, setMatches] = useState<SearchMatch[]>([])
  const [relationship, setRelationship] = useState('')

  // Step 2b — new patient form (demographics only; dx codes/PA/meds left for admin/nurse)
  const [firstName, setFirstName] = useState('')
  const [gender, setGender] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [phone, setPhone] = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/family/patients/search-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ lastName: srchLast, dob: srchDob, insuranceId: srchInsId }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Search failed'); return }
    if (data.matches?.length > 0) {
      setMatches(data.matches)
      setStep('found')
    } else {
      setStep('notfound')
    }
  }

  async function handleLink(matchToken: string) {
    setLinking(true); setError('')
    const res = await fetch('/api/family/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ matchToken, relationship: relationship || null }),
    })
    const data = await res.json()
    setLinking(false)
    if (res.ok) {
      setPendingResult(!!data.pending)
      setStep('done')
    } else {
      setError(data.error || 'Failed to link patient.')
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true); setError('')
    const res = await fetch('/api/family/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        relationship: relationship || null,
        patient: {
          firstName, lastName: srchLast, dob: srchDob,
          gender: gender || null,
          insuranceType: srchInsType, insuranceId: srchInsId,
          address, city, state, zip, phone,
        },
      }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      setPendingResult(false)
      setStep('done')
    } else {
      setError(data.error || 'Failed to create patient.')
    }
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] flex items-start justify-center pt-16 px-4 pb-16">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
        <div className="bg-[#2F3E4E] px-8 py-6">
          <Image src="/chc_logo.png" alt="CHC Logo" width={140} height={48} className="h-auto mb-4 brightness-0 invert" />
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-1">One more step</p>
          <h2 className="text-xl font-bold text-white leading-snug">
            {step === 'search' && 'Find Your Patient'}
            {step === 'found' && 'Match Found'}
            {step === 'notfound' && 'No Match Found'}
            {step === 'newform' && 'Patient Details'}
            {step === 'done' && 'All Set'}
          </h2>
        </div>

        <div className="px-8 py-6">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">{error}</p>}

          {step === 'search' && (
            <form onSubmit={handleSearch} className="space-y-4">
              <p className="text-sm text-[#4a5568] leading-relaxed">
                Enter the patient&apos;s exact details to check for an existing record before creating a new one.
              </p>
              <div className="flex gap-4">
                <div className="w-3/5">
                  <label className={lbl}>Patient Last Name</label>
                  <input required value={srchLast} onChange={e => setSrchLast(e.target.value)} className={inp} />
                </div>
                <div className="flex-1">
                  <label className={lbl}>Date of Birth</label>
                  <DateInput required value={srchDob} onChange={e => setSrchDob(e.target.value)} className={inp} />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-2/5">
                  <label className={lbl}>Insurance Type</label>
                  <select value={srchInsType} onChange={e => setSrchInsType(e.target.value as 'Medicaid' | 'Commercial')} className={inp}>
                    <option>Medicaid</option>
                    <option>Commercial</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className={lbl}>Medicaid / Insurance Member ID</label>
                  <input required value={srchInsId} onChange={e => setSrchInsId(e.target.value)} className={inp} />
                </div>
              </div>
              <div>
                <label className={lbl}>Your Relationship to the Patient (optional)</label>
                <select value={relationship} onChange={e => setRelationship(e.target.value)} className={inp}>
                  <option value="">— Select —</option>
                  {GUARDIAN_RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full bg-[#2F3E4E] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#7A8F79] transition">
                Search
              </button>
            </form>
          )}

          {step === 'found' && (
            <div>
              <p className="text-sm text-[#4a5568] mb-4 leading-relaxed">
                A matching patient was found. If this is correct, link your account to their record.
              </p>
              <div className="space-y-3">
                {matches.map(m => (
                  <div key={m.id} className="border border-[#D9E1E8] rounded-xl p-4">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-bold text-[#2F3E4E]">{m.firstName} {m.lastName}</p>
                      <span className="text-[10px] font-mono text-[#7A8F79] bg-[#F4F6F5] px-2 py-0.5 rounded-full">{m.accountNumber}</span>
                    </div>
                    <p className="text-xs text-[#7A8F79] mb-1">DOB: {fmtDob(m.dob)}</p>
                    <p className="text-xs text-[#7A8F79] mb-3">{m.insuranceType} — {m.insuranceId}</p>
                    <button
                      onClick={() => handleLink(m.matchToken)}
                      disabled={linking}
                      className="w-full bg-[#7A8F79] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#2F3E4E] transition disabled:opacity-50"
                    >
                      {linking ? 'Linking…' : 'Link to This Patient'}
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep('search')} className="mt-4 w-full border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-xl text-sm hover:bg-[#F4F6F5] transition">
                Search Again
              </button>
            </div>
          )}

          {step === 'notfound' && (
            <div className="text-center">
              <div className="bg-amber-50 border border-amber-400 rounded-xl p-4 mb-5">
                <p className="text-sm text-green-700 font-semibold">No existing record found.</p>
                <p className="text-xs text-[#2F3E4E] mt-1">Continue by entering the rest of the patient&apos;s details.</p>
              </div>
              <button onClick={() => setStep('newform')} className="w-full bg-[#2F3E4E] text-white py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition mb-3">
                Continue Adding New Patient
              </button>
              <button onClick={() => setStep('search')} className="w-full border border-[#2F3E4E] text-[#2F3E4E] py-2 rounded-xl text-sm hover:bg-[#F4F6F5] transition">
                Try a Different Search
              </button>
            </div>
          )}

          {step === 'newform' && (
            <form onSubmit={handleCreate} className="space-y-4">
              <p className="text-sm text-[#4a5568]">
                {srchLast}, DOB {fmtDob(srchDob)} — {srchInsType} {srchInsId}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>First Name</label>
                  <input required value={firstName} onChange={e => setFirstName(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Gender</label>
                  <select value={gender} onChange={e => setGender(e.target.value)} className={inp}>
                    <option value="">— Select —</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Phone Number</label>
                <input type="tel" placeholder="(555) 555-5555" value={phone} onChange={e => setPhone(fmtPhoneInput(e.target.value))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Address</label>
                <input value={address} onChange={e => setAddress(e.target.value)} className={inp} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className={lbl}>City</label>
                  <input value={city} onChange={e => setCity(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>State</label>
                  <select value={state} onChange={e => setState(e.target.value)} className={inp}>
                    <option value="">—</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Zip</label>
                  <input value={zip} onChange={e => setZip(e.target.value)} className={inp} />
                </div>
              </div>
              <button type="submit" disabled={creating} className="w-full bg-[#2F3E4E] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#7A8F79] transition disabled:opacity-50">
                {creating ? 'Saving…' : 'Create Patient & Continue'}
              </button>
              <button type="button" onClick={() => setStep('search')} className="w-full border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-xl text-sm hover:bg-[#F4F6F5] transition">
                Back
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center">
              {pendingResult ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                  <p className="text-sm font-semibold text-amber-800">Request submitted</p>
                  <p className="text-xs text-[#2F3E4E] mt-1">
                    Another caregiver already has access to this patient. They&apos;ve been notified and need to approve your request before you can view the patient&apos;s information.
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5">
                  <p className="text-sm font-semibold text-green-700">You&apos;re linked!</p>
                  <p className="text-xs text-[#2F3E4E] mt-1">You can now view this patient&apos;s information from your dashboard.</p>
                </div>
              )}
              <button onClick={() => router.push('/family')} className="w-full bg-[#2F3E4E] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#7A8F79] transition">
                Continue to myDashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
