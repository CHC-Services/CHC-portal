'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { fmtPhoneInput } from '../../../../lib/formatPhone'

type Patient = {
  id: string
  accountNumber: string
  firstName: string
  lastName: string
  dob: string
  gender: string | null
  phone: string | null
  insuranceType: string
  insuranceId: string
  insuranceName: string | null
  insuranceGroup: string | null
  insurancePlan: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
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
  ins2Type: string | null
  ins2Id: string | null
  ins2Name: string | null
  ins2Group: string | null
  ins2Plan: string | null
  ins2SubscriberName: string | null
  ins2SubscriberRelation: string | null
  ins2NetworkStatus: string | null
  ins2HasCaseRate: boolean
  ins2CaseRateAmount: string | null
  ins2PolicyNotes: string | null
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]
const SUBSCRIBER_RELATIONS = ['Self', 'Spouse', 'Child', 'Parent', 'Other']

const inp = 'w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'
const lbl = 'block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1'

function AdditionalCoverage({ data, setField }: { data: Partial<Patient>; setField: (k: string, v: any) => void }) {
  const [open, setOpen] = useState(!!(data.ins2Type || data.ins2Id))
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest text-[#2F3E4E] pb-1 border-b border-[#D9E1E8] mb-3 hover:text-[#7A8F79] transition"
      >
        <span>Additional Coverage</span>
        <span className="text-[#7A8F79] font-normal normal-case tracking-normal">
          {open ? '▲ hide' : (data.ins2Type || data.ins2Id ? '▼ edit' : '▼ + add coverage')}
        </span>
      </button>
      {open && (
        <div className="space-y-3">
          <div>
            <label className={lbl}>Insurance Type</label>
            <select value={data.ins2Type || ''} onChange={e => setField('ins2Type', e.target.value || null)} className={inp}>
              <option value="">— None —</option>
              <option>Medicaid</option><option>Commercial</option><option>Medicare</option><option>Other</option>
            </select>
          </div>
          {data.ins2Type && (<>
            <div><label className={lbl}>Member ID</label><input value={data.ins2Id || ''} onChange={e => setField('ins2Id', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Carrier Name</label><input value={data.ins2Name || ''} onChange={e => setField('ins2Name', e.target.value)} className={inp} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Group #</label><input value={data.ins2Group || ''} onChange={e => setField('ins2Group', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Plan</label><input value={data.ins2Plan || ''} onChange={e => setField('ins2Plan', e.target.value)} className={inp} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Subscriber Name</label><input value={data.ins2SubscriberName || ''} onChange={e => setField('ins2SubscriberName', e.target.value)} className={inp} /></div>
              <div>
                <label className={lbl}>Relation</label>
                <select value={data.ins2SubscriberRelation || ''} onChange={e => setField('ins2SubscriberRelation', e.target.value)} className={inp}>
                  <option value="">Select…</option>
                  {SUBSCRIBER_RELATIONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={lbl}>Network Status</label>
              <div className="flex gap-2">
                {['IN', 'OON'].map(s => (
                  <button key={s} type="button" onClick={() => setField('ins2NetworkStatus', data.ins2NetworkStatus === s ? null : s)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition ${data.ins2NetworkStatus === s ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'border-[#D9E1E8] text-[#7A8F79] hover:bg-[#F4F6F5]'}`}>
                    {s === 'IN' ? 'In-Network' : 'Out-of-Network'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="cr2" checked={!!data.ins2HasCaseRate} onChange={e => setField('ins2HasCaseRate', e.target.checked)} className="accent-[#7A8F79] w-4 h-4" />
              <label htmlFor="cr2" className="text-sm text-[#2F3E4E] font-semibold cursor-pointer">Agreed case rate</label>
            </div>
            {data.ins2HasCaseRate && (
              <div><label className={lbl}>Case Rate Amount</label><input value={data.ins2CaseRateAmount || ''} onChange={e => setField('ins2CaseRateAmount', e.target.value)} placeholder="e.g. $125.00 / day" className={inp} /></div>
            )}
            <div>
              <label className={lbl}>Policy Notes</label>
              <textarea value={data.ins2PolicyNotes || ''} onChange={e => setField('ins2PolicyNotes', e.target.value)} rows={2}
                placeholder="e.g. Secondary covers remainder after primary…"
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
            </div>
          </>)}
        </div>
      )}
    </div>
  )
}

export default function FamilyPatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [data, setData] = useState<Partial<Patient>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/family/patients/${id}`, { credentials: 'include' })
      .then(async r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return }
        const body = await r.json()
        setData(body.patient)
        setLoading(false)
      })
  }, [id])

  function setField(k: string, v: any) {
    setData(d => ({ ...d, [k]: v }))
    setSaved(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    const res = await fetch(`/api/family/patients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    const body = await res.json()
    setSaving(false)
    if (res.ok) {
      setData(body.patient)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setError(body.error || 'Failed to save changes.')
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0"><p className="text-sm text-[#7A8F79]">Loading…</p></div>
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-md mx-auto">
          <p className="text-[#2F3E4E] font-semibold">Patient not found</p>
          <p className="text-[#7A8F79] text-sm mt-1">This patient isn&apos;t linked to your account.</p>
          <Link href="/family/patients" className="inline-block mt-4 text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E]">← Back to myPatients</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
      <div className="max-w-2xl mx-auto">
        <Link href="/family/patients" className="text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition">← myPatients</Link>

        <div className="flex items-center justify-between mt-2 mb-1">
          <h1 className="text-2xl font-bold text-[#2F3E4E]">
            {data.firstName} {data.lastName}
          </h1>
          <span className="text-xs text-[#7A8F79] font-mono">{data.accountNumber}</span>
        </div>
        <p className="text-sm text-[#7A8F79] mb-6">View and update this patient&apos;s information.</p>

        <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm p-6 space-y-5">

          {/* Demographics */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Demographics</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>First Name</label><input value={data.firstName || ''} onChange={e => setField('firstName', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Last Name</label><input value={data.lastName || ''} onChange={e => setField('lastName', e.target.value)} className={inp} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Date of Birth</label><input type="date" value={data.dob || ''} onChange={e => setField('dob', e.target.value)} className={inp} /></div>
                <div>
                  <label className={lbl}>Sex</label>
                  <select value={data.gender || ''} onChange={e => setField('gender', e.target.value)} className={inp}>
                    <option value="">Select…</option>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
              </div>
              <div><label className={lbl}>Phone</label><input value={data.phone || ''} onChange={e => setField('phone', fmtPhoneInput(e.target.value))} placeholder="(555) 000-0000" className={inp} /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ht" checked={!!data.highTech} onChange={e => setField('highTech', e.target.checked)} className="accent-[#7A8F79] w-4 h-4" />
                <label htmlFor="ht" className="text-sm text-[#2F3E4E] font-semibold cursor-pointer">High-Tech designation</label>
              </div>
            </div>
          </div>

          {/* Primary Insurance */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Primary Insurance</p>
            <div className="space-y-3">
              <div>
                <label className={lbl}>Insurance Type</label>
                <select value={data.insuranceType || ''} onChange={e => setField('insuranceType', e.target.value)} className={inp}>
                  <option>Medicaid</option><option>Commercial</option><option>Medicare</option><option>Other</option>
                </select>
              </div>
              <div><label className={lbl}>Member ID</label><input value={data.insuranceId || ''} onChange={e => setField('insuranceId', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Carrier Name</label><input value={data.insuranceName || ''} onChange={e => setField('insuranceName', e.target.value)} className={inp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Group #</label><input value={data.insuranceGroup || ''} onChange={e => setField('insuranceGroup', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Plan</label><input value={data.insurancePlan || ''} onChange={e => setField('insurancePlan', e.target.value)} className={inp} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Subscriber Name</label><input value={data.subscriberName || ''} onChange={e => setField('subscriberName', e.target.value)} className={inp} /></div>
                <div>
                  <label className={lbl}>Relation</label>
                  <select value={data.subscriberRelation || ''} onChange={e => setField('subscriberRelation', e.target.value)} className={inp}>
                    <option value="">Select…</option>
                    {SUBSCRIBER_RELATIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Coverage */}
          <AdditionalCoverage data={data} setField={setField} />

          {/* Address */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Address</p>
            <div className="space-y-3">
              <div><label className={lbl}>Street</label><input value={data.address || ''} onChange={e => setField('address', e.target.value)} className={inp} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1"><label className={lbl}>City</label><input value={data.city || ''} onChange={e => setField('city', e.target.value)} className={inp} /></div>
                <div>
                  <label className={lbl}>State</label>
                  <select value={data.state || ''} onChange={e => setField('state', e.target.value)} className={inp}>
                    <option value="">ST</option>
                    {US_STATES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>ZIP</label><input value={data.zip || ''} onChange={e => setField('zip', e.target.value)} className={inp} /></div>
              </div>
            </div>
          </div>

          {/* Clinical / Billing */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Clinical / Billing</p>
            <div className="space-y-3">
              <div>
                <label className={lbl}>Diagnosis Codes (ICD-10)</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['dxCode1','dxCode2','dxCode3','dxCode4'] as const).map((k, i) => (
                    <input key={k} value={(data as any)[k] || ''} onChange={e => setField(k, e.target.value)} placeholder={`Dx ${i + 1}`} className={inp} />
                  ))}
                </div>
              </div>
              <div>
                <label className={lbl}>Prior Authorization #</label>
                <input value={data.paNumber || ''} onChange={e => setField('paNumber', e.target.value)} className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>PA Start Date</label><input type="date" value={data.paStartDate || ''} onChange={e => setField('paStartDate', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>PA End Date</label><input type="date" value={data.paEndDate || ''} onChange={e => setField('paEndDate', e.target.value)} className={inp} /></div>
              </div>
              <div>
                <label className={lbl}>Network Status</label>
                <div className="flex gap-2">
                  {['IN', 'OON'].map(s => (
                    <button key={s} type="button" onClick={() => setField('networkStatus', data.networkStatus === s ? null : s)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition ${data.networkStatus === s ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'border-[#D9E1E8] text-[#7A8F79] hover:bg-[#F4F6F5]'}`}>
                      {s === 'IN' ? 'In-Network' : 'Out-of-Network'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="cr" checked={!!data.hasCaseRate} onChange={e => setField('hasCaseRate', e.target.checked)} className="accent-[#7A8F79] w-4 h-4" />
                <label htmlFor="cr" className="text-sm text-[#2F3E4E] font-semibold cursor-pointer">Agreed case rate</label>
              </div>
              {data.hasCaseRate && (
                <div><label className={lbl}>Case Rate Amount</label><input value={data.caseRateAmount || ''} onChange={e => setField('caseRateAmount', e.target.value)} placeholder="e.g. $125.00 / day" className={inp} /></div>
              )}
              <div>
                <label className={lbl}>Policy Notes</label>
                <textarea value={data.policyNotes || ''} onChange={e => setField('policyNotes', e.target.value)} rows={2}
                  placeholder="e.g. Primary plan covers first 100 days only…"
                  className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="bg-[#2F3E4E] text-white px-6 py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {saved && <span className="text-sm font-medium text-green-600">✓ Saved</span>}
          </div>
        </form>
      </div>
    </div>
  )
}
