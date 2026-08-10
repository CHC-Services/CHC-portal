'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import PatientDetailShell from '../../../components/patient/PatientDetailShell'
import PatientDemographics from '../../../components/patient/PatientDemographics'
import PatientInsurance from '../../../components/patient/PatientInsurance'
import PatientMedications from '../../../components/patient/PatientMedications'
import PatientDocuments from '../../../components/patient/PatientDocuments'
import { DetailTab } from '../../../components/patient/PatientTabs'
import { PatientFields } from '../../../components/patient/types'
import { MedicationDTO, MedicationInput, PharmacyOption } from '../../../components/MedicationList'

export default function FamilyPatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [data, setData] = useState<Partial<PatientFields>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [guardianUserId, setGuardianUserId] = useState('')
  const [medications, setMedications] = useState<MedicationDTO[]>([])
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([])

  useEffect(() => {
    fetch(`/api/family/patients/${id}`, { credentials: 'include' })
      .then(async r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return }
        const body = await r.json()
        setData(body.patient)
        setLoading(false)
      })
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.id) setGuardianUserId(d.id) })
      .catch(() => {})
    fetch('/api/pharmacies', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPharmacies(d) })
  }, [id])

  function loadMedications() {
    fetch('/api/family/medications', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const patient = (d.patients || []).find((p: any) => p.id === id)
        setMedications(patient?.medications || [])
      })
  }

  useEffect(() => { loadMedications() }, [id])

  async function handleAddMedication(medData: MedicationInput) {
    await fetch('/api/family/medications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ patientId: id, ...medData }),
    })
    loadMedications()
  }

  async function handleEditMedication(medId: string, medData: MedicationInput) {
    await fetch('/api/family/medications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medId, ...medData }),
    })
    loadMedications()
  }

  async function handleConfirmRefill(medId: string, refillDate: string) {
    await fetch('/api/family/medications/refill', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medId, refillDate }),
    })
    loadMedications()
  }

  async function handleDeleteMedication(medId: string) {
    await fetch('/api/family/medications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medId }),
    })
    loadMedications()
  }

  function setField(k: string, v: any) {
    setData(d => ({ ...d, [k]: v }))
    setSaved(false)
  }

  async function handleSave() {
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
      setEditing(false)
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

  const demographicsAndInsuranceForm = (
    <div className="mt-3">
      {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className="bg-[#2F3E4E] text-white px-6 py-2 rounded-xl font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="border border-[#D9E1E8] text-[#7A8F79] px-6 py-2 rounded-xl text-sm font-semibold hover:bg-[#F4F6F5] transition">
          Cancel
        </button>
        {saved && <span className="text-sm font-medium text-green-600">✓ Saved</span>}
      </div>
    </div>
  )

  const tabs: { key: DetailTab; label: string; content: React.ReactNode }[] = [
    {
      key: 'demographics', label: 'Demographics', content: (
        <>
          <PatientDemographics data={data} readOnly={false} editing={editing} onEdit={() => setEditing(true)} setField={setField} />
          {editing && demographicsAndInsuranceForm}
        </>
      ),
    },
    {
      key: 'insurance', label: 'Insurance', content: (
        <>
          <PatientInsurance data={data} readOnly={false} editing={editing} onEdit={() => setEditing(true)} setField={setField} />
          {editing && demographicsAndInsuranceForm}
        </>
      ),
    },
    {
      key: 'medications', label: 'Medications', content: (
        <PatientMedications
          patientName={`${data.firstName} ${data.lastName}`}
          medications={medications}
          onAdd={handleAddMedication}
          onEdit={handleEditMedication}
          onConfirmRefill={handleConfirmRefill}
          onDelete={handleDeleteMedication}
          pharmacies={pharmacies}
        />
      ),
    },
    {
      key: 'documents', label: 'Documents', content: (
        <PatientDocuments
          patientId={id}
          basePath={`/api/family/patients/${id}/documents`}
          canDeleteAny={false}
          uploaderId={guardianUserId}
        />
      ),
    },
  ]

  return (
    <PatientDetailShell
      backHref="/family/patients"
      backLabel="← myPatients"
      headerName={`${data.firstName} ${data.lastName}`}
      headerAccountNumber={data.accountNumber || ''}
      tabs={tabs}
    />
  )
}
