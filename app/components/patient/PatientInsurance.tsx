'use client'

import { useState } from 'react'
import { Row, SectionHeader } from '../ReadOnlyField'
import { PatientFields, SUBSCRIBER_RELATIONS, inp, lbl } from './types'

function AdditionalCoverageView({ data }: { data: Partial<PatientFields> }) {
  if (!data.ins2Type && !data.ins2Id) return null
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2 pb-1 border-b border-[#D9E1E8]">Additional Coverage</p>
      <Row label="Type" value={data.ins2Type} />
      <Row label="Member ID" value={data.ins2Id} />
      <Row label="Carrier" value={data.ins2Name} />
      <Row label="Group #" value={data.ins2Group} />
      <Row label="Plan" value={data.ins2Plan} />
      <Row label="Network" value={data.ins2NetworkStatus} />
      <Row label="Case Rate" value={data.ins2HasCaseRate ? (data.ins2CaseRateAmount || 'Yes') : null} />
      <Row label="Policy Notes" value={data.ins2PolicyNotes} />
    </div>
  )
}

// Paired field lists driving the Primary/Secondary swap — index i in one
// array is the counterpart of index i in the other.
const PRIMARY_FIELDS = ['insuranceType', 'insuranceId', 'insuranceName', 'insuranceGroup', 'insurancePlan', 'subscriberName', 'subscriberRelation', 'networkStatus', 'hasCaseRate', 'caseRateAmount', 'policyNotes'] as const
const SECONDARY_FIELDS = ['ins2Type', 'ins2Id', 'ins2Name', 'ins2Group', 'ins2Plan', 'ins2SubscriberName', 'ins2SubscriberRelation', 'ins2NetworkStatus', 'ins2HasCaseRate', 'ins2CaseRateAmount', 'ins2PolicyNotes'] as const

// Swaps every Primary field with its Secondary counterpart in place — lets
// an admin/guardian reorder which policy bills first without retyping or
// deleting anything. A blank counterpart just means that slot becomes empty
// (e.g. swapping out a cancelled primary makes room to enter a brand-new one
// while preserving it as secondary) — the two boolean fields default to
// `false` rather than `null` to match their checkbox controls.
function swapPrimarySecondary(data: Partial<PatientFields>, setField: (k: string, v: any) => void) {
  PRIMARY_FIELDS.forEach((pKey, i) => {
    const sKey = SECONDARY_FIELDS[i]
    const pVal = (data as any)[pKey]
    const sVal = (data as any)[sKey]
    const isBoolField = pKey === 'hasCaseRate'
    setField(pKey, sVal ?? (isBoolField ? false : (pKey === 'insuranceType' ? '' : null)))
    setField(sKey, pVal ?? (isBoolField ? false : null))
  })
}

