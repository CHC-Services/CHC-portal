'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Patient = {
  linkId: string
  patientId: string
  overrides: Record<string, any> | null
  merged: PatientFields
}

type PatientFields = {
  accountNumber: string
  firstName: string
  lastName: string
  dob: string
  gender: string | null
  insuranceType: string
  insuranceId: string
  insuranceName: string | null
  insuranceGroup: string | null
  insurancePlan: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  highTech: boolean
  dxCode1: string | null
  dxCode2: string | null
  dxCode3: string | null
  dxCode4: string | null
  paNumber: string | null
  paStartDate: string | null
  paEndDate: string | null
  subscriberName: string | null
  subscriberRelation: string | null
  networkStatus: string | null
  hasCaseRate: boolean
  caseRateAmount: string | null
  policyNotes: string | null
}

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
}

function fmtDob(dob: string) {
  if (!dob) return ''
  const [y, m, d] = dob.split('-')
  if (!y || !m || !d) return dob
  return `${m}/${d}/${y}`
}

type Step = 'search' | 'found' | 'notfound' | 'newform'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const SUBSCRIBER_RELATIONS = ['Self', 'Spouse', 'Child', 'Parent', 'Other']

function blankNewPt() {
  return {
    firstName: '', lastName: '', dob: '', gender: '',
    insuranceId: '', insuranceName: '', insuranceGroup: '', insurancePlan: '',
    address: '', city: '', state: '', zip: '', phone: '',
    highTech: false,
    dxCode1: '', dxCode2: '', dxCode3: '', dxCode4: '',
    paNumber: '', paStartDate: '', paEndDate: '',
    subscriberName: '', subscriberRelation: '',
    networkStatus: '', hasCaseRate: false, caseRateAmount: '', policyNotes: '',
  }
}

