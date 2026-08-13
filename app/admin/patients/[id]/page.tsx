'use client'

import { useEffect, useState, use } from 'react'
import PatientDetailShell from '../../../components/patient/PatientDetailShell'
import PatientDemographics from '../../../components/patient/PatientDemographics'
import PatientInsurance from '../../../components/patient/PatientInsurance'
import PatientMedications from '../../../components/patient/PatientMedications'
import PatientDocuments from '../../../components/patient/PatientDocuments'
import PatientCareTeam, { NurseLink, GuardianLink } from '../../../components/patient/PatientCareTeam'
import PatientNotifications from '../../../components/patient/PatientNotifications'
import PatientPriorAuthHistory, { PatientPA } from '../../../components/patient/PatientPriorAuthHistory'
import { DetailTab } from '../../../components/patient/PatientTabs'
import { PatientFields } from '../../../components/patient/types'
import { MedicationDTO, MedicationInput, PharmacyOption } from '../../../components/MedicationList'
import { GuardianInviteData } from '../../../components/GuardianInviteModal'

type Nurse = { id: string; displayName: string; firstName?: string; lastName?: string; accountNumber: string | null }

type Patient = PatientFields & {
  id: string
  nurseLinks: NurseLink[]
  guardianLinks: GuardianLink[]
  priorAuths: PatientPA[]
  medications: MedicationDTO[]
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminPatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [nurses, setNurses] = useState<Nurse[]>([])
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([])
  const [adminUserId, setAdminUserId] = useState('')

  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<Patient>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [locking, setLocking] = useState(false)

  function loadPatient() {
    return fetch(`/api/admin/patients/${id}`, { credentials: 'include' })
      .then(async r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return }
        const body = await r.json()
        setPatient(body.patient)
        setEditData({ ...body.patient })
        setLoading(false)
      })
  }

  useEffect(() => {
    loadPatient()
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.id) setAdminUserId(data.id) })
      .catch(() => {})
    fetch('/api/admin/nurses', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setNurses(data) })
    fetch('/api/pharmacies', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPharmacies(data) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function setField(k: string, v: any) {
    setEditData(d => ({ ...d, [k]: v }))
  }

  async function handleSave() {
    if (!patient) return
    setSaving(true); setMsg('')
    const res = await fetch(`/api/admin/patients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(editData),
    })
    setSaving(false)
    if (res.ok) {
      setPatient(p => p ? { ...p, ...editData } as Patient : p)
      setEditing(false)
      setMsg('Saved.')
    } else {
      const body = await res.json().catch(() => ({}))
      setMsg(body.error ? `Save failed: ${body.error}` : 'Save failed.')
    }
  }

  async function handleAssign(nurseId: string) {
    setMsg('')
    const res = await fetch(`/api/admin/patients/${id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nurseId }),
    })
    if (res.ok) {
      await loadPatient()
      setMsg('Nurse linked.')
    } else {
      setMsg('Assignment failed.')
    }
  }

  async function handleUnlink(nurseId: string) {
    setMsg('')
    const res = await fetch(`/api/admin/patients/${id}/assign`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nurseId }),
    })
    if (res.ok) {
      await loadPatient()
      setMsg('Unlinked.')
    }
  }

  async function handleInviteGuardian(data: GuardianInviteData) {
    const res = await fetch(`/api/admin/patients/${id}/guardians`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    const body = await res.json()
    return res.ok ? { ok: true } : { ok: false, error: body.error }
  }

  async function handleUnlinkGuardian(userId: string) {
    setMsg('')
    const res = await fetch(`/api/admin/patients/${id}/guardians`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      await loadPatient()
      setMsg('Unlinked.')
    }
  }

  async function refreshMedications() {
    const res = await fetch(`/api/admin/patients/${id}`, { credentials: 'include' })
    const body = await res.json()
    if (body.patient) setPatient(p => p ? { ...p, medications: body.patient.medications } : p)
  }

  async function handleAddMedication(data: MedicationInput) {
    await fetch(`/api/admin/patients/${id}/medications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    await refreshMedications()
  }

  async function handleEditMedication(medId: string, data: MedicationInput) {
    await fetch(`/api/admin/patients/${id}/medications`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medId, ...data }),
    })
    await refreshMedications()
  }

  async function handleConfirmRefill(medId: string, refillDate: string, daySupply: string) {
    await fetch(`/api/admin/patients/${id}/medications/refill`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medId, refillDate, daySupply }),
    })
    await refreshMedications()
  }

  async function handleOrderRefill(medId: string, orderedDate: string) {
    await fetch(`/api/admin/patients/${id}/medications/order`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medId, orderedDate }),
    })
    await refreshMedications()
  }

  async function handleDeleteMedication(medId: string) {
    await fetch(`/api/admin/patients/${id}/medications`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medId }),
    })
    await refreshMedications()
  }

  async function refreshPAs() {
    const res = await fetch(`/api/admin/patients/${id}`, { credentials: 'include' })
    const body = await res.json()
    if (body.patient) setPatient(p => p ? { ...p, priorAuths: body.patient.priorAuths } : p)
  }

  async function handleAddPA(pa: { paNumber: string; paStartDate: string; paEndDate: string; highTech: boolean }) {
    const res = await fetch(`/api/admin/patients/${id}/pa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(pa),
    })
    if (res.ok) {
      await refreshPAs()
      return { ok: true }
    }
    const d = await res.json()
    return { ok: false, error: d.error || 'Failed to save.' }
  }

  async function handleEditPA(paId: string, pa: { paNumber: string; paStartDate: string; paEndDate: string; highTech: boolean }) {
    const res = await fetch(`/api/admin/patients/${id}/pa`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ paId, ...pa }),
    })
    if (res.ok) {
      await refreshPAs()
      return { ok: true }
    }
    const d = await res.json()
    return { ok: false, error: d.error || 'Failed to save.' }
  }

  async function handleDeletePA(paId: string) {
    await fetch(`/api/admin/patients/${id}/pa`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ paId }),
    })
    await refreshPAs()
  }

  async function handleToggleDocumentReminders(val: boolean) {
    await fetch(`/api/admin/patients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ documentRemindersEnabled: val }),
    })
    setPatient(p => p ? { ...p, documentRemindersEnabled: val } : p)
  }

  async function handleTogglePaReminders(val: boolean) {
    await fetch(`/api/admin/patients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ paRemindersEnabled: val }),
    })
    setPatient(p => p ? { ...p, paRemindersEnabled: val } : p)
  }

  async function handleLock() {
    setLocking(true)
    const res = await fetch(`/api/admin/patients/${id}/lock`, { method: 'POST', credentials: 'include' })
    setLocking(false)
    if (res.ok) await loadPatient()
  }

  async function handleUnlockRecord() {
    setLocking(true)
    const res = await fetch(`/api/admin/patients/${id}/lock`, { method: 'DELETE', credentials: 'include' })
    setLocking(false)
    if (res.ok) await loadPatient()
  }

  if (loading) {
    return <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6"><p className="text-sm text-[#7A8F79]">Loading…</p></div>
  }

  if (notFound || !patient) {
    return (
      <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-md mx-auto">
          <p className="text-[#2F3E4E] font-semibold">Patient not found</p>
          <a href="/admin/patients" className="inline-block mt-4 text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E]">← Back to adPatients</a>
        </div>
      </div>
    )
  }

  const banners = (
    <>
      <div className="flex items-center gap-2 mt-3">
        {patient.isLocked ? (
          <button onClick={handleUnlockRecord} disabled={locking}
            className="text-xs font-semibold text-red-600 border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition disabled:opacity-40">
            {locking ? '…' : 'Unlock Record'}
          </button>
        ) : (
          <button onClick={handleLock} disabled={locking}
            className="text-xs font-semibold text-amber-700 border border-amber-200 bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition disabled:opacity-40">
            {locking ? '…' : 'Lock Record'}
          </button>
        )}
        {!editing && (
          <button onClick={() => { setEditing(true); setEditData({ ...patient }) }}
            className="text-xs font-semibold text-[#7A8F79] border border-[#D9E1E8] px-3 py-1.5 rounded-lg hover:bg-[#F4F6F5] transition">
            Edit
          </button>
        )}
      </div>

      {patient.isLocked && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
          <p className="text-xs font-bold text-red-700">Record Locked — Nurse editing disabled</p>
          <p className="text-[10px] text-red-500 mt-0.5">
            Locked by {patient.lockedBy || 'admin'}{patient.lockedAt ? ` on ${fmtDate(patient.lockedAt)}` : ''}
          </p>
        </div>
      )}

      {msg && (
        <p className={`mt-3 text-xs font-semibold px-3 py-2 rounded-lg ${msg.includes('failed') || msg.includes('Failed') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{msg}</p>
      )}
    </>
  )

  const activeData = editing ? editData : patient

  function handleCancelEdit() {
    setEditData({ ...patient! })
    setEditing(false)
  }

  const editControls = editing && (
    <div className="flex items-center gap-3 mt-3">
      <button onClick={handleSave} disabled={saving} className="bg-[#2F3E4E] text-white px-6 py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
      <button onClick={handleCancelEdit} className="border border-[#D9E1E8] text-[#7A8F79] px-6 py-2 rounded-xl text-sm font-semibold hover:bg-[#F4F6F5] transition">
        Cancel
      </button>
    </div>
  )

  const tabs: { key: DetailTab; label: string; content: React.ReactNode }[] = [
    {
      key: 'demographics', label: 'Demographics', content: (
        <>
          <PatientDemographics data={activeData} readOnly={false} editing={editing} onEdit={() => { setEditing(true); setEditData({ ...patient }) }} setField={setField} />
          {editControls}
        </>
      ),
    },
    {
      key: 'insurance', label: 'Insurance', content: (
        <>
          <PatientInsurance data={activeData} readOnly={false} editing={editing} onEdit={() => { setEditing(true); setEditData({ ...patient }) }} setField={setField} />
          {editControls}
          <div className="bg-white rounded-2xl shadow-sm p-6 mt-5">
            <PatientPriorAuthHistory priorAuths={patient.priorAuths} canEdit onAdd={handleAddPA} onEdit={handleEditPA} onDelete={handleDeletePA} />
          </div>
        </>
      ),
    },
    {
      key: 'medications', label: 'Medications', content: (
        <PatientMedications
          patientName={`${patient.firstName} ${patient.lastName}`}
          medications={patient.medications || []}
          onAdd={handleAddMedication}
          onEdit={handleEditMedication}
          onConfirmRefill={handleConfirmRefill}
          onOrderRefill={handleOrderRefill}
          onDelete={handleDeleteMedication}
          pharmacies={pharmacies}
        />
      ),
    },
    {
      key: 'documents', label: 'Documents', content: (
        <PatientDocuments
          patientId={id}
          basePath={`/api/admin/patients/${id}/documents`}
          canDeleteAny
          uploaderId={adminUserId}
        />
      ),
    },
    {
      key: 'careTeam', label: 'Care Team', content: (
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <PatientCareTeam
            patientName={`${patient.firstName} ${patient.lastName}`}
            nurseLinks={patient.nurseLinks}
            guardianLinks={patient.guardianLinks}
            canManageAssignment
            availableNurses={nurses}
            onAssign={handleAssign}
            onUnlink={handleUnlink}
            onUnlinkGuardian={handleUnlinkGuardian}
            onInviteGuardian={handleInviteGuardian}
          />
        </div>
      ),
    },
    {
      key: 'reminders', label: 'Notifications & Reminders', content: (
        <PatientNotifications
          role="admin"
          medicationStatuses={[
            ...patient.nurseLinks.filter(l => l.isActive).map(l => ({
              name: l.nurse.lastName || l.nurse.displayName,
              optedIn: !!(l as any).medicationRemindersOptIn,
            })),
            ...patient.guardianLinks.map(g => ({
              name: g.user.name,
              optedIn: !!(g as any).medicationRemindersOptIn,
            })),
          ]}
          documentRemindersEnabled={patient.documentRemindersEnabled}
          paRemindersEnabled={patient.paRemindersEnabled}
          onToggleDocumentReminders={handleToggleDocumentReminders}
          onTogglePaReminders={handleTogglePaReminders}
        />
      ),
    },
  ]

  return (
    <PatientDetailShell
      backHref="/admin/patients"
      backLabel="← adPatients"
      headerName={`${patient.lastName}, ${patient.firstName}`}
      headerAccountNumber={patient.accountNumber}
      banners={banners}
      tabs={tabs}
    />
  )
}