function AdditionalCoverageForm({ data, setField }: { data: Partial<PatientFields>; setField: (k: string, v: any) => void }) {
  const [open, setOpen] = useState(!!(data.ins2Type || data.ins2Id))
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest text-[#2F3E4E] pb-1 border-b border-[#D9E1E8] mb-3 hover:text-[#7A8F79] transition"
      >
        <span>Additional Coverage</span>
        <span className="text-[#7A8F79] font-normal normal-case tracking-normal">
          {open ? '▲ hide' : (data.ins2Type || data.ins2Id ? '▼ edit' : '▼ + add coverage')}
        </span>
      </button>
      {open && (
        <div className="space-y-3">
          <div>
            <label className={lbl}>Insurance Type</label>
            <select value={data.ins2Type || ''} onChange={e => setField('ins2Type', e.target.value || null)} className={inp}>
              <option value="">— None —</option>
              <option>Medicaid</option><option>Commercial</option><option>Medicare</option><option>Other</option>
            </select>
          </div>
          {data.ins2Type && (<>
            <div><label className={lbl}>Member ID</label><input value={data.ins2Id || ''} onChange={e => setField('ins2Id', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Carrier Name</label><input value={data.ins2Name || ''} onChange={e => setField('ins2Name', e.target.value)} className={inp} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Group #</label><input value={data.ins2Group || ''} onChange={e => setField('ins2Group', e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Plan</label><input value={data.ins2Plan || ''} onChange={e => setField('ins2Plan', e.target.value)} className={inp} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Subscriber Name</label><input value={data.ins2SubscriberName || ''} onChange={e => setField('ins2SubscriberName', e.target.value)} className={inp} /></div>
              <div>
                <label className={lbl}>Relation</label>
                <select value={data.ins2SubscriberRelation || ''} onChange={e => setField('ins2SubscriberRelation', e.target.value)} className={inp}>
                  <option value="">Select…</option>
                  {SUBSCRIBER_RELATIONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={lbl}>Network Status</label>
              <div className="flex gap-2">
                {['IN', 'OON'].map(s => (
                  <button key={s} type="button" onClick={() => setField('ins2NetworkStatus', data.ins2NetworkStatus === s ? null : s)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition ${data.ins2NetworkStatus === s ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'border-[#D9E1E8] text-[#7A8F79] hover:bg-[#F4F6F5]'}`}>
                    {s === 'IN' ? 'In-Network' : 'Out-of-Network'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="cr2" checked={!!data.ins2HasCaseRate} onChange={e => setField('ins2HasCaseRate', e.target.checked)} className="accent-[#7A8F79] w-4 h-4" />
              <label htmlFor="cr2" className="text-sm text-[#2F3E4E] font-semibold cursor-pointer">Agreed case rate</label>
            </div>
            {data.ins2HasCaseRate && (
              <div><label className={lbl}>Case Rate Amount</label><input value={data.ins2CaseRateAmount || ''} onChange={e => setField('ins2CaseRateAmount', e.target.value)} placeholder="e.g. $125.00 / day" className={inp} /></div>
            )}
            <div>
              <label className={lbl}>Policy Notes</label>
              <textarea value={data.ins2PolicyNotes || ''} onChange={e => setField('ins2PolicyNotes', e.target.value)} rows={2}
                placeholder="e.g. Secondary covers remainder after primary…"
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
            </div>
            <button type="button" onClick={() => {
              ['ins2Type', 'ins2Id', 'ins2Name', 'ins2Group', 'ins2Plan', 'ins2SubscriberName', 'ins2SubscriberRelation', 'ins2NetworkStatus', 'ins2CaseRateAmount', 'ins2PolicyNotes'].forEach(k => setField(k, null))
              setField('ins2HasCaseRate', false)
              setOpen(false)
            }} className="text-xs text-red-400 hover:text-red-600 transition font-semibold">
              Remove additional coverage
            </button>
          </>)}
        </div>
      )}
    </div>
  )
}

export default function PatientInsurance({
  data, readOnly, editing, onEdit, setField,
}: {
  data: Partial<PatientFields>
  readOnly: boolean
  editing: boolean
  onEdit: () => void
  setField: (k: string, v: any) => void
}) {
  // Bumped on every swap so AdditionalCoverageForm (which tracks its own
  // open/closed state locally) remounts and re-derives that state from the
  // freshly-swapped data, instead of staying collapsed on newly-arrived
  // secondary coverage.
  const [swapVersion, setSwapVersion] = useState(0)

  function handleSwap() {
    swapPrimarySecondary(data, setField)
    setSwapVersion(v => v + 1)
  }

  if (readOnly || !editing) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        <div>
          <SectionHeader title="Primary Insurance" editing={readOnly} onEdit={onEdit} />
          <Row label="Type" value={data.insuranceType} />
          <Row label="Member ID" value={data.insuranceId} />
          <Row label="Carrier" value={data.insuranceName} />
          <Row label="Group #" value={data.insuranceGroup} />
          <Row label="Plan" value={data.insurancePlan} />
          <Row label="Subscriber" value={data.subscriberName} />
          <Row label="Relation" value={data.subscriberRelation} />
          <Row label="Network" value={data.networkStatus} />
          <Row label="Case Rate" value={data.hasCaseRate ? (data.caseRateAmount || 'Yes') : null} />
          <Row label="Policy Notes" value={data.policyNotes} />
        </div>
        <AdditionalCoverageView data={data} />
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-2 pb-1 border-b border-[#D9E1E8]">Clinical / Billing</p>
          <Row label="Dx Codes" value={[data.dxCode1, data.dxCode2, data.dxCode3, data.dxCode4].filter(Boolean).join(', ')} />
          <Row label="Prior Auth #" value={data.paNumber} />
          <Row label="PA Dates" value={data.paStartDate || data.paEndDate ? `${data.paStartDate || '?'} — ${data.paEndDate || 'Present'}` : null} />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 bg-[#F4F6F5] rounded-xl px-4 py-3">
        <p className="text-xs text-[#7A8F79] leading-relaxed">
          Swaps every Primary and Secondary field at once — nothing is deleted, so you can reorder billing priority or make room for a brand-new policy without retyping what&apos;s already on file.
        </p>
        <button
          type="button"
          onClick={handleSwap}
          className="shrink-0 border border-[#D9E1E8] bg-white text-[#2F3E4E] text-xs font-semibold px-3 py-2 rounded-lg hover:border-[#7A8F79] hover:text-[#7A8F79] transition inline-flex items-center gap-1.5"
        >
          ⇄ Swap Primary / Secondary
        </button>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Primary Insurance</p>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Insurance Type</label>
            <select value={data.insuranceType || ''} onChange={e => setField('insuranceType', e.target.value)} className={inp}>
              <option value="">— Select —</option>
              <option>Medicaid</option><option>Commercial</option><option>Medicare</option><option>Other</option>
            </select>
          </div>
          <div><label className={lbl}>Member ID</label><input value={data.insuranceId || ''} onChange={e => setField('insuranceId', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Carrier Name</label><input value={data.insuranceName || ''} onChange={e => setField('insuranceName', e.target.value)} className={inp} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Group #</label><input value={data.insuranceGroup || ''} onChange={e => setField('insuranceGroup', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Plan</label><input value={data.insurancePlan || ''} onChange={e => setField('insurancePlan', e.target.value)} className={inp} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Subscriber Name</label><input value={data.subscriberName || ''} onChange={e => setField('subscriberName', e.target.value)} className={inp} /></div>
            <div>
              <label className={lbl}>Relation</label>
              <select value={data.subscriberRelation || ''} onChange={e => setField('subscriberRelation', e.target.value)} className={inp}>
                <option value="">Select…</option>
                {SUBSCRIBER_RELATIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Network Status</label>
            <div className="flex gap-2">
              {['IN', 'OON'].map(s => (
                <button key={s} type="button" onClick={() => setField('networkStatus', data.networkStatus === s ? null : s)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition ${data.networkStatus === s ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'border-[#D9E1E8] text-[#7A8F79] hover:bg-[#F4F6F5]'}`}>
                  {s === 'IN' ? 'In-Network' : 'Out-of-Network'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="cr" checked={!!data.hasCaseRate} onChange={e => setField('hasCaseRate', e.target.checked)} className="accent-[#7A8F79] w-4 h-4" />
            <label htmlFor="cr" className="text-sm text-[#2F3E4E] font-semibold cursor-pointer">Agreed case rate</label>
          </div>
          {data.hasCaseRate && (
            <div><label className={lbl}>Case Rate Amount</label><input value={data.caseRateAmount || ''} onChange={e => setField('caseRateAmount', e.target.value)} placeholder="e.g. $125.00 / day" className={inp} /></div>
          )}
          <div>
            <label className={lbl}>Policy Notes</label>
            <textarea value={data.policyNotes || ''} onChange={e => setField('policyNotes', e.target.value)} rows={2}
              placeholder="e.g. Primary plan covers first 100 days only…"
              className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] resize-none" />
          </div>
        </div>
      </div>

      <AdditionalCoverageForm key={swapVersion} data={data} setField={setField} />

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Clinical / Billing</p>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Diagnosis Codes (ICD-10)</label>
            <div className="grid grid-cols-2 gap-2">
              {(['dxCode1', 'dxCode2', 'dxCode3', 'dxCode4'] as const).map((k, i) => (
                <input key={k} value={(data as any)[k] || ''} onChange={e => setField(k, e.target.value)} placeholder={`Dx ${i + 1}`} className={inp} />
              ))}
            </div>
          </div>
          <p className="text-[10px] text-[#7A8F79] italic">Manage prior authorizations in the Prior Authorization History section above.</p>
        </div>
      </div>
    </div>
  )
}
