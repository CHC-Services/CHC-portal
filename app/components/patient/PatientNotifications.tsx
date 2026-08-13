'use client'

function ToggleRow({
  label, desc, checked, onChange,
}: {
  label: string
  desc: string
  checked: boolean
  onChange?: (val: boolean) => void
}) {
  const editable = !!onChange
  return (
    <label className={`flex items-center justify-between gap-3 ${editable ? 'cursor-pointer' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#2F3E4E] leading-tight">{label}</p>
        <p className="text-xs text-[#7A8F79] mt-0.5 leading-snug">{desc}</p>
      </div>
      <div className={`relative flex-shrink-0 ${editable ? '' : 'opacity-50'}`}>
        <input type="checkbox" className="sr-only" checked={checked} disabled={!editable} onChange={e => onChange?.(e.target.checked)} />
        <div className={`w-11 h-6 rounded-full transition-colors ${checked ? 'bg-[#2F3E4E]' : 'bg-[#D9E1E8]'}`} />
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </label>
  )
}

export type ReminderLinkStatus = { name: string; optedIn: boolean }

export default function PatientNotifications({
  role,
  medicationOptIn,
  onToggleMedicationOptIn,
  medicationStatuses,
  documentRemindersEnabled,
  paRemindersEnabled,
  onToggleDocumentReminders,
  onTogglePaReminders,
}: {
  role: 'admin' | 'nurse' | 'family'
  medicationOptIn?: boolean
  onToggleMedicationOptIn?: (val: boolean) => void
  medicationStatuses?: ReminderLinkStatus[]
  documentRemindersEnabled?: boolean
  paRemindersEnabled?: boolean
  onToggleDocumentReminders?: (val: boolean) => void
  onTogglePaReminders?: (val: boolean) => void
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E] mb-3">Medication Refill Reminders</p>
        {role === 'admin' ? (
          medicationStatuses && medicationStatuses.length > 0 ? (
            <div className="space-y-1.5">
              {medicationStatuses.map(s => (
                <div key={s.name} className="flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2">
                  <span className="text-sm text-[#2F3E4E]">{s.name}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${s.optedIn ? 'text-[#7A8F79]' : 'text-[#aab]'}`}>
                    {s.optedIn ? 'Opted in' : 'Opted out'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#7A8F79] italic">No linked providers or guardians yet.</p>
          )
        ) : (
          <ToggleRow
            label="Text me refill reminders"
            desc="Get a text when this patient's medication is due for a refill."
            checked={!!medicationOptIn}
            onChange={onToggleMedicationOptIn}
          />
        )}
      </div>

      {role !== 'family' && (
        <>
          <div className="pt-4 border-t border-[#D9E1E8]">
            <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E] mb-3">Document Reminders</p>
            <ToggleRow
              label="Alert on expiring documents"
              desc="Notify linked providers and guardians before a document on file for this patient expires."
              checked={!!documentRemindersEnabled}
              onChange={role === 'admin' ? onToggleDocumentReminders : undefined}
            />
          </div>

          <div className="pt-4 border-t border-[#D9E1E8]">
            <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E] mb-3">Prior Auth Reminders</p>
            <ToggleRow
              label="Alert before PA expires"
              desc="Notify linked providers and guardians 3 weeks before this patient's Prior Authorization end date."
              checked={!!paRemindersEnabled}
              onChange={role === 'admin' ? onTogglePaReminders : undefined}
            />
          </div>
        </>
      )}
    </div>
  )
}
