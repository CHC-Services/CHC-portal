'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formalName } from '../../../lib/formatName'
import { fmtPhoneInput } from '../../../lib/formatPhone'
import DateInput from '../../components/DateInput'

type NurseLink = {
  id: string
  isActive: boolean
  nurse: { id: string; displayName: string; firstName?: string; lastName?: string; accountNumber: string | null }
}

type Patient = {
  id: string
  accountNumber: string
  firstName: string
  lastName: string
  dob: string
  insuranceType: string
  insuranceId: string
  isLocked: boolean
  nurseLinks: NurseLink[]
  _count: { timeEntries: number }
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

function blankCreate() {
  return {
    firstName: '', lastName: '', dob: '', gender: '',
    insuranceId: '', insuranceName: '', insuranceGroup: '', insurancePlan: '',
    address: '', city: '', state: '', zip: '', phone: '',
    highTech: false,
    dxCode1: '', dxCode2: '', dxCode3: '', dxCode4: '',
    subscriberName: '', subscriberRelation: '',
    networkStatus: '', hasCaseRate: false, caseRateAmount: '', policyNotes: '',
  }
}

export default function AdPatients() {
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Create modal state
  const [showCreate, setShowCreate] = useState(false)
  const [createInsType, setCreateInsType] = useState<'Medicaid' | 'Commercial'>('Medicaid')
  const [createData, setCreateData] = useState(blankCreate())
  const [createPA, setCreatePA] = useState({ paNumber: '', paStartDate: '', paEndDate: '' })
  const createPaEndDateRef = useRef<HTMLInputElement>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [sortCol, setSortCol] = useState<'account' | 'name' | 'dob' | 'insurance' | 'providers' | 'entries'>('account')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(col: typeof sortCol) {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function loadPatients() {
    return fetch('/api/admin/patients', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.patients)) setPatients(data.patients) })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPatients()
  }, [])

  function setCreateField(k: string, v: any) {
    setCreateData(d => ({ ...d, [k]: v }))
  }

  function openCreate() {
    setCreateData(blankCreate())
    setCreatePA({ paNumber: '', paStartDate: '', paEndDate: '' })
    setCreateInsType('Medicaid')
    setCreateError('')
    setShowCreate(true)
  }

  async function handleCreatePatient(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true); setCreateError('')
    const res = await fetch('/api/admin/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        patient: { ...createData, insuranceType: createInsType },
        initialPA: createPA.paNumber.trim() ? createPA : undefined,
      }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      await loadPatients()
      setShowCreate(false)
    } else {
      setCreateError(data.error || 'Failed to create patient.')
    }
  }

  const filtered = patients.filter(p => {
    const q = search.toLowerCase()
    return (
      p.accountNumber.toLowerCase().includes(q) ||
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.insuranceId.toLowerCase().includes(q) ||
      p.nurseLinks.some(l => (formalName(l.nurse) || l.nurse.displayName).toLowerCase().includes(q))
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortCol === 'account') {
      cmp = a.accountNumber.localeCompare(b.accountNumber, undefined, { numeric: true })
    } else if (sortCol === 'name') {
      cmp = a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
    } else if (sortCol === 'dob') {
      cmp = (a.dob || '').localeCompare(b.dob || '')
    } else if (sortCol === 'insurance') {
      cmp = a.insuranceType.localeCompare(b.insuranceType)
    } else if (sortCol === 'providers') {
      const aName = a.nurseLinks.find(l => l.isActive)?.nurse.lastName || ''
      const bName = b.nurseLinks.find(l => l.isActive)?.nurse.lastName || ''
      cmp = aName.localeCompare(bName)
    } else if (sortCol === 'entries') {
      cmp = a._count.timeEntries - b._count.timeEntries
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  function SortIcon({ col }: { col: typeof sortCol }) {
    if (sortCol !== col) return <span className="ml-1 opacity-30">↕</span>
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">

      <div className="mb-5">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">ad</span>Patients
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">All patient records across all providers. {patients.length} total.</p>
      </div>

      <div className="flex gap-3 mb-5">
        <input
          type="text"
          placeholder="Search by name, account #, insurance ID, or provider…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-[#D9E1E8] bg-white rounded-xl px-4 py-2.5 text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
        />
        <button
          onClick={openCreate}
          className="bg-[#2F3E4E] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition whitespace-nowrap"
        >
          + New Patient
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-[#7A8F79]">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[#7A8F79] italic">No patients found.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                {([
                  { col: 'account', label: 'Account', align: 'left' },
                  { col: 'name', label: 'Name', align: 'left' },
                  { col: 'dob', label: 'DOB', align: 'left' },
                  { col: 'insurance', label: 'Insurance', align: 'left' },
                  { col: 'providers', label: 'Linked Providers', align: 'left' },
                  { col: 'entries', label: 'Entries', align: 'right' },
                ] as const).map(({ col, label, align }) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={`py-3 px-4 cursor-pointer select-none hover:text-[#2F3E4E] transition text-${align} whitespace-nowrap`}
                  >
                    {label}<SortIcon col={col} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/admin/patients/${p.id}`)}
                  className={`border-b border-[#D9E1E8] last:border-0 cursor-pointer hover:bg-[#F4F6F5] transition ${i % 2 === 1 ? 'bg-[#FAFBFA]' : ''}`}
                >
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs text-[#7A8F79]">{p.accountNumber}</span>
                    {p.isLocked && <span className="ml-1.5 text-[9px] font-bold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">Locked</span>}
                  </td>
                  <td className="py-3 px-4 font-semibold text-[#2F3E4E] uppercase">{p.lastName}, {p.firstName}</td>
                  <td className="py-3 px-4 text-[#7A8F79]">{p.dob}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.insuranceType === 'Medicaid' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {p.insuranceType}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#7A8F79]">
                    {p.nurseLinks.filter(l => l.isActive).map(l => l.nurse.lastName || l.nurse.displayName).join(', ') || '—'}
                  </td>
                  <td className="py-3 px-4 text-right text-[#2F3E4E] font-semibold">{p._count.timeEntries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Patient Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#D9E1E8] sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-[#2F3E4E]">New Patient Record</h2>
              <button onClick={() => setShowCreate(false)} className="text-[#7A8F79] hover:text-[#2F3E4E] transition text-xl leading-none">✕</button>
            </div>

            <div className="p-5">
              {createError && <p className="text-red-500 text-sm mb-4 bg-red-50 rounded-lg px-3 py-2">{createError}</p>}

              <form onSubmit={handleCreatePatient} className="space-y-5">

                {/* Insurance type */}
                <div>
                  <label className={lbl}>Insurance Type</label>
                  <div className="flex gap-2">
                    {(['Medicaid', 'Commercial'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setCreateInsType(t)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${createInsType === t ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'border-[#D9E1E8] text-[#7A8F79] hover:bg-[#F4F6F5]'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Demographics */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Demographics</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={lbl}>First Name</label>
                        <input required value={createData.firstName} onChange={e => setCreateField('firstName', e.target.value.toUpperCase())} className={`${inp} uppercase`} />
                      </div>
                      <div>
                        <label className={lbl}>Last Name</label>
                        <input required value={createData.lastName} onChange={e => setCreateField('lastName', e.target.value.toUpperCase())} className={`${inp} uppercase`} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={lbl}>Date of Birth</label>
                        <DateInput required value={createData.dob} onChange={e => setCreateField('dob', e.target.value)} className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Sex</label>
                        <select value={createData.gender} onChange={e => setCreateField('gender', e.target.value)} className={inp}>
                          <option value="">Select…</option>
                          <option>Male</option><option>Female</option><option>Other</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={lbl}>Phone <span className="normal-case font-normal text-[#aab]">(optional)</span></label>
                      <input value={createData.phone} onChange={e => setCreateField('phone', fmtPhoneInput(e.target.value))} placeholder="(555) 000-0000" className={inp} />
                    </div>
                  </div>
                </div>

                {/* Insurance */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Insurance</p>
                  <div className="space-y-3">
                    <div>
                      <label className={lbl}>{createInsType === 'Medicaid' ? 'Medicaid Member ID' : 'Insurance Member ID'}</label>
                      <input required value={createData.insuranceId} onChange={e => setCreateField('insuranceId', e.target.value)} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Carrier Name <span className="normal-case font-normal text-[#aab]">{createInsType === 'Commercial' ? '' : '(optional)'}</span></label>
                      <input required={createInsType === 'Commercial'} value={createData.insuranceName} onChange={e => setCreateField('insuranceName', e.target.value)} placeholder="e.g. Aetna, Medicaid…" className={inp} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={lbl}>Group # <span className="normal-case font-normal text-[#aab]">(optional)</span></label>
                        <input value={createData.insuranceGroup} onChange={e => setCreateField('insuranceGroup', e.target.value)} className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Plan Name <span className="normal-case font-normal text-[#aab]">(optional)</span></label>
                        <input value={createData.insurancePlan} onChange={e => setCreateField('insurancePlan', e.target.value)} className={inp} />
                      </div>
                    </div>
                    {createInsType === 'Commercial' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={lbl}>Subscriber Name</label>
                          <input required value={createData.subscriberName} onChange={e => setCreateField('subscriberName', e.target.value)} className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>Relation</label>
                          <select required value={createData.subscriberRelation} onChange={e => setCreateField('subscriberRelation', e.target.value)} className={inp}>
                            <option value="">Select…</option>
                            {SUBSCRIBER_RELATIONS.map(r => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">
                    Address <span className="normal-case font-normal text-[#aab]">(optional)</span>
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className={lbl}>Street</label>
                      <input value={createData.address} onChange={e => setCreateField('address', e.target.value)} className={inp} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <label className={lbl}>City</label>
                        <input value={createData.city} onChange={e => setCreateField('city', e.target.value)} className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>State</label>
                        <select value={createData.state} onChange={e => setCreateField('state', e.target.value)} className={inp}>
                          <option value="">ST</option>
                          {US_STATES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lbl}>ZIP</label>
                        <input value={createData.zip} onChange={e => setCreateField('zip', e.target.value)} className={inp} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clinical */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Clinical / Billing</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="createHT" checked={createData.highTech} onChange={e => setCreateField('highTech', e.target.checked)} className="accent-[#7A8F79] w-4 h-4" />
                      <label htmlFor="createHT" className="text-sm text-[#2F3E4E] font-semibold cursor-pointer">High-Tech designation</label>
                    </div>
                    <div>
                      <label className={lbl}>Diagnosis Codes (ICD-10) <span className="normal-case font-normal text-[#aab]">(enter applicable)</span></label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['dxCode1','dxCode2','dxCode3','dxCode4'] as const).map((k, i) => (
                          <input key={k} value={(createData as any)[k]} onChange={e => setCreateField(k, e.target.value)} placeholder={`Dx ${i + 1}`} className={inp} />
                        ))}
                      </div>
                    </div>
                    {createInsType === 'Commercial' && (
                      <>
                        <div>
                          <label className={lbl}>Network Status</label>
                          <div className="flex gap-2">
                            {['IN', 'OON'].map(s => (
                              <button key={s} type="button" onClick={() => setCreateField('networkStatus', createData.networkStatus === s ? '' : s)}
                                className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition ${createData.networkStatus === s ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'border-[#D9E1E8] text-[#7A8F79] hover:bg-[#F4F6F5]'}`}>
                                {s === 'IN' ? 'In-Network' : 'Out-of-Network'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <input type="checkbox" id="createCR" checked={createData.hasCaseRate} onChange={e => setCreateField('hasCaseRate', e.target.checked)} className="accent-[#7A8F79] w-4 h-4" />
                          <label htmlFor="createCR" className="text-sm text-[#2F3E4E] font-semibold cursor-pointer">Agreed case rate exists</label>
                        </div>
                        {createData.hasCaseRate && (
                          <div>
                            <label className={lbl}>Case Rate Amount</label>
                            <input value={createData.caseRateAmount} onChange={e => setCreateField('caseRateAmount', e.target.value)} placeholder="e.g. $125.00 / day" className={inp} />
                          </div>
                        )}
                        <div>
                          <label className={lbl}>Policy Notes <span className="normal-case font-normal text-[#aab]">(optional)</span></label>
                          <textarea value={createData.policyNotes} onChange={e => setCreateField('policyNotes', e.target.value)} rows={2}
                            placeholder="e.g. Primary plan covers first 100 days only…"
                            className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Prior Authorization */}
                <div>
                  <label className={lbl}>Prior Authorization # <span className="normal-case font-normal text-[#aab]">(optional)</span></label>
                  <input value={createPA.paNumber} onChange={e => setCreatePA(p => ({ ...p, paNumber: e.target.value }))} className={inp} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>PA Start Date</label>
                    <DateInput value={createPA.paStartDate} onChange={e => setCreatePA(p => ({ ...p, paStartDate: e.target.value }))} className={inp} nextRef={createPaEndDateRef} />
                  </div>
                  <div>
                    <label className={lbl}>PA End Date</label>
                    <DateInput ref={createPaEndDateRef} value={createPA.paEndDate} onChange={e => setCreatePA(p => ({ ...p, paEndDate: e.target.value }))} className={inp} />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={creating}
                    className="flex-1 bg-[#2F3E4E] text-white py-2.5 rounded-xl font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                    {creating ? 'Creating…' : 'Create Patient Record'}
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2.5 rounded-xl text-sm hover:bg-[#F4F6F5] transition">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
