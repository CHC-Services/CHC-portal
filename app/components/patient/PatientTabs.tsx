'use client'

export type DetailTab = 'demographics' | 'insurance' | 'medications' | 'medicationLog' | 'tar' | 'documents' | 'orders' | 'careTeam' | 'reminders' | 'schedule' | 'progressNotes'

// Three groups, one row each, one color each — not one color per tab. Alex's
// framing: the patient's on-file record sits on top, day-to-day scheduling/
// office coordination in the middle, and actual visit documentation
// (progress notes, MAR, and TAR once it exists) gets its own row at the
// bottom, since that's the record of what actually happened during a visit
// rather than background data about the patient or the case.
type TabGroup = 'record' | 'coordination' | 'visit'

const TAB_GROUP: Record<DetailTab, TabGroup> = {
  demographics: 'record',
  insurance: 'record',
  medications: 'record',
  careTeam: 'record',
  documents: 'record',
  orders: 'record',
  schedule: 'coordination',
  reminders: 'coordination',
  progressNotes: 'visit',
  medicationLog: 'visit',
  tar: 'visit',
}

const GROUP_ORDER: TabGroup[] = ['record', 'coordination', 'visit']

const GROUP_META: Record<TabGroup, { label: string; dot: string; activeBg: string }> = {
  record: { label: 'Patient Record', dot: 'bg-[#2F3E4E]', activeBg: 'bg-[#2F3E4E]' },
  coordination: { label: 'Scheduling & Office', dot: 'bg-[#7A8F79]', activeBg: 'bg-[#7A8F79]' },
  visit: { label: 'Visit Documentation', dot: 'bg-teal-600', activeBg: 'bg-teal-600' },
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
  return (
    <div className="space-y-1.5">
      {GROUP_ORDER.map(group => {
        const groupTabs = tabs.filter(t => TAB_GROUP[t.key] === group)
        if (groupTabs.length === 0) return null
        const meta = GROUP_META[group]
        return (
          <div key={group} className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] w-[124px] shrink-0">
              {meta.label}
            </span>
            {groupTabs.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => onChange(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition ${
                  active === t.key
                    ? `${meta.activeBg} text-white`
                    : 'bg-white text-[#2F3E4E] border border-[#D9E1E8] hover:border-[#7A8F79] hover:text-[#7A8F79]'
                }`}
              >
                {active !== t.key && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />}
                {t.label}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}
