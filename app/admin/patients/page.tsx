'use client'

import { useState, useEffect } from 'react'
import AdminNav from '../../components/AdminNav'
import { formalName } from '../../../lib/formatName'

type PatientPA = {
  id: string
  paNumber: string
  paStartDate: string | null
  paEndDate: string | null
  highTech: boolean
  createdAt: string
}

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
  isLocked: boolean
  lockedAt: string | null
  lockedBy: string | null
  nurseLinks: NurseLink[]
  priorAuths: PatientPA[]
  _count: { timeEntries: number }
}

type Nurse = { id: string; displayName: string; firstName?: string; lastName?: string; accountNumber: string | null }

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

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

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

  // PA history state
  const [showAddPA, setShowAddPA] = useState(false)
  const [newPA, setNewPA] = useState({ paNumber: '', paStartDate: '', paEndDate: '', highTech: false })
  const [savingPA, setSavingPA] = useState(false)
  const [paError, setPaError] = useState('')

  // Create modal state
  const [showCreate, setShowCreate] = useState(false)
  const [createInsType, setCreateInsType] = useState<'Medicaid' | 'Commercial'>('Medicaid')
  const [createData, setCreateData] = useState(blankCreate())
  const [createPA, setCreatePA] = useState({ paNumber: '', paStartDate: '', paEndDate: '', highTech: false })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Lock state
  const [locking, setLocking] = useState(false)
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
    setShowAddPA(false)
    setNewPA({ paNumber: '', paStartDate: '', paEndDate: '', highTech: false })
    setPaError('')
  }

  function setField(k: string, v: any) {
    setEditData(d => ({ ...d, [k]: v }))
  }

  function setCreateField(k: string, v: any) {
    setCreateData(d => ({ ...d, [k]: v }))
  }

  function openCreate() {
    setCreateData(blankCreate())
    setCreatePA({ paNumber: '', paStartDate: '', paEndDate: '', highTech: false })
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

  async function refreshPAs(patientId: string) {
    const refreshed = await fetch(`/api/admin/patients/${patientId}`, { credentials: 'include' }).then(r => r.json())
    if (refreshed.patient) {
      setSelected(refreshed.patient)
      setPatients(prev => prev.map(p => p.id === patientId ? { ...p, priorAuths: refreshed.patient.priorAuths } : p))
    }
  }

  async function handleAddPA(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !newPA.paNumber.trim()) return
    setSavingPA(true); setPaError('')
    const res = await fetch(`/api/admin/patients/${selected.id}/pa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(newPA),
    })
    setSavingPA(false)
    if (res.ok) {
      await refreshPAs(selected.id)
      setNewPA({ paNumber: '', paStartDate: '', paEndDate: '', highTech: false })
      setShowAddPA(false)
    } else {
      const d = await res.json()
      setPaError(d.error || 'Failed to save.')
    }
  }

  async function handleDeletePA(paId: string) {
    if (!selected) return
    await fetch(`/api/admin/patients/${selected.id}/pa`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ paId }),
    })
    await refreshPAs(selected.id)
  }

  async function handleLock() {
    if (!selected) return
    setLocking(true)
    const res = await fetch(`/api/admin/patients/${selected.id}/lock`, {
      method: 'POST',
      credentials: 'include',
    })
    setLocking(false)
    if (res.ok) {
      const refreshed = await fetch(`/api/admin/patients/${selected.id}`, { credentials: 'include' }).then(r => r.json())
      if (refreshed.patient) {
        setSelected(refreshed.patient)
        setPatients(prev => prev.map(p => p.id === selected.id ? { ...p, isLocked: true, lockedBy: refreshed.patient.lockedBy, lockedAt: refreshed.patient.lockedAt } : p))
      }
    }
  }

  async function handleUnlockRecord() {
    if (!selected) return
    setLocking(true)
    const res = await fetch(`/api/admin/patients/${selected.id}/lock`, {
      method: 'DELETE',
      credentials: 'include',
    })
    setLocking(false)
    if (res.ok) {
      setSelected(prev => prev ? { ...prev, isLocked: false, lockedBy: null, lockedAt: null } : prev)
      setPatients(prev => prev.map(p => p.id === selected.id ? { ...p, isLocked: false, lockedBy: null, lockedAt: null } : p))
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
      <AdminNav />

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
                  onClick={() => openPatient(p)}
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

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setSelected(null)}>
          <div
            className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[#D9E1E8] sticky top-0 bg-white z-10">
              <div>
                <p className="text-lg font-bold text-[#2F3E4E] uppercase">{selected.lastName}, {selected.firstName}</p>
                <p className="text-xs font-mono text-[#7A8F79]">{selected.accountNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                {selected.isLocked ? (
                  <button
                    onClick={handleUnlockRecord}
                    disabled={locking}
                    className="text-xs font-semibold text-red-600 border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition disabled:opacity-40"
                  >
                    {locking ? '…' : 'Unlock Record'}
                  </button>
                ) : (
                  <button
                    onClick={handleLock}
                    disabled={locking}
                    className="text-xs font-semibold text-amber-700 border border-amber-200 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition disabled:opacity-40"
                  >
                    {locking ? '…' : 'Lock Record'}
                  </button>
                )}
                {!editing && (
                  <button onClick={() => setEditing(true)} className="text-xs font-semibold text-[#7A8F79] border border-[#D9E1E8] px-3 py-1.5 rounded-lg hover:bg-[#F4F6F5] transition">
                    Edit
                  </button>
                )}
                <button onClick={() => setSelected(null)} className="text-[#7A8F79] hover:text-[#2F3E4E] text-xl leading-none ml-1">✕</button>
              </div>
            </div>

            {/* Lock status banner */}
            {selected.isLocked && (
              <div className="mx-5 mt-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <p className="text-xs font-bold text-red-700">Record Locked — Nurse editing disabled</p>
                <p className="text-[10px] text-red-500 mt-0.5">
                  Locked by {selected.lockedBy || 'admin'}{selected.lockedAt ? ` on ${fmtDate(selected.lockedAt)}` : ''}
                </p>
              </div>
            )}

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
                        <span className="text-sm text-[#2F3E4E] font-semibold">{l.nurse.lastName || l.nurse.displayName}</span>
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
                        <option key={n.id} value={n.id}>{formalName(n) || n.displayName}{n.accountNumber ? ` (${n.accountNumber})` : ''}</option>
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
                    <Row label="Name" value={`${selected.firstName} ${selected.lastName}`.toUpperCase()} />
                    <Row label="DOB" value={selected.dob} />
                    <Row label="Sex" value={selected.gender} />
                    <Row label="Phone" value={selected.phone} />
                    <Row label="High-Tech" value={selected.highTech ? 'Yes' : 'No'} />
                  </Section>
                  <Section title="Primary Insurance">
                    <Row label="Type" value={selected.insuranceType} />
                    <Row label="Member ID" value={selected.insuranceId} />
                    {selected.insuranceName && <Row label="Carrier" value={selected.insuranceName} />}
                    {selected.insuranceGroup && <Row label="Group #" value={selected.insuranceGroup} />}
                    {selected.insurancePlan && <Row label="Plan" value={selected.insurancePlan} />}
                    {selected.subscriberName && <Row label="Subscriber" value={selected.subscriberName} />}
                    {selected.subscriberRelation && <Row label="Relation" value={selected.subscriberRelation} />}
                  </Section>
                  {(selected.ins2Type || selected.ins2Id) && (
                    <Section title="Additional Coverage">
                      {selected.ins2Type && <Row label="Type" value={selected.ins2Type} />}
                      {selected.ins2Id && <Row label="Member ID" value={selected.ins2Id} />}
                      {selected.ins2Name && <Row label="Carrier" value={selected.ins2Name} />}
                      {selected.ins2Group && <Row label="Group #" value={selected.ins2Group} />}
                      {selected.ins2Plan && <Row label="Plan" value={selected.ins2Plan} />}
                      {selected.ins2SubscriberName && <Row label="Subscriber" value={selected.ins2SubscriberName} />}
                      {selected.ins2SubscriberRelation && <Row label="Relation" value={selected.ins2SubscriberRelation} />}
                      {selected.ins2NetworkStatus && <Row label="Network" value={selected.ins2NetworkStatus} />}
                      {selected.ins2HasCaseRate && <Row label="Case Rate" value={selected.ins2CaseRateAmount || 'Yes'} />}
                      {selected.ins2PolicyNotes && <Row label="Policy Notes" value={selected.ins2PolicyNotes} />}
                    </Section>
                  )}
                  {selected.address && (
                    <Section title="Address">
                      <Row label="Street" value={selected.address} />
                      <Row label="City" value={`${selected.city || ''}, ${selected.state || ''} ${selected.zip || ''}`.trim()} />
                    </Section>
                  )}
                  <Section title="Clinical">
                    <Row label="Dx Codes" value={[selected.dxCode1, selected.dxCode2, selected.dxCode3, selected.dxCode4].filter(Boolean).join(', ') || '—'} />
                    {selected.networkStatus && <Row label="Network" value={selected.networkStatus} />}
                    {selected.hasCaseRate && <Row label="Case Rate" value={selected.caseRateAmount || 'Yes'} />}
                    {selected.policyNotes && <Row label="Policy Notes" value={selected.policyNotes} />}
                  </Section>

                  {/* Prior Authorization History */}
                  <div>
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-[#D9E1E8]">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E]">Prior Authorization History</p>
                      <button onClick={() => { setShowAddPA(v => !v); setPaError('') }}
                        className="text-[10px] font-semibold text-[#7A8F79] border border-[#D9E1E8] px-2 py-0.5 rounded hover:bg-[#F4F6F5] transition">
                        {showAddPA ? 'Cancel' : '+ Add PA'}
                      </button>
                    </div>

                    {showAddPA && (
                      <form onSubmit={handleAddPA} className="bg-[#F4F6F5] rounded-xl p-3 mb-3 space-y-2">
                        <div>
                          <label className={lbl}>PA Number</label>
                          <input required value={newPA.paNumber} onChange={e => setNewPA(p => ({ ...p, paNumber: e.target.value }))}
                            placeholder="Authorization number" className={inp} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={lbl}>Start Date</label>
                            <input type="date" value={newPA.paStartDate} onChange={e => setNewPA(p => ({ ...p, paStartDate: e.target.value }))} className={inp} />
                          </div>
                          <div>
                            <label className={lbl}>End Date</label>
                            <input type="date" value={newPA.paEndDate} onChange={e => setNewPA(p => ({ ...p, paEndDate: e.target.value }))} className={inp} />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={newPA.highTech} onChange={e => setNewPA(p => ({ ...p, highTech: e.target.checked }))} className="accent-[#7A8F79] w-4 h-4" />
                          <span className="text-sm text-[#2F3E4E] font-semibold">High-Tech designation</span>
                        </label>
                        {paError && <p className="text-xs text-red-500">{paError}</p>}
                        <button type="submit" disabled={savingPA}
                          className="w-full bg-[#2F3E4E] text-white text-sm font-semibold py-1.5 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50">
                          {savingPA ? 'Saving…' : 'Save PA'}
                        </button>
                      </form>
                    )}

                    {(selected.priorAuths || []).length === 0 ? (
                      <p className="text-xs text-[#7A8F79] italic">No prior authorizations on file.</p>
                    ) : (
                      <div className="space-y-2">
                        {(selected.priorAuths || []).map((pa, i) => {
                          const today = new Date().toISOString().slice(0, 10)
                          const isActive = !pa.paEndDate || pa.paEndDate >= today
                          return (
                            <div key={pa.id} className={`rounded-xl border px-3 py-2.5 ${i === 0 ? 'border-[#7A8F79] bg-[#f4f9f4]' : 'border-[#D9E1E8]'}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-[#2F3E4E] font-mono uppercase">{pa.paNumber}</span>
                                    {i === 0 && <span className="text-[9px] font-bold uppercase bg-[#7A8F79] text-white px-1.5 py-0.5 rounded-full">Current</span>}
                                    {pa.highTech && <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Hi-Tech</span>}
                                    {!isActive && i !== 0 && <span className="text-[9px] font-bold uppercase bg-[#F4F6F5] text-[#7A8F79] px-1.5 py-0.5 rounded-full">Expired</span>}
                                  </div>
                                  <p className="text-[10px] text-[#7A8F79] mt-0.5">
                                    {pa.paStartDate || '?'} — {pa.paEndDate || 'Present'}
                                  </p>
                                </div>
                                <button onClick={() => handleDeletePA(pa.id)}
                                  className="text-[10px] text-red-400 hover:text-red-600 font-semibold shrink-0 transition">
                                  Remove
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <form onSubmit={handleSave} className="space-y-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Demographics</p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className={lbl}>First Name</label><input value={editData.firstName || ''} onChange={e => setField('firstName', e.target.value.toUpperCase())} className={`${inp} uppercase`} /></div>
                        <div><label className={lbl}>Last Name</label><input value={editData.lastName || ''} onChange={e => setField('lastName', e.target.value.toUpperCase())} className={`${inp} uppercase`} /></div>
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
                    <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Primary Insurance</p>
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

                  {/* ── Additional Coverage ── */}
                  <AdditionalInsuranceEdit editData={editData} setField={setField} inp={inp} lbl={lbl} />

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
                      <p className="text-[10px] text-[#7A8F79] italic">Manage prior authorizations in the PA History section above.</p>
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
                        <input type="date" required value={createData.dob} onChange={e => setCreateField('dob', e.target.value)} className={inp} />
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
                      <input value={createData.phone} onChange={e => setCreateField('phone', e.target.value)} placeholder="(555) 000-0000" className={inp} />
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

                {/* Initial PA (optional) */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">
                    Prior Authorization <span className="normal-case font-normal text-[#aab]">(optional)</span>
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className={lbl}>PA Number</label>
                      <input value={createPA.paNumber} onChange={e => setCreatePA(p => ({ ...p, paNumber: e.target.value }))} placeholder="Authorization number" className={inp} />
                    </div>
                    {createPA.paNumber.trim() && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={lbl}>Start Date</label>
                            <input type="date" value={createPA.paStartDate} onChange={e => setCreatePA(p => ({ ...p, paStartDate: e.target.value }))} className={inp} />
                          </div>
                          <div>
                            <label className={lbl}>End Date</label>
                            <input type="date" value={createPA.paEndDate} onChange={e => setCreatePA(p => ({ ...p, paEndDate: e.target.value }))} className={inp} />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={createPA.highTech} onChange={e => setCreatePA(p => ({ ...p, highTech: e.target.checked }))} className="accent-[#7A8F79] w-4 h-4" />
                          <span className="text-sm text-[#2F3E4E] font-semibold">High-Tech designation</span>
                        </label>
                      </>
                    )}
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

function AdditionalInsuranceEdit({
  editData, setField, inp, lbl,
}: {
  editData: Partial<Patient>
  setField: (k: string, v: any) => void
  inp: string
  lbl: string
}) {
  const [open, setOpen] = useState(!!(editData.ins2Type || editData.ins2Id))
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest text-[#2F3E4E] pb-1 border-b border-[#D9E1E8] mb-3 hover:text-[#7A8F79] transition"
      >
        <span>Additional Coverage</span>
        <span className="text-[#7A8F79] font-normal normal-case tracking-normal">
          {open ? '▲ hide' : (editData.ins2Type || editData.ins2Id ? '▼ edit' : '▼ + add coverage')}
        </span>
      </button>
      {open && (
        <div className="space-y-3">
          <div>
            <label className={lbl}>Insurance Type</label>
            <select value={editData.ins2Type || ''} onChange={e => setField('ins2Type', e.target.value || null)} className={inp}>
              <option value="">— None —</option>
              <option>Medicaid</option><option>Commercial</option><option>Medicare</option><option>Other</option>
            </select>
          </div>
          {editData.ins2Type && (<>
            <div><label className={lbl}>Member ID</label><input value={editData.ins2Id || ''} onChange={e => setField('ins2Id', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Carrier Name</label><input value={editData.ins2Name || ''} onChange={e => setField('ins2Name', e.target.value)} className={inp} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Group #</label><input value={editData.ins2Group || ''} onChange={e => setField('ins2Group', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Plan</label><input value={editData.ins2Plan || ''} onChange={e => setField('ins2Plan', e.target.value)} className={inp} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Subscriber Name</label><input value={editData.ins2SubscriberName || ''} onChange={e => setField('ins2SubscriberName', e.target.value)} className={inp} /></div>
              <div>
                <label className={lbl}>Relation</label>
                <select value={editData.ins2SubscriberRelation || ''} onChange={e => setField('ins2SubscriberRelation', e.target.value)} className={inp}>
                  <option value="">Select…</option>
                  {['Self','Spouse','Child','Parent','Other'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={lbl}>Network Status</label>
              <div className="flex gap-2">
                {['IN','OON'].map(s => (
                  <button key={s} type="button" onClick={() => setField('ins2NetworkStatus', editData.ins2NetworkStatus === s ? null : s)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition ${editData.ins2NetworkStatus === s ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'border-[#D9E1E8] text-[#7A8F79] hover:bg-[#F4F6F5]'}`}>
                    {s === 'IN' ? 'In-Network' : 'Out-of-Network'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="cr2Edit" checked={!!editData.ins2HasCaseRate} onChange={e => setField('ins2HasCaseRate', e.target.checked)} className="accent-[#7A8F79] w-4 h-4" />
              <label htmlFor="cr2Edit" className="text-sm text-[#2F3E4E] font-semibold cursor-pointer">Agreed case rate</label>
            </div>
            {editData.ins2HasCaseRate && (
              <div><label className={lbl}>Case Rate Amount</label><input value={editData.ins2CaseRateAmount || ''} onChange={e => setField('ins2CaseRateAmount', e.target.value)} placeholder="e.g. $125.00 / day" className={inp} /></div>
            )}
            <div>
              <label className={lbl}>Policy Notes</label>
              <textarea value={editData.ins2PolicyNotes || ''} onChange={e => setField('ins2PolicyNotes', e.target.value)} rows={2}
                placeholder="e.g. Secondary covers remainder after primary…"
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
            </div>
            <button type="button" onClick={() => {
              ['ins2Type','ins2Id','ins2Name','ins2Group','ins2Plan','ins2SubscriberName','ins2SubscriberRelation','ins2NetworkStatus','ins2CaseRateAmount','ins2PolicyNotes'].forEach(k => setField(k, null))
              setField('ins2HasCaseRate', false)
              setOpen(false)
            }} className="text-xs text-red-400 hover:text-red-600 transition font-semibold">
              Remove additional coverage
            </button>
          </>)}
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
