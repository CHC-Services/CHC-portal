'use client'

import Tabs from '../Tabs'

export type DetailTab = 'demographics' | 'insurance' | 'medications' | 'documents'

export const PATIENT_DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'demographics', label: 'Demographics' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'medications', label: 'Medications' },
  { key: 'documents', label: 'Documents' },
]

export default function PatientTabs({
  active, onChange,
}: {
  active: DetailTab
  onChange: (key: DetailTab) => void
}) {
  return <Tabs tabs={PATIENT_DETAIL_TABS} active={active} onChange={k => onChange(k as DetailTab)} />
}
