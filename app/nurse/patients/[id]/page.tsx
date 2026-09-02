'use client'

import { useEffect, useState, use } from 'react'
import PatientDetailShell from '../../../components/patient/PatientDetailShell'
import PatientDemographics from '../../../components/patient/PatientDemographics'
import PatientInsurance from '../../../components/patient/PatientInsurance'
import PatientMedications from '../../../components/patient/PatientMedications'
import PatientMedicationMAR, { MarRosterEntry } from '../../../components/patient/PatientMedicationMAR'
import PatientTreatmentTAR from '../../../components/patient/PatientTreatmentTAR'
import PatientDocuments from '../../../components/patient/PatientDocuments'
import PatientOrders from '../../../components/patient/PatientOrders'
import PatientCareTeam, { NurseLink, GuardianLink } from '../../../components/patient/PatientCareTeam'
import PatientNotifications from '../../../components/patient/PatientNotifications'
import PatientPriorAuthHistory, { PatientPA } from '../../../components/patient/PatientPriorAuthHistory'
import ProgressNoteList from '../../../components/patient/ProgressNoteList'
import { DetailTab } from '../../../components/patient/PatientTabs'
import { PatientFields } from '../../../components/patient/types'
import { MedicationDTO, MedicationInput, PharmacyOption } from '../../../components/MedicationList'
import { GuardianInviteData } from '../../../components/GuardianInviteModal'

type LinkedPatient = {
  linkId: string
  patientId: string
  overrides: Record<string, any> | null
  medicationRemindersOptIn: boolean
  merged: PatientFields
  priorAuths: PatientPA[]
  medications: MedicationDTO[]
  nurseLinks: NurseLink[]
  guardianLinks: GuardianLink[]
}

