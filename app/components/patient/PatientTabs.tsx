'use client'

import Tabs from '../Tabs'

export type DetailTab = 'demographics' | 'insurance' | 'medications' | 'medicationLog' | 'documents' | 'orders' | 'careTeam' | 'reminders' | 'schedule' | 'progressNotes'

// One color per information type, applied consistently across every role
// that has access to that tab — the tab bar reads the same regardless of
// whether it's rendered on the nurse, admin, or family patient-detail page,
// since all three build their tabs array from these same DetailTab keys.
// TAR isn't a tab yet (planned) — 'rose' is reserved for it so it doesn't
// collide with an existing color whenever it's added.
export const TAB_COLORS: Record<DetailTab, string> = {
  demographics: 'bg-slate-400',
  insurance: 'bg-blue-500',
  medications: 'bg-purple-500',
  medicationLog: 'bg-pink-500',
  documents: 'bg-cyan-500',
  orders: 'bg-orange-500',
  careTeam: 'bg-teal-500',
  reminders: 'bg-amber-500',
  schedule: 'bg-violet-500',
  progressNotes: 'bg-emerald-500',
}

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
  const coloredTabs = tabs.map(t => ({ ...t, dotColor: TAB_COLORS[t.key] }))
  return <Tabs tabs={coloredTabs} active={active} onChange={k => onChange(k as DetailTab)} />
}
