'use client'

import { useState, useEffect } from 'react'
import AdminNav from '../../components/AdminNav'

type NurseLink = {
  id: string
  isActive: boolean
  nurse: { id: string; displayName: string; accountNumber: string | null }
}

type Patient = {
  id: string
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
  nurseLinks: NurseLink[]
  _count: { timeEntries: number }
}

type Nurse = { id: string; displayName: string; accountNumber: string | null }

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const SUBSCRIBER_RELATIONS = ['Self', 'Spouse', 'Child', 'Parent', 'Other']

const inp = 'w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]'
const lbl = 'block text-xs font-semibold uppercase tracking-wide text-[#7A8F79] mb-1'

export default function AdPatients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [nurses, setNurses] = useState<Nurse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Patient | null>(null)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<Patient>>({})
  const [saving, setSaving] = useState(false)
  const [assignNurseId, setAssignNurseId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [msg, setMsg] = useState('')

  function loadPatients() {
    return fetch('/api/admin/patients', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.patients)) setPatients(data.patients) })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPatients()
    fetch('/api/admin/nurses', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setNurses(data) })
  }, [])

  function openPatient(p: Patient) {
    setSelected(p)
    setEditing(false)
    setEditData({ ...p })
    setMsg('')
    setAssignNurseId('')
  }

  function setField(k: string, v: any) {
    setEditData(d => ({ ...d, [k]: v }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSaving(true); setMsg('')
    const res = await fetch(`/api/admin/patients/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(editData),
    })
    setSaving(false)
    if (res.ok) {
      await loadPatients()
      const updated = patients.find(p => p.id === selected.id)
      if (updated) setSelected({ ...updated, ...editData } as Patient)
      setEditing(false)
      setMsg('Saved.')
    } else {
      setMsg('Save failed.')
    }
  }

  async function handleAssign() {
    if (!selected || !assignNurseId) return
    setAssigning(true); setMsg('')
    const res = await fetch(`/api/admin/patients/${selected.id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nurseId: assignNurseId }),
    })
    setAssigning(false)
    if (res.ok) {
      await loadPatients()
      const refreshed = await fetch(`/api/admin/patients/${selected.id}`, { credentials: 'include' }).then(r => r.json())
      if (refreshed.patient) setSelected(refreshed.patient)
      setAssignNurseId('')
      setMsg('Nurse linked.')
    } else {
      setMsg('Assignment failed.')
    }
  }

  async function handleUnlink(nurseId: string) {
    if (!selected) return
    setMsg('')
    const res = await fetch(`/api/admin/patients/${selected.id}/assign`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nurseId }),
    })
    if (res.ok) {
      await loadPatients()
      const refreshed = await fetch(`/api/admin/patients/${selected.id}`, { credentials: 'include' }).then(r => r.json())
      if (refreshed.patient) setSelected(refreshed.patient)
      setMsg('Unlinked.')
    }
  }

  const filtered = patients.filter(p => {
    const q = search.toLowerCase()
    return (
      p.accountNumber.toLowerCase().includes(q) ||
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.insuranceId.toLowerCase().includes(q) ||
      p.nurseLinks.some(l => l.nurse.displayName.toLowerCase().includes(q))
    )
  })

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">
      <AdminNav />

      <div className="mb-5">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">ad</span>Patients
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">All patient records across all providers. {patients.length} total.</p>
      </div>

      <input
        type="text"
        placeholder="Search by name, account #, insurance ID, or provider…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-[#D9E1E8] bg-white rounded-xl px-4 py-2.5 text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] mb-5"
      />

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
                <th className="text-left py-3 px-4">Account</th>
                <th className="text-left py-3 px-4">Name</th>
                <th className="text-left py-3 px-4">DOB</th>
                <th className="text-left py-3 px-4">Insurance</th>
                <th className="text-left py-3 px-4">Linked Providers</th>
                <th className="text-right py-3 px-4">Entries</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => openPatient(p)}
                  className={`border-b border-[#D9E1E8] last:border-0 cursor-pointer hover:bg-[#F4F6F5] transition ${i % 2 === 1 ? 'bg-[#FAFBFA]' : ''}`}
                >
                  <td className="py-3 px-4 font-mono text-xs text-[#7A8F79]">{p.accountNumber}</td>
                  <td className="py-3 px-4 font-semibold text-[#2F3E4E]">{p.firstName} {p.lastName}</td>
                  <td className="py-3 px-4 text-[#7A8F79]">{p.dob}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.insuranceType === 'Medicaid' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {p.insuranceType}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#7A8F79]">
                    {p.nurseLinks.filter(l => l.isActive).map(l => l.nurse.displayName).join(', ') || '—'}
                  </td>
                  <td className="py-3 px-4 text-right text-[#2F3E4E] font-semibold">{p._count.timeEntries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setSelected(null)}>
          <div
            className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#D9E1E8] sticky top-0 bg-white z-10">
              <div>
                <p className="text-lg font-bold text-[#2F3E4E]">{selected.firstName} {selected.lastName}</p>
                <p className="text-xs font-mono text-[#7A8F79]">{selected.accountNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                {!editing && (
                  <button onClick={() => setEditing(true)} className="text-xs font-semibold text-[#7A8F79] border border-[#D9E1E8] px-3 py-1.5 rounded-lg hover:bg-[#F4F6F5] transition">
                    Edit
                  </button>
                )}
                <button onClick={() => setSelected(null)} className="text-[#7A8F79] hover:text-[#2F3E4E] text-xl leading-none ml-1">✕</button>
              </div>
            </div>

            {msg && (
              <p className={`mx-5 mt-3 text-xs font-semibold px-3 py-2 rounded-lg ${msg.includes('failed') || msg.includes('Failed') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{msg}</p>
            )}

            <div className="p-5 space-y-6">

              {/* ── Provider assignment ── */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Linked Providers</p>
                {selected.nurseLinks.filter(l => l.isActive).length === 0 ? (
                  <p className="text-xs text-[#7A8F79] italic mb-3">No providers linked.</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {selected.nurseLinks.filter(l => l.isActive).map(l => (
                      <div key={l.id} className="flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2">
                        <span className="text-sm text-[#2F3E4E] font-semibold">{l.nurse.displayName}</span>
                        <button
                          onClick={() => handleUnlink(l.nurse.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold transition"
                        >
                          Unlink
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <select
                    value={assignNurseId}
                    onChange={e => setAssignNurseId(e.target.value)}
                    className="flex-1 border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  >
                    <option value="">Assign a provider…</option>
                    {nurses
                      .filter(n => !selected.nurseLinks.some(l => l.isActive && l.nurse.id === n.id))
                      .map(n => (
                        <option key={n.id} value={n.id}>{n.displayName}{n.accountNumber ? ` (${n.accountNumber})` : ''}</option>
                      ))
                    }
                  </select>
                  <button
                    onClick={handleAssign}
                    disabled={!assignNurseId || assigning}
                    className="bg-[#2F3E4E] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-40"
                  >
                    {assigning ? '…' : 'Link'}
                  </button>
                </div>
              </div>

              {/* ── Canonical data view / edit ── */}
              {!editing ? (
                <>
                  <Section title="Demographics">
                    <Row label="Name" value={`${selected.firstName} ${selected.lastName}`} />
                    <Row label="DOB" value={selected.dob} />
                    <Row label="Sex" value={selected.gender} />
                    <Row label="Phone" value={selected.phone} />
                    <Row label="High-Tech" value={selected.highTech ? 'Yes' : 'No'} />
                  </Section>
                  <Section title="Insurance">
                    <Row label="Type" value={selected.insuranceType} />
                    <Row label="Member ID" value={selected.insuranceId} />
                    {selected.insuranceName && <Row label="Carrier" value={selected.insuranceName} />}
                    {selected.insuranceGroup && <Row label="Group #" value={selected.insuranceGroup} />}
                    {selected.insurancePlan && <Row label="Plan" value={selected.insurancePlan} />}
                    {selected.subscriberName && <Row label="Subscriber" value={selected.subscriberName} />}
                    {selected.subscriberRelation && <Row label="Relation" value={selected.subscriberRelation} />}
                  </Section>
                  {selected.address && (
                    <Section title="Address">
                      <Row label="Street" value={selected.address} />
                      <Row label="City" value={`${selected.city || ''}, ${selected.state || ''} ${selected.zip || ''}`.trim()} />
                    </Section>
                  )}
                  <Section title="Clinical">
                    <Row label="Dx Codes" value={[selected.dxCode1, selected.dxCode2, selected.dxCode3, selected.dxCode4].filter(Boolean).join(', ') || '—'} />
                    <Row label="PA #" value={selected.paNumber} />
                    {selected.paNumber && <Row label="PA Dates" value={`${selected.paStartDate || '?'} – ${selected.paEndDate || '?'}`} />}
                    {selected.networkStatus && <Row label="Network" value={selected.networkStatus} />}
                    {selected.hasCaseRate && <Row label="Case Rate" value={selected.caseRateAmount || 'Yes'} />}
                    {selected.policyNotes && <Row label="Policy Notes" value={selected.policyNotes} />}
                  </Section>
                </>
              ) : (
                <form onSubmit={handleSave} className="space-y-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Demographics</p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className={lbl}>First Name</label><input value={editData.firstName || ''} onChange={e => setField('firstName', e.target.value)} className={inp} /></div>
                        <div><label className={lbl}>Last Name</label><input value={editData.lastName || ''} onChange={e => setField('lastName', e.target.value)} className={inp} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className={lbl}>DOB</label><input value={editData.dob || ''} onChange={e => setField('dob', e.target.value)} placeholder="YYYY-MM-DD" className={inp} /></div>
                        <div>
                          <label className={lbl}>Sex</label>
                          <select value={editData.gender || ''} onChange={e => setField('gender', e.target.value)} className={inp}>
                            <option value="">Select…</option>
                            <option>Male</option><option>Female</option><option>Other</option>
                          </select>
                        </div>
                      </div>
                      <div><label className={lbl}>Phone</label><input value={editData.phone || ''} onChange={e => setField('phone', e.target.value)} className={inp} /></div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="htEdit" checked={!!editData.highTech} onChange={e => setField('highTech', e.target.checked)} className="accent-[#7A8F79] w-4 h-4" />
                        <label htmlFor="htEdit" className="text-sm text-[#2F3E4E] font-semibold cursor-pointer">High-Tech</label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Insurance</p>
                    <div className="space-y-3">
                      <div>
                        <label className={lbl}>Insurance Type</label>
                        <select value={editData.insuranceType || ''} onChange={e => setField('insuranceType', e.target.value)} className={inp}>
                          <option>Medicaid</option><option>Commercial</option><option>Medicare</option><option>Other</option>
                        </select>
                      </div>
                      <div><label className={lbl}>Member ID</label><input value={editData.insuranceId || ''} onChange={e => setField('insuranceId', e.target.value)} className={inp} /></div>
                      <div><label className={lbl}>Carrier Name</label><input value={editData.insuranceName || ''} onChange={e => setField('insuranceName', e.target.value)} className={inp} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className={lbl}>Group #</label><input value={editData.insuranceGroup || ''} onChange={e => setField('insuranceGroup', e.target.value)} className={inp} /></div>
                        <div><label className={lbl}>Plan</label><input value={editData.insurancePlan || ''} onChange={e => setField('insurancePlan', e.target.value)} className={inp} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className={lbl}>Subscriber Name</label><input value={editData.subscriberName || ''} onChange={e => setField('subscriberName', e.target.value)} className={inp} /></div>
                        <div>
                          <label className={lbl}>Relation</label>
                          <select value={editData.subscriberRelation || ''} onChange={e => setField('subscriberRelation', e.target.value)} className={inp}>
                            <option value="">Select…</option>
                            {SUBSCRIBER_RELATIONS.map(r => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Address</p>
                    <div className="space-y-3">
                      <div><label className={lbl}>Street</label><input value={editData.address || ''} onChange={e => setField('address', e.target.value)} className={inp} /></div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1"><label className={lbl}>City</label><input value={editData.city || ''} onChange={e => setField('city', e.target.value)} className={inp} /></div>
                        <div>
                          <label className={lbl}>State</label>
                          <select value={editData.state || ''} onChange={e => setField('state', e.target.value)} className={inp}>
                            <option value="">ST</option>
                            {US_STATES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div><label className={lbl}>ZIP</label><input value={editData.zip || ''} onChange={e => setField('zip', e.target.value)} className={inp} /></div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Clinical</p>
                    <div className="space-y-3">
                      <div>
                        <label className={lbl}>Diagnosis Codes</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['dxCode1','dxCode2','dxCode3','dxCode4'] as const).map((k, i) => (
                            <input key={k} value={(editData as any)[k] || ''} onChange={e => setField(k, e.target.value)} placeholder={`Dx ${i + 1}`} className={inp} />
                          ))}
                        </div>
                      </div>
                      <div><label className={lbl}>PA #</label><input value={editData.paNumber || ''} onChange={e => setField('paNumber', e.target.value)} className={inp} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className={lbl}>PA Start</label><input value={editData.paStartDate || ''} onChange={e => setField('paStartDate', e.target.value)} placeholder="YYYY-MM-DD" className={inp} /></div>
                        <div><label className={lbl}>PA End</label><input value={editData.paEndDate || ''} onChange={e => setField('paEndDate', e.target.value)} placeholder="YYYY-MM-DD" className={inp} /></div>
                      </div>
                      <div>
                        <label className={lbl}>Network Status</label>
                        <div className="flex gap-2">
                          {['IN', 'OON'].map(s => (
                            <button key={s} type="button" onClick={() => setField('networkStatus', editData.networkStatus === s ? '' : s)}
                              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition ${editData.networkStatus === s ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'border-[#D9E1E8] text-[#7A8F79] hover:bg-[#F4F6F5]'}`}>
                              {s === 'IN' ? 'In-Network' : 'Out-of-Network'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="crEdit" checked={!!editData.hasCaseRate} onChange={e => setField('hasCaseRate', e.target.checked)} className="accent-[#7A8F79] w-4 h-4" />
                        <label htmlFor="crEdit" className="text-sm text-[#2F3E4E] font-semibold cursor-pointer">Agreed case rate</label>
                      </div>
                      {editData.hasCaseRate && (
                        <div><label className={lbl}>Case Rate Amount</label><input value={editData.caseRateAmount || ''} onChange={e => setField('caseRateAmount', e.target.value)} placeholder="e.g. $125.00 / day" className={inp} /></div>
                      )}
                      <div>
                        <label className={lbl}>Policy Notes</label>
                        <textarea value={editData.policyNotes || ''} onChange={e => setField('policyNotes', e.target.value)} rows={2}
                          placeholder="e.g. Primary plan covers first 100 days only…"
                          className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="flex-1 bg-[#2F3E4E] text-white py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button type="button" onClick={() => { setEditing(false); setEditData({ ...selected }) }} className="flex-1 border border-[#D9E1E8] text-[#7A8F79] py-2 rounded-xl text-sm hover:bg-[#F4F6F5] transition">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2 pb-1 border-b border-[#D9E1E8]">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-[#7A8F79] w-24 shrink-0">{label}</span>
      <span className="text-[#2F3E4E]">{value}</span>
    </div>
  )
}
