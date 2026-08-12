'use client'

import { Row, SectionHeader } from '../ReadOnlyField'
import SensitiveField from './SensitiveField'
import { ProfileCardData } from './types'

// NPI / Medicaid ID / SSN — nurse-only today (see ProfileCardConfig defaults
// in prisma/migrations/20260812_add_profile_card_config). Same shape as
// what app/nurse/profile/page.tsx already showed before this card existed;
// pulled out so any future role that gets this card enabled sees identical UI.
export default function ProfileBillingInfoCard({
  data, readOnly, editing, onEdit, setField,
}: {
  data: Partial<ProfileCardData>
  readOnly: boolean
  editing: boolean
  onEdit: () => void
  setField: (k: string, v: any) => void
}) {
  if (readOnly || !editing) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <SectionHeader title="Billing Info" editing={readOnly} onEdit={onEdit} />
        <div className="space-y-0.5">
          <Row label="SSN" value={data.ssn ? 'On file' : null} />
          <Row label="NPI Number" value={data.npiNumber ? 'On file' : null} />
          <Row label="Medicaid ID" value={data.medicaidNumber ? 'On file' : null} />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] pb-1 border-b border-[#D9E1E8]">Billing Info</p>
      <SensitiveField label="SSN" value={data.ssn || ''} onChange={v => setField('ssn', v)} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SensitiveField label="NPI Number (Individual)" value={data.npiNumber || ''} onChange={v => setField('npiNumber', v)} />
        <SensitiveField label="Medicaid ID" value={data.medicaidNumber || ''} onChange={v => setField('medicaidNumber', v)} />
      </div>
    </div>
  )
}
