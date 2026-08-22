'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { calculateAge } from '../../../lib/patientAge'

type FamilyPatient = {
  id: string
  accountNumber: string
  firstName: string
  lastName: string
  dob: string
  address: string | null
  insuranceType: string
  insuranceId: string
  insuranceName: string | null
}

export default function FamilyPatientsPage() {
  const [patients, setPatients] = useState<FamilyPatient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/family/patients', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setPatients(data.patients || [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6 pl-0 md:pl-0">
      <div className="max-w-6xl">
        <h1 className="text-2xl font-bold text-[#2F3E4E] mb-1">
          <span className="text-[#7A8F79] italic">my</span>Patients
        </h1>
        <p className="text-sm text-[#7A8F79] mb-6">Your linked patients. Select one to view or update their details.</p>

        {loading ? (
          <p className="text-sm text-[#7A8F79] text-center py-12">Loading…</p>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-[#2F3E4E] font-semibold">No linked patients yet</p>
            <p className="text-[#7A8F79] text-sm mt-1">Contact the care team if this doesn&apos;t look right.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {patients.map(p => {
              const age = calculateAge(p.dob)
              return (
                <Link
                  key={p.id}
                  href={`/family/patients/${p.id}`}
                  className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md hover:ring-1 hover:ring-[#7A8F79] transition"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-base text-[#2F3E4E]">
                        {p.firstName} {p.lastName[0]}.
                        {age != null && <span className="ml-2 text-sm font-normal text-[#7A8F79]">Age {age}</span>}
                      </p>
                      <p className="text-xs text-[#7A8F79] font-mono mt-0.5">{p.accountNumber}</p>
                      {p.address && <p className="text-sm text-[#2F3E4E] mt-1">{p.address}</p>}
                    </div>
                    <span className="text-[#7A8F79] text-lg">→</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