export default function MyPatients() {
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [step, setStep] = useState<Step>('search')
  const [linking, setLinking] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Step 1 — search fields
  const [srchLast, setSrchLast] = useState('')
  const [srchDob, setSrchDob] = useState('')
  const [srchInsId, setSrchInsId] = useState('')
  const [matches, setMatches] = useState<SearchMatch[]>([])

  // Step 2b — new patient form
  const [insType, setInsType] = useState<'Medicaid' | 'Commercial'>('Medicaid')
  const [newPt, setNewPt] = useState(blankNewPt())

  function setPt(field: string, value: any) {
    setNewPt(p => ({ ...p, [field]: value }))
  }

  function loadPatients() {
    return fetch('/api/nurse/patients', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.patients)) setPatients(data.patients) })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch('/api/nurse/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (!data.profile?.portalAgreementSignedAt) { router.replace('/nurse/agreement'); return }
        if (!data.onboardingComplete) { router.replace('/nurse/onboarding'); return }
        loadPatients()
      })
  }, [router])

  function openModal() {
    setStep('search')
    setSrchLast(''); setSrchDob(''); setSrchInsId('')
    setMatches([])
    setNewPt(blankNewPt())
    setInsType('Medicaid')
    setError('')
    setShowModal(true)
  }

  function closeModal() { setShowModal(false) }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/nurse/patients/search', {
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
      setNewPt(p => ({ ...p, lastName: srchLast, dob: srchDob, insuranceId: srchInsId }))
      setStep('notfound')
    }
  }

  async function handleLink(patientId: string) {
    setLinking(true); setError('')
    const res = await fetch('/api/nurse/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ existingPatientId: patientId }),
    })
    setLinking(false)
    if (res.ok) { await loadPatients(); closeModal() }
    else setError('Failed to link patient.')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true); setError('')
    const res = await fetch('/api/nurse/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ patient: { ...newPt, insuranceType: insType } }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) { await loadPatients(); closeModal() }
    else setError(data.error || 'Failed to create patient.')
  }

  const filtered = patients.filter(p => {
    const q = search.toLowerCase()
    return (
      p.merged.firstName.toLowerCase().includes(q) ||
      p.merged.lastName.toLowerCase().includes(q) ||
      p.merged.accountNumber.toLowerCase().includes(q) ||
      (p.merged.insuranceId || '').toLowerCase().includes(q)
    )
  })

  // ── Shared input class ──────────────────────────────────────────────────
  const inp = 'w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'
  const lbl = 'block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1'

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">my</span>Patient Details
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">Manage your linked patients and their information.</p>
      </div>

      {/* Search bar + Add button */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Search by name, account # or insurance ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-[#D9E1E8] bg-white rounded-xl px-4 py-2.5 text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
        />
        <button
          onClick={openModal}
          className="bg-[#2F3E4E] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition whitespace-nowrap"
        >
          + Add Patient
        </button>
      </div>

      {/* Patient cards */}
      {loading ? (
        <p className="text-sm text-[#7A8F79]">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-[#7A8F79] italic text-sm">
            {search ? 'No patients match your search.' : 'No patients linked yet. Click "+ Add Patient" to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => (
            <div key={p.patientId} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between mb-1">
                <p className="text-base font-bold text-[#2F3E4E]">{p.merged.firstName} {p.merged.lastName}</p>
                <span className="text-[10px] font-mono font-semibold text-[#7A8F79] bg-[#F4F6F5] px-2 py-0.5 rounded-full">{p.merged.accountNumber}</span>
              </div>
              <p className="text-xs text-[#7A8F79] mb-3">DOB: {fmtDob(p.merged.dob)} {p.merged.gender ? `· ${p.merged.gender}` : ''}</p>
              <div className="space-y-1 text-xs text-[#2F3E4E]">
                <p><span className="text-[#7A8F79]">Insurance:</span> {p.merged.insuranceType} — {p.merged.insuranceId}</p>
                {p.merged.insuranceName && <p><span className="text-[#7A8F79]">Carrier:</span> {p.merged.insuranceName}</p>}
                {p.merged.paNumber && <p><span className="text-[#7A8F79]">PA #:</span> {p.merged.paNumber} ({p.merged.paStartDate}–{p.merged.paEndDate})</p>}
                {(p.merged.dxCode1 || p.merged.dxCode2 || p.merged.dxCode3 || p.merged.dxCode4) && (
                  <p><span className="text-[#7A8F79]">Dx:</span> {[p.merged.dxCode1, p.merged.dxCode2, p.merged.dxCode3, p.merged.dxCode4].filter(Boolean).join(', ')}</p>
                )}
                {p.merged.highTech && <p className="text-amber-600 font-semibold">High-Tech</p>}
                {p.merged.phone && <p><span className="text-[#7A8F79]">Phone:</span> {p.merged.phone}</p>}
                {p.merged.address && (
                  <p><span className="text-[#7A8F79]">Address:</span> {p.merged.address}{p.merged.city ? `, ${p.merged.city}` : ''}{p.merged.state ? `, ${p.merged.state}` : ''} {p.merged.zip || ''}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Patient Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#D9E1E8]">
              <h2 className="text-lg font-bold text-[#2F3E4E]">
                {step === 'search' && 'Find Patient'}
                {step === 'found' && 'Patient Found'}
                {step === 'notfound' && 'No Match Found'}
                {step === 'newform' && 'New Patient Record'}
              </h2>
              <button onClick={closeModal} className="text-[#7A8F79] hover:text-[#2F3E4E] transition text-xl leading-none">✕</button>
            </div>

            <div className="p-5">
              {error && <p className="text-red-500 text-sm mb-4 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              {/* Step 1: Search */}
              {step === 'search' && (
                <form onSubmit={handleSearch} className="space-y-4">
                  <p className="text-sm text-[#7A8F79]">Enter the patient's details to check if they already exist in the system before creating a new record.</p>
                  <div>
                    <label className={lbl}>Last Name</label>
                    <input required value={srchLast} onChange={e => setSrchLast(e.target.value)} placeholder="Patient's last name" className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Date of Birth</label>
                    <input required value={srchDob} onChange={e => setSrchDob(e.target.value)} placeholder="YYYY-MM-DD" className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Medicaid / Insurance Member ID</label>
                    <input required value={srchInsId} onChange={e => setSrchInsId(e.target.value)} placeholder="Member ID" className={inp} />
                  </div>
                  <button type="submit" className="w-full bg-[#2F3E4E] text-white py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition">Search</button>
                </form>
              )}

              {/* Step 2a: Match found */}
              {step === 'found' && (
                <div>
                  <p className="text-sm text-[#7A8F79] mb-4">A matching patient was found. Click to link yourself — you'll only see your own notes and hours for this patient.</p>
                  <div className="space-y-3">
                    {matches.map(m => (
                      <div key={m.id} className="border border-[#D9E1E8] rounded-xl p-4">
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-bold text-[#2F3E4E]">{m.firstName} {m.lastName}</p>
                          <span className="text-[10px] font-mono text-[#7A8F79] bg-[#F4F6F5] px-2 py-0.5 rounded-full">{m.accountNumber}</span>
                        </div>
                        <p className="text-xs text-[#7A8F79] mb-1">DOB: {fmtDob(m.dob)}</p>
                        <p className="text-xs text-[#7A8F79] mb-3">{m.insuranceType} — {m.insuranceId}</p>
                        {m.address && <p className="text-xs text-[#7A8F79] mb-3">{m.address}{m.city ? `, ${m.city}` : ''}{m.state ? `, ${m.state}` : ''}</p>}
                        <button onClick={() => handleLink(m.id)} disabled={linking}
                          className="w-full bg-[#7A8F79] text-white py-1.5 rounded-lg text-sm font-semibold hover:bg-[#2F3E4E] transition disabled:opacity-50">
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

              {/* Step 2b: No match */}
              {step === 'notfound' && (
                <div className="text-center">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                    <p className="text-sm text-amber-800 font-semibold">No patient matches found.</p>
                    <p className="text-xs text-amber-700 mt-1">Please continue adding a new patient record.</p>
                  </div>
                  <button onClick={() => setStep('newform')} className="w-full bg-[#2F3E4E] text-white py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition mb-3">
                    Continue Adding New Patient
                  </button>
                  <button onClick={() => setStep('search')} className="w-full border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-xl text-sm hover:bg-[#F4F6F5] transition">
                    Try a Different Search
                  </button>
                </div>
              )}

              {/* Step 3: New patient form */}
              {step === 'newform' && (
                <form onSubmit={handleCreate} className="space-y-5">

                  {/* Insurance type selector */}
                  <div>
                    <label className={lbl}>Insurance Type</label>
                    <div className="flex gap-2">
                      {(['Medicaid', 'Commercial'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setInsType(t)}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${insType === t ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'border-[#D9E1E8] text-[#7A8F79] hover:bg-[#F4F6F5]'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Demographics ── */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Demographics</p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={lbl}>First Name</label>
                          <input required value={newPt.firstName} onChange={e => setPt('firstName', e.target.value)} className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>Last Name</label>
                          <input required value={newPt.lastName} onChange={e => setPt('lastName', e.target.value)} className={inp} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={lbl}>Date of Birth</label>
                          <input required value={newPt.dob} onChange={e => setPt('dob', e.target.value)} placeholder="YYYY-MM-DD" className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>Sex</label>
                          <select value={newPt.gender} onChange={e => setPt('gender', e.target.value)} className={inp}>
                            <option value="">Select…</option>
                            <option>Male</option>
                            <option>Female</option>
                            <option>Other</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className={lbl}>Phone <span className="normal-case font-normal text-[#aab]">(optional)</span></label>
                        <input value={newPt.phone} onChange={e => setPt('phone', e.target.value)} placeholder="(555) 000-0000" className={inp} />
                      </div>
                    </div>
                  </div>

                  {/* ── Insurance ── */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Insurance</p>
                    <div className="space-y-3">
                      <div>
                        <label className={lbl}>{insType === 'Medicaid' ? 'Medicaid Member ID' : 'Insurance Member ID'}</label>
                        <input required value={newPt.insuranceId} onChange={e => setPt('insuranceId', e.target.value)} className={inp} />
                      </div>

                      {insType === 'Commercial' && (
                        <>
                          <div>
                            <label className={lbl}>Insurance Company</label>
                            <input required value={newPt.insuranceName} onChange={e => setPt('insuranceName', e.target.value)} placeholder="e.g. Aetna, UnitedHealth…" className={inp} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={lbl}>Group # <span className="normal-case font-normal text-[#aab]">(optional)</span></label>
                              <input value={newPt.insuranceGroup} onChange={e => setPt('insuranceGroup', e.target.value)} className={inp} />
                            </div>
                            <div>
                              <label className={lbl}>Plan Name <span className="normal-case font-normal text-[#aab]">(optional)</span></label>
                              <input value={newPt.insurancePlan} onChange={e => setPt('insurancePlan', e.target.value)} className={inp} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={lbl}>Subscriber Name</label>
                              <input required value={newPt.subscriberName} onChange={e => setPt('subscriberName', e.target.value)} className={inp} />
                            </div>
                            <div>
                              <label className={lbl}>Patient Relation to Subscriber</label>
                              <select required value={newPt.subscriberRelation} onChange={e => setPt('subscriberRelation', e.target.value)} className={inp}>
                                <option value="">Select…</option>
                                {SUBSCRIBER_RELATIONS.map(r => <option key={r}>{r}</option>)}
                              </select>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ── Address ── */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">
                      Address {insType === 'Medicaid' && <span className="normal-case font-normal text-[#aab] ml-1">(optional)</span>}
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className={lbl}>Street</label>
                        <input required={insType === 'Commercial'} value={newPt.address} onChange={e => setPt('address', e.target.value)} placeholder="Street address" className={inp} />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                          <label className={lbl}>City</label>
                          <input required={insType === 'Commercial'} value={newPt.city} onChange={e => setPt('city', e.target.value)} className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>State</label>
                          <select required={insType === 'Commercial'} value={newPt.state} onChange={e => setPt('state', e.target.value)} className={inp}>
                            <option value="">ST</option>
                            {US_STATES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>ZIP</label>
                          <input required={insType === 'Commercial'} value={newPt.zip} onChange={e => setPt('zip', e.target.value)} className={inp} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Clinical / Billing ── */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Clinical / Billing</p>
                    <div className="space-y-3">

                      {/* High-Tech */}
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="highTech" checked={newPt.highTech} onChange={e => setPt('highTech', e.target.checked)} className="accent-[#7A8F79] w-4 h-4" />
                        <label htmlFor="highTech" className="text-sm text-[#2F3E4E] font-semibold cursor-pointer">High-Tech designation</label>
                      </div>

                      {/* Diagnosis codes */}
                      <div>
                        <label className={lbl}>Diagnosis Codes (ICD-10) <span className="normal-case font-normal text-[#aab]">(enter applicable)</span></label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['dxCode1','dxCode2','dxCode3','dxCode4'] as const).map((k, i) => (
                            <input key={k} value={(newPt as any)[k]} onChange={e => setPt(k, e.target.value)}
                              placeholder={`Dx ${i + 1}`} className={inp} />
                          ))}
                        </div>
                      </div>

                      {/* Prior Authorization */}
                      <div>
                        <label className={lbl}>Prior Authorization # <span className="normal-case font-normal text-[#aab]">(optional)</span></label>
                        <input value={newPt.paNumber} onChange={e => setPt('paNumber', e.target.value)} className={inp} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={lbl}>PA Start Date</label>
                          <input value={newPt.paStartDate} onChange={e => setPt('paStartDate', e.target.value)} placeholder="YYYY-MM-DD" className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>PA End Date</label>
                          <input value={newPt.paEndDate} onChange={e => setPt('paEndDate', e.target.value)} placeholder="YYYY-MM-DD" className={inp} />
                        </div>
                      </div>

                      {/* Commercial-only policy details */}
                      {insType === 'Commercial' && (
                        <>
                          <div>
                            <label className={lbl}>Network Status</label>
                            <div className="flex gap-2">
                              {['IN', 'OON'].map(s => (
                                <button key={s} type="button" onClick={() => setPt('networkStatus', newPt.networkStatus === s ? '' : s)}
                                  className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition ${newPt.networkStatus === s ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'border-[#D9E1E8] text-[#7A8F79] hover:bg-[#F4F6F5]'}`}>
                                  {s === 'IN' ? 'In-Network' : 'Out-of-Network'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <input type="checkbox" id="hasCaseRate" checked={newPt.hasCaseRate} onChange={e => setPt('hasCaseRate', e.target.checked)} className="accent-[#7A8F79] w-4 h-4" />
                            <label htmlFor="hasCaseRate" className="text-sm text-[#2F3E4E] font-semibold cursor-pointer">Agreed case rate exists</label>
                          </div>

                          {newPt.hasCaseRate && (
                            <div>
                              <label className={lbl}>Case Rate Amount</label>
                              <input value={newPt.caseRateAmount} onChange={e => setPt('caseRateAmount', e.target.value)} placeholder="e.g. $125.00 / day" className={inp} />
                            </div>
                          )}

                          <div>
                            <label className={lbl}>Policy Notes <span className="normal-case font-normal text-[#aab]">(optional)</span></label>
                            <textarea value={newPt.policyNotes} onChange={e => setPt('policyNotes', e.target.value)} rows={2}
                              placeholder="e.g. Primary plan covers first 100 days only…"
                              className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <button type="submit" disabled={creating}
                    className="w-full bg-[#2F3E4E] text-white py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                    {creating ? 'Creating…' : 'Create Patient Record'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