export default function NursePatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [patient, setPatient] = useState<LinkedPatient | null>(null)
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([])
  const [nurseUserId, setNurseUserId] = useState('')

  function loadPatient() {
    return fetch(`/api/nurse/patients/${id}`, { credentials: 'include' })
      .then(async r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return }
        const body = await r.json()
        setPatient(body.patient)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadPatient()
    fetch('/api/nurse/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data.user?.id) setNurseUserId(data.user.id) })
    fetch('/api/pharmacies', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPharmacies(data) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function refreshMedications() {
    const res = await fetch(`/api/nurse/patients/${id}/medications`, { credentials: 'include' })
    const data = await res.json()
    setPatient(p => p ? { ...p, medications: data.medications || [] } : p)
  }

  async function handleAddMedication(data: MedicationInput) {
    await fetch(`/api/nurse/patients/${id}/medications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    await refreshMedications()
  }

  async function handleEditMedication(medId: string, data: MedicationInput) {
    await fetch(`/api/nurse/patients/${id}/medications`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medId, ...data }),
    })
    await refreshMedications()
  }

  async function handleConfirmRefill(medId: string, refillDate: string, daySupply: string) {
    await fetch(`/api/nurse/patients/${id}/medications/refill`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medId, refillDate, daySupply }),
    })
    await refreshMedications()
  }

  // "Enough on hand, no need to reorder this cycle" — resets the due-date
  // window like a normal refill but skipCount:true tells the route not to
  // decrement refillsRemaining, since no pharmacy refill actually happened.
  async function handleSkipRefill(medId: string, refillDate: string, daySupply: string) {
    await fetch(`/api/nurse/patients/${id}/medications/refill`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medId, refillDate, daySupply, skipCount: true }),
    })
    await refreshMedications()
  }

  async function handleOrderRefill(medId: string, orderedDate: string) {
    await fetch(`/api/nurse/patients/${id}/medications/order`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medId, orderedDate }),
    })
    await refreshMedications()
  }

  async function handleDeleteMedication(medId: string) {
    await fetch(`/api/nurse/patients/${id}/medications`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medId }),
    })
    await refreshMedications()
  }

  async function refreshPAs() {
    const res = await fetch(`/api/nurse/patients/${id}/pa`, { credentials: 'include' })
    const data = await res.json()
    setPatient(p => p ? { ...p, priorAuths: data.priorAuths || [] } : p)
  }

  async function handleAddPA(pa: { paNumber: string; paStartDate: string; paEndDate: string; highTech: boolean }) {
    const res = await fetch(`/api/nurse/patients/${id}/pa`, {
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
    const res = await fetch(`/api/nurse/patients/${id}/pa`, {
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
    await fetch(`/api/nurse/patients/${id}/pa`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ paId }),
    })
    await refreshPAs()
  }

  async function handleToggleMedicationReminders(val: boolean) {
    await fetch(`/api/nurse/patients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medicationRemindersOptIn: val }),
    })
    setPatient(p => p ? { ...p, medicationRemindersOptIn: val } : p)
  }

  async function handleInviteGuardian(data: GuardianInviteData) {
    const res = await fetch(`/api/nurse/patients/${id}/guardians`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    const body = await res.json()
    return res.ok ? { ok: true } : { ok: false, error: body.error }
  }

  if (loading) {
    return <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0"><p className="text-sm text-[#7A8F79]">Loading…</p></div>
  }

  if (notFound || !patient) {
    return (
      <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-md mx-auto">
          <p className="text-[#2F3E4E] font-semibold">Patient not found</p>
          <a href="/nurse/patients" className="inline-block mt-4 text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E]">← Back to myPatients</a>
        </div>
      </div>
    )
  }

  const merged = patient.merged

  const marRoster: MarRosterEntry[] = [
    ...patient.nurseLinks.filter(l => l.isActive).map(l => ({ userId: l.nurse.userId, name: l.nurse.firstName && l.nurse.lastName ? `${l.nurse.firstName} ${l.nurse.lastName}` : l.nurse.displayName, role: 'nurse' as const })),
    ...patient.guardianLinks.map(g => ({ userId: g.user.id, name: g.user.name, role: 'guardian' as const })),
  ]

  const banners = merged.isLocked ? (
    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
      <p className="text-xs font-bold text-amber-800">Record Locked — View Only</p>
      <p className="text-[10px] text-amber-600 mt-0.5">
        Locked by {merged.lockedBy || 'admin'}. Contact your administrator to make changes.
      </p>
    </div>
  ) : null

  const tabs: { key: DetailTab; label: string; content: React.ReactNode }[] = [
    {
      key: 'demographics', label: 'Demographics', content: (
        <PatientDemographics data={merged} readOnly editing={false} onEdit={() => {}} setField={() => {}} />
      ),
    },
    {
      key: 'insurance', label: 'Insurance', content: (
        <>
          <PatientInsurance data={merged} readOnly editing={false} onEdit={() => {}} setField={() => {}} priorAuths={patient.priorAuths} />
          <div className="bg-white rounded-2xl shadow-sm p-6 mt-5">
            <PatientPriorAuthHistory priorAuths={patient.priorAuths} canEdit={!merged.isLocked} onAdd={handleAddPA} onEdit={handleEditPA} onDelete={handleDeletePA} />
          </div>
        </>
      ),
    },
    {
      key: 'medications', label: 'Medications', content: (
        <PatientMedications
          patientName={`${merged.firstName} ${merged.lastName}`}
          medications={patient.medications || []}
          onAdd={handleAddMedication}
          onEdit={handleEditMedication}
          onConfirmRefill={handleConfirmRefill}
          onSkipRefill={handleSkipRefill}
          onOrderRefill={handleOrderRefill}
          onDelete={handleDeleteMedication}
          readOnly={merged.isLocked}
          pharmacies={pharmacies}
        />
      ),
    },
    {
      key: 'medicationLog', label: 'MAR', content: (
        <PatientMedicationMAR
          basePath={`/api/patient/${id}`}
          currentUserId={nurseUserId}
          currentUserRole="nurse"
          canAttributeToOthers
          roster={marRoster}
        />
      ),
    },
    {
      key: 'tar', label: 'TAR', content: (
        <PatientTreatmentTAR
          basePath={`/api/patient/${id}`}
          currentUserId={nurseUserId}
          canManage
        />
      ),
    },
    {
      key: 'documents', label: 'Documents', content: (
        <PatientDocuments
          patientId={id}
          basePath={`/api/nurse/patients/${id}/documents`}
          canDeleteAny
          uploaderId={nurseUserId}
        />
      ),
    },
    {
      key: 'orders', label: 'Orders', content: (
        <PatientOrders
          patientId={id}
          basePath={`/api/nurse/patients/${id}/documents`}
          canDeleteAny
          uploaderId={nurseUserId}
        />
      ),
    },
    {
      key: 'progressNotes', label: 'Progress Notes', content: (
        <ProgressNoteList patientId={id} basePath="/api/nurse" linkBase={`/nurse/patients/${id}/progress-notes`} canCreate={!merged.isLocked} />
      ),
    },
    {
      key: 'careTeam', label: 'Care Team', content: (
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <PatientCareTeam
            patientName={`${merged.firstName} ${merged.lastName}`}
            nurseLinks={patient.nurseLinks}
            guardianLinks={patient.guardianLinks}
            canManageAssignment={false}
            onInviteGuardian={handleInviteGuardian}
          />
        </div>
      ),
    },
    {
      key: 'reminders', label: 'Notifications & Reminders', content: (
        <PatientNotifications
          role="nurse"
          medicationOptIn={patient.medicationRemindersOptIn}
          onToggleMedicationOptIn={handleToggleMedicationReminders}
          documentRemindersEnabled={merged.documentRemindersEnabled}
          paRemindersEnabled={merged.paRemindersEnabled}
          partialShiftClaimsRequireApproval={merged.partialShiftClaimsRequireApproval}
        />
      ),
    },
  ]

  return (
    <PatientDetailShell
      backHref="/nurse/patients"
      backLabel="← myPatients"
      headerName={`${merged.lastName}, ${merged.firstName}`}
      headerAccountNumber={merged.accountNumber}
      banners={banners}
      tabs={tabs}
    />
  )
}
