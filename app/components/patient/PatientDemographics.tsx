'use client'

import { fmtPhoneInput } from '../../../lib/formatPhone'
import { Row, SectionHeader } from '../ReadOnlyField'
import { PatientFields, US_STATES, inp, lbl } from './types'

export default function PatientDemographics({
  data, readOnly, editing, onEdit, setField,
}: {
  data: Partial<PatientFields>
  readOnly: boolean
  editing: boolean
  onEdit: () => void
  setField: (k: string, v: any) => void
}) {
  if (readOnly || !editing) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        <div>
          <SectionHeader title="Demographics" editing={readOnly} onEdit={onEdit} />
          <Row label="Date of Birth" value={data.dob} />
          <Row label="Sex" value={data.gender} />
          <Row label="Phone" value={data.phone} />
          <Row label="High-Tech" value={data.highTech ? 'Yes' : null} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2 pb-1 border-b border-[#D9E1E8]">Address</p>
          <Row label="Street" value={data.address} />
          <Row label="City/State/ZIP" value={[data.city, data.state, data.zip].filter(Boolean).join(', ')} />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Demographics</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>First Name</label><input value={data.firstName || ''} onChange={e => setField('firstName', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Last Name</label><input value={data.lastName || ''} onChange={e => setField('lastName', e.target.value)} className={inp} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Date of Birth</label><input type="date" value={data.dob || ''} onChange={e => setField('dob', e.target.value)} className={inp} /></div>
            <div>
              <label className={lbl}>Sex</label>
              <select value={data.gender || ''} onChange={e => setField('gender', e.target.value)} className={inp}>
                <option value="">Select…</option>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
          </div>
          <div><label className={lbl}>Phone</label><input value={data.phone || ''} onChange={e => setField('phone', fmtPhoneInput(e.target.value))} placeholder="(555) 000-0000" className={inp} /></div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="ht" checked={!!data.highTech} onChange={e => setField('highTech', e.target.checked)} className="accent-[#7A8F79] w-4 h-4" />
            <label htmlFor="ht" className="text-sm text-[#2F3E4E] font-semibold cursor-pointer">High-Tech designation</label>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Address</p>
        <div className="space-y-3">
          <div><label className={lbl}>Street</label><input value={data.address || ''} onChange={e => setField('address', e.target.value)} className={inp} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1"><label className={lbl}>City</label><input value={data.city || ''} onChange={e => setField('city', e.target.value)} className={inp} /></div>
            <div>
              <label className={lbl}>State</label>
              <select value={data.state || ''} onChange={e => setField('state', e.target.value)} className={inp}>
                <option value="">ST</option>
                {US_STATES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={lbl}>ZIP</label><input value={data.zip || ''} onChange={e => setField('zip', e.target.value)} className={inp} /></div>
          </div>
        </div>
      </div>
    </div>
  )
}
