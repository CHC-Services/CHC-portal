'use client'

import { useEffect, useRef, useState } from 'react'
import { fmtPhoneInput } from '../../../lib/formatPhone'
import { Row, SectionHeader } from '../ReadOnlyField'
import { PatientFields, US_STATES, GUARDIAN_RELATIONSHIPS, MEDICAL_SPECIALTIES, inp, lbl } from './types'
import DateInput from '../DateInput'

function SpecialtyMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function toggle(spec: string) {
    onChange(value.includes(spec) ? value.filter(s => s !== spec) : [...value, spec])
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} className={`${inp} text-left flex items-center justify-between`}>
        <span className={value.length ? '' : 'text-[#aab]'}>{value.length ? `${value.length} selected` : 'Select specialties…'}</span>
        <span className="text-[#7A8F79] text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-[#D9E1E8] rounded-lg shadow-lg p-2 space-y-0.5">
          {MEDICAL_SPECIALTIES.map(spec => (
            <label key={spec} className="flex items-center gap-2 text-sm text-[#2F3E4E] px-2 py-1 rounded hover:bg-[#F4F6F5] cursor-pointer">
              <input type="checkbox" checked={value.includes(spec)} onChange={() => toggle(spec)} className="accent-[#7A8F79] w-4 h-4" />
              {spec}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

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
          <Row label="Minor" value={data.isMinor ? 'Yes' : null} />
          <Row label="High-Tech" value={data.highTech ? 'Yes' : null} />
          {data.linkedSpecialties && data.linkedSpecialties.length > 0 && (
            <div className="flex gap-2 text-sm py-1">
              <span className="text-[#7A8F79] w-32 shrink-0">Linked Specialties</span>
              <div className="flex flex-wrap gap-1.5">
                {data.linkedSpecialties.map(s => (
                  <span key={s} className="text-xs font-semibold text-[#2F3E4E] bg-[#F4F6F5] border border-[#D9E1E8] rounded-full px-2.5 py-0.5">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2 pb-1 border-b border-[#D9E1E8]">Address</p>
          <Row label="Street" value={data.address} />
          <Row label="City/State/ZIP" value={[data.city, data.state, data.zip].filter(Boolean).join(', ')} />
        </div>
        {data.isMinor && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2 pb-1 border-b border-[#D9E1E8]">Guardian Contact</p>
            <Row label="Name" value={[data.guardianFirstName, data.guardianLastName].filter(Boolean).join(' ')} />
            <Row label="Email" value={data.guardianEmail} />
            <Row label="Phone" value={data.guardianPhone} />
            <Row label="Relationship" value={data.guardianRelationship} />
          </div>
        )}
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
            <div><label className={lbl}>Date of Birth</label><DateInput value={data.dob || ''} onChange={e => setField('dob', e.target.value)} className={inp} /></div>
            <div>
              <label className={lbl}>Sex</label>
              <select value={data.gender || ''} onChange={e => setField('gender', e.target.value)} className={inp}>
                <option value="">Select…</option>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Phone{!data.isMinor ? ' *' : ''}</label>
              <input value={data.phone || ''} onChange={e => setField('phone', fmtPhoneInput(e.target.value))} placeholder="(555) 000-0000" className={inp} />
            </div>
            <div>
              <label className={lbl}>Patient is a Minor?</label>
              <select value={data.isMinor ? 'yes' : 'no'} onChange={e => setField('isMinor', e.target.value === 'yes')} className={inp}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="ht" checked={!!data.highTech} onChange={e => setField('highTech', e.target.checked)} className="accent-[#7A8F79] w-4 h-4" />
            <label htmlFor="ht" className="text-sm text-[#2F3E4E] font-semibold cursor-pointer">High-Tech designation</label>
          </div>
          <div>
            <label className={lbl}>Linked Specialties</label>
            <SpecialtyMultiSelect value={data.linkedSpecialties || []} onChange={v => setField('linkedSpecialties', v)} />
          </div>
        </div>
      </div>

      {data.isMinor && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">
            Guardian Contact <span className="normal-case font-normal text-[#7A8F79]">(required for minors — so 2FA codes and authenticator apps reach a guardian)</span>
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>First Name *</label><input value={data.guardianFirstName || ''} onChange={e => setField('guardianFirstName', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Last Name *</label><input value={data.guardianLastName || ''} onChange={e => setField('guardianLastName', e.target.value)} className={inp} /></div>
            </div>
            <div>
              <label className={lbl}>Email <span className="normal-case font-normal">(if different from login email)</span></label>
              <input value={data.guardianEmail || ''} onChange={e => setField('guardianEmail', e.target.value)} className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Phone *</label><input value={data.guardianPhone || ''} onChange={e => setField('guardianPhone', fmtPhoneInput(e.target.value))} placeholder="(555) 000-0000" className={inp} /></div>
              <div>
                <label className={lbl}>Relationship to Patient *</label>
                <select value={data.guardianRelationship || ''} onChange={e => setField('guardianRelationship', e.target.value)} className={inp}>
                  <option value="">Select…</option>
                  {GUARDIAN_RELATIONSHIPS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

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
