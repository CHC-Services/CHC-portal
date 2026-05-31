'use client'

import { useState } from 'react'

type SearchMatch = {
  id: string
  accountNumber: string
  firstName: string
  lastName: string
  dob: string
  insuranceType: string
  insuranceId: string
}

type Step = 'search' | 'found' | 'newform'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

function blankPt() {
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

export default function AddPatientModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (patientId: string, label: string) => void
}) {
  const [step, setStep] = useState<Step>('search')
  const [srchLast, setSrchLast] = useState('')
  const [srchDob, setSrchDob] = useState('')
  const [srchInsId, setSrchInsId] = useState('')
  const [matches, setMatches] = useState<SearchMatch[]>([])
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState('')
  const [linking, setLinking] = useState(false)
  const [insType, setInsType] = useState<'Medicaid' | 'Commercial'>('Medicaid')
  const [newPt, setNewPt] = useState(blankPt())
  const [creating, setCreating] = useState(false)
  const [formErr, setFormErr] = useState('')

  function setPt(field: string, value: any) {
    setNewPt(p => ({ ...p, [field]: value }))
  }

  async function search() {
    if (!srchLast.trim()) { setSearchErr('Last name is required.'); return }
    setSearchErr('')
    setSearching(true)
    const res = await fetch('/api/nurse/patients/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ lastName: srchLast, dob: srchDob, insuranceId: srchInsId }),
    })
    const data = await res.json()
    setSearching(false)
    if (!res.ok) { setSearchErr(data.error || 'Search failed.'); return }
    if (data.matches?.length) {
      setMatches(data.matches)
      setStep('found')
    } else {
      setSrchLast(srchLast)
      setNewPt(p => ({ ...p, lastName: srchLast, dob: srchDob, insuranceId: srchInsId }))
      setStep('newform')
    }
  }

  async function linkExisting(patientId: string, firstName: string, lastName: string) {
    setLinking(true)
    const res = await fetch('/api/nurse/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ existingPatientId: patientId }),
    })
    setLinking(false)
    if (res.ok) {
      onSuccess(patientId, `${lastName}, ${firstName[0]}.`)
    }
  }

  async function createNew() {
    if (!newPt.firstName.trim() || !newPt.lastName.trim()) { setFormErr('First and last name are required.'); return }
    if (!newPt.dob) { setFormErr('Date of birth is required.'); return }
    if (!newPt.insuranceId.trim()) { setFormErr('Insurance ID is required.'); return }
    setFormErr('')
    setCreating(true)
    const res = await fetch('/api/nurse/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ patient: { ...newPt, insuranceType: insType } }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setFormErr(data.error || 'Could not create patient.'); return }
    onSuccess(data.patient.id, `${newPt.lastName}, ${newPt.firstName[0]}.`)
  }

  const inp = 'w-full border border-[#D9E1E8] p-2 rounded-lg text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] text-sm'
  const lbl = 'block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-10 px-4 pb-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9E1E8]">
          <h2 className="text-base font-bold text-[#2F3E4E]">
            {step === 'search' && 'Find or Add a Patient'}
            {step === 'found' && 'Patients Found'}
            {step === 'newform' && 'New Patient'}
          </h2>
          <button onClick={onClose} className="text-[#7A8F79] hover:text-[#2F3E4E] text-xl leading-none transition">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* ── Step 1: Search ── */}
          {step === 'search' && (
            <>
              <p className="text-xs text-[#7A8F79]">Search to avoid duplicates. Enter at least the last name to begin.</p>
              <div className="space-y-3">
                <div>
                  <label className={lbl}>Last Name <span className="text-red-400">*</span></label>
                  <input className={inp} value={srchLast} onChange={e => setSrchLast(e.target.value)}
                    placeholder="e.g. Smith" onKeyDown={e => e.key === 'Enter' && search()} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Date of Birth</label>
                    <input type="date" className={inp} value={srchDob} onChange={e => setSrchDob(e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Insurance ID</label>
                    <input className={inp} value={srchInsId} onChange={e => setSrchInsId(e.target.value)} placeholder="Medicaid / Member ID" />
                  </div>
                </div>
              </div>
              {searchErr && <p className="text-xs text-red-500">{searchErr}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={search} disabled={searching}
                  className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-lg font-semibold text-sm hover:bg-[#7A8F79] transition disabled:opacity-50">
                  {searching ? 'Searching…' : 'Search'}
                </button>
                <button onClick={() => { setStep('newform'); setNewPt(p => ({ ...p, lastName: srchLast, dob: srchDob })) }}
                  className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg font-semibold text-sm hover:bg-[#F4F6F5] transition">
                  Skip — Create New
                </button>
              </div>
            </>
          )}

          {/* ── Step 2a: Matches found ── */}
          {step === 'found' && (
            <>
              <p className="text-xs text-[#7A8F79]">Select a match to link them to your account, or create a new patient if none match.</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {matches.map(m => (
                  <div key={m.id} className="border border-[#D9E1E8] rounded-xl p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-[#2F3E4E]">{m.lastName}, {m.firstName}</p>
                      <p className="text-xs text-[#7A8F79]">{m.accountNumber} · DOB: {m.dob} · {m.insuranceType} · {m.insuranceId}</p>
                    </div>
                    <button onClick={() => linkExisting(m.id, m.firstName, m.lastName)} disabled={linking}
                      className="shrink-0 bg-[#7A8F79] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#2F3E4E] transition disabled:opacity-50">
                      {linking ? '…' : 'Link'}
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep('newform')}
                className="w-full border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-lg font-semibold text-sm hover:bg-[#F4F6F5] transition">
                None of these — Create New Patient
              </button>
              <button onClick={() => setStep('search')}
                className="w-full text-xs text-[#7A8F79] hover:text-[#2F3E4E] underline underline-offset-2 transition">
                ← Back to search
              </button>
            </>
          )}

          {/* ── Step 2b: New patient form ── */}
          {step === 'newform' && (
            <>
              {/* Insurance type toggle */}
              <div className="flex rounded-lg overflow-hidden border border-[#D9E1E8] text-sm font-semibold">
                {(['Medicaid', 'Commercial'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setInsType(t)}
                    className={`flex-1 py-2 transition ${insType === t ? 'bg-[#2F3E4E] text-white' : 'text-[#7A8F79] hover:bg-[#F4F6F5]'}`}>
                    {t}
                  </button>
                ))}
              </div>

              {/* Demographics */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>First Name <span className="text-red-400">*</span></label>
                  <input className={inp} value={newPt.firstName} onChange={e => setPt('firstName', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Last Name <span className="text-red-400">*</span></label>
                  <input className={inp} value={newPt.lastName} onChange={e => setPt('lastName', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Date of Birth <span className="text-red-400">*</span></label>
                  <input type="date" className={inp} value={newPt.dob} onChange={e => setPt('dob', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Gender</label>
                  <select className={inp} value={newPt.gender} onChange={e => setPt('gender', e.target.value)}>
                    <option value="">—</option>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Phone</label>
                  <input className={inp} value={newPt.phone} onChange={e => setPt('phone', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>State</label>
                  <select className={inp} value={newPt.state} onChange={e => setPt('state', e.target.value)}>
                    <option value="">—</option>
                    {US_STATES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Insurance */}
              <div>
                <label className={lbl}>Insurance ID / {insType === 'Medicaid' ? 'Medicaid #' : 'Member ID'} <span className="text-red-400">*</span></label>
                <input className={inp} value={newPt.insuranceId} onChange={e => setPt('insuranceId', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Insurance Name</label>
                  <input className={inp} value={newPt.insuranceName} onChange={e => setPt('insuranceName', e.target.value)} placeholder={insType === 'Medicaid' ? 'NY Medicaid' : 'e.g. BCBS'} />
                </div>
                <div>
                  <label className={lbl}>Plan</label>
                  <input className={inp} value={newPt.insurancePlan} onChange={e => setPt('insurancePlan', e.target.value)} />
                </div>
              </div>

              {/* Commercial-only fields */}
              {insType === 'Commercial' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Subscriber Name</label>
                    <input className={inp} value={newPt.subscriberName} onChange={e => setPt('subscriberName', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Subscriber Relation</label>
                    <select className={inp} value={newPt.subscriberRelation} onChange={e => setPt('subscriberRelation', e.target.value)}>
                      <option value="">—</option>
                      {['Self','Spouse','Child','Parent','Other'].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Clinical */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>PA Number</label>
                  <input className={inp} value={newPt.paNumber} onChange={e => setPt('paNumber', e.target.value)} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-[#2F3E4E]">
                    <input type="checkbox" checked={newPt.highTech} onChange={e => setPt('highTech', e.target.checked)} className="accent-[#7A8F79]" />
                    High Tech
                  </label>
                </div>
              </div>
              {newPt.paNumber && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>PA Start</label>
                    <input type="date" className={inp} value={newPt.paStartDate} onChange={e => setPt('paStartDate', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>PA End</label>
                    <input type="date" className={inp} value={newPt.paEndDate} onChange={e => setPt('paEndDate', e.target.value)} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Dx Code 1</label>
                  <input className={inp} value={newPt.dxCode1} onChange={e => setPt('dxCode1', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Dx Code 2</label>
                  <input className={inp} value={newPt.dxCode2} onChange={e => setPt('dxCode2', e.target.value)} />
                </div>
              </div>

              {formErr && <p className="text-xs text-red-500">{formErr}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep('search')}
                  className="border border-[#D9E1E8] text-[#7A8F79] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#F4F6F5] transition">
                  ← Back
                </button>
                <button onClick={createNew} disabled={creating}
                  className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-lg font-semibold text-sm hover:bg-[#7A8F79] transition disabled:opacity-50">
                  {creating ? 'Saving…' : 'Save Patient'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
