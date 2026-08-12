'use client'

import MedicationList, { MedicationDTO, MedicationInput, PharmacyOption } from '../MedicationList'
import { searchDrugNames } from '../../../lib/drugSearchClient'
import { fetchDrugFacts } from '../../../lib/drugFactsClient'

export default function PatientMedications({
  patientName, medications, onAdd, onEdit, onConfirmRefill, onOrderRefill, onDelete, readOnly, pharmacies,
}: {
  patientName: string
  medications: MedicationDTO[]
  onAdd: (data: MedicationInput) => Promise<void>
  onEdit: (medId: string, data: MedicationInput) => Promise<void>
  onConfirmRefill: (medId: string, refillDate: string, daySupply: string) => Promise<void>
  onOrderRefill: (medId: string, orderedDate: string) => Promise<void>
  onDelete: (medId: string) => Promise<void>
  readOnly?: boolean
  pharmacies: PharmacyOption[]
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <MedicationList
        patientName={patientName}
        medications={medications}
        onAdd={onAdd}
        onEdit={onEdit}
        onConfirmRefill={onConfirmRefill}
        onOrderRefill={onOrderRefill}
        onDelete={onDelete}
        readOnly={readOnly}
        pharmacies={pharmacies}
        onSearchDrugNames={searchDrugNames}
        onFetchDrugFacts={fetchDrugFacts}
      />
    </div>
  )
}
