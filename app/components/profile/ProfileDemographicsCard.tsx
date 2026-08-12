'use client'

import { fmtPhoneInput } from '../../../lib/formatPhone'
import { Row, SectionHeader } from '../ReadOnlyField'
import { US_STATES } from '../patient/types'
import SensitiveField from './SensitiveField'
import { inp, lbl, ProfileCardData } from './types'

// Universal across every account role — same fields, same component,
// wherever a profile page renders it (nurse/admin/guardian self-service, or
// admin viewing another account). Mirrors the PatientDemographics.tsx pattern:
// parent page owns `editing` state and the actual save action.
export default function ProfileDemographicsCard({
  data, readOnly, editing, onEdit, setField, showPreferredName = true,
}: {
  data: Partial<ProfileCardData>
  readOnly: boolean
  editing: boolean
  onEdit: () => void
  setField: (k: string, v: any) => void
  showPreferredName?: boolean
}) {
  if (readOnly || !editing) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <SectionHeader title="Demographics" editing={readOnly} onEdit={onEdit} />
        <div className="space-y-0.5">
          <Row label="Name" value={[data.firstName, data.middleInitial, data.lastName].filter(Boolean).join(' ')} />
          {showPreferredName && <Row label="Preferred Name" value={data.displayName} />}
          <Row label="Phone" value={data.phone} />
          <Row label="Address" value={data.address} />
          <Row label="City/State/ZIP" value={[data.city, data.state, data.zip].filter(Boolean).join(', ')} />
          <Row label="Date of Birth" value={data.dob ? 'On file' : null} />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] pb-1 border-b border-[#D9E1E8]">Demographics</p>
      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-2">
          <label className={lbl}>First Name</label>
          <input type="text" value={data.firstName || ''} onChange={e => setField('firstName', e.target.value)} className={inp} />
        </div>
        <div className="col-span-1">
          <label className={lbl}>MI</label>
          <input type="text" maxLength={1} value={data.middleInitial || ''} onChange={e => setField('middleInitial', e.target.value)} className={inp} />
        </div>
        <div className="col-span-3">
          <label className={lbl}>Last Name</label>
          <input type="text" value={data.lastName || ''} onChange={e => setField('lastName', e.target.value)} className={inp} />
        </div>
      </div>

      <div className={`grid grid-cols-1 ${showPreferredName ? 'sm:grid-cols-2' : ''} gap-4`}>
        {showPreferredName && (
          <div>
            <label className={lbl}>Preferred Name <span className="normal-case font-normal">(optional)</span></label>
            <input type="text" value={data.displayName || ''} onChange={e => setField('displayName', e.target.value)} className={inp} />
          </div>
        )}
        <div>
          <label className={lbl}>Phone Number</label>
          <input type="tel" placeholder="(555) 555-5555" value={data.phone || ''} onChange={e => setField('phone', fmtPhoneInput(e.target.value))} className={inp} />
        </div>
      </div>

      <div>
        <label className={lbl}>Home Address</label>
        <input type="text" placeholder="Street address" value={data.address || ''} onChange={e => setField('address', e.target.value)} className={inp} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <label className={lbl}>City</label>
          <input type="text" placeholder="City" value={data.city || ''} onChange={e => setField('city', e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>State</label>
          <select value={data.state || ''} onChange={e => setField('state', e.target.value)} className={inp}>
            <option value="">ST</option>
            {US_STATES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>ZIP</label>
          <input type="text" placeholder="ZIP" value={data.zip || ''} onChange={e => setField('zip', e.target.value)} className={inp} />
        </div>
      </div>

      <SensitiveField label="Date of Birth" type="date" value={data.dob || ''} onChange={v => setField('dob', v)} />
    </div>
  )
}
