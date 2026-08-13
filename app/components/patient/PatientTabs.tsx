'use client'

import Tabs from '../Tabs'

export type DetailTab = 'demographics' | 'insurance' | 'medications' | 'documents' | 'careTeam' | 'reminders'

// The standard 4 tabs every role gets. Roles that need more (e.g. admin/nurse
// add a Care Team tab) build their own tabs array — the tab bar always reflects
// whatever's actually passed to PatientDetailShell, not this constant.
export const PATIENT_DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'demographics', label: 'Demographics' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'medications', label: 'Medications' },
  { key: 'documents', label: 'Documents' },
]

export default function PatientTabs({
  tabs, active, onChange,
}: {
  tabs: { key: DetailTab; label: string }[]
  active: DetailTab
  onChange: (key: DetailTab) => void
}) {
  return <Tabs tabs={tabs} active={active} onChange={k => onChange(k as DetailTab)} />
}
