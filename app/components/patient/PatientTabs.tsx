'use client'

export type DetailTab = 'demographics' | 'insurance' | 'medications' | 'medicationLog' | 'tar' | 'documents' | 'orders' | 'careTeam' | 'reminders' | 'schedule' | 'progressNotes'

// Three groups, one row each, one color each — not one color per tab. Alex's
// framing: the patient's on-file record sits on top, day-to-day scheduling/
// office coordination in the middle (who's assigned and when — Care Team
// lives here, not with the static record), and actual visit documentation
// (progress notes, MAR, TAR) gets its own row at the bottom, since that's
// the record of what actually happened during a visit rather than
// background data about the patient or the case.
type TabGroup = 'record' | 'coordination' | 'visit'

const TAB_GROUP: Record<DetailTab, TabGroup> = {
  demographics: 'record',
  insurance: 'record',
  medications: 'record',
  documents: 'record',
  orders: 'record',
  careTeam: 'coordination',
  schedule: 'coordination',
  reminders: 'coordination',
  progressNotes: 'visit',
  medicationLog: 'visit',
  tar: 'visit',
}

const GROUP_ORDER: TabGroup[] = ['record', 'coordination', 'visit']

// The button itself carries the group's color (a light tint + matching text
// at rest, the solid color once selected) — same tint/solid-text pairing
// convention used for category badges elsewhere in the app (e.g. the
// insurance-type pill), not just a small dot next to a plain button.
const GROUP_META: Record<TabGroup, { label: string; idleBg: string; idleText: string; idleHover: string; activeBg: string }> = {
  record: { label: 'Records:', idleBg: 'bg-slate-100', idleText: 'text-[#2F3E4E]', idleHover: 'hover:bg-slate-200', activeBg: 'bg-[#2F3E4E]' },
  coordination: { label: 'Scheduling:', idleBg: 'bg-[#7A8F79]/10', idleText: 'text-[#5f7160]', idleHover: 'hover:bg-[#7A8F79]/20', activeBg: 'bg-[#7A8F79]' },
  visit: { label: 'Charting:', idleBg: 'bg-teal-50', idleText: 'text-teal-800', idleHover: 'hover:bg-teal-100', activeBg: 'bg-teal-600' },
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition ${
                  active === t.key
                    ? `${meta.activeBg} text-white`
                    : `${meta.idleBg} ${meta.idleText} ${meta.idleHover}`
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}
