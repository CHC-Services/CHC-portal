'use client'

import { useEffect, useState } from 'react'
import MedicationList, { MedicationDTO, MedicationInput } from '../components/MedicationList'

type FamilyPatient = {
  id: string
  firstName: string
  lastName: string
  medications: MedicationDTO[]
}

export default function FamilyPage() {
  const [patients, setPatients] = useState<FamilyPatient[]>([])
  const [loading, setLoading] = useState(true)

  function load() {
    fetch('/api/family/medications', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setPatients(data.patients || [])
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [])

  async function handleAdd(patientId: string, data: MedicationInput) {
    await fetch('/api/family/medications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ patientId, ...data }),
    })
    load()
  }

  async function handleEdit(medId: string, data: MedicationInput) {
    await fetch('/api/family/medications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medId, ...data }),
    })
    load()
  }

  async function handleConfirmRefill(medId: string, refillDate: string) {
    await fetch('/api/family/medications/refill', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medId, refillDate }),
    })
    load()
  }

  async function handleDelete(medId: string) {
    await fetch('/api/family/medications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ medId }),
    })
    load()
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 sm:p-8">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-[#2F3E4E] mb-1">
          <span className="text-[#7A8F79] italic">my</span>Family
        </h1>
        <p className="text-sm text-[#7A8F79] mb-6">Manage medications and refill reminders.</p>

        {loading ? (
          <p className="text-sm text-[#7A8F79] text-center py-12">Loading…</p>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-[#2F3E4E] font-semibold">No linked patients yet</p>
            <p className="text-[#7A8F79] text-sm mt-1">Contact the care team if this doesn&apos;t look right.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {patients.map(p => (
              <MedicationList
                key={p.id}
                patientName={`${p.firstName} ${p.lastName}`}
                medications={p.medications}
                onAdd={data => handleAdd(p.id, data)}
                onEdit={handleEdit}
                onConfirmRefill={handleConfirmRefill}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
