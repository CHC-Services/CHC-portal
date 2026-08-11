'use client'

import { useState, useRef } from 'react'

// ─── Portable component — no API calls, no Prisma/site imports. ────────────────
// Data flows in via props; the page that renders this does all the fetching.
// The only site-specific thing here is the `theme` object below — swap these
// four hex values and the whole component re-skins for a different brand.
// Everything else (layout, spacing, structure) is plain Tailwind + React.
const theme = {
  navy: '#2F3E4E',
  sage: '#7A8F79',
  bg: '#D9E1E8',
  offWhite: '#F4F6F5',
}

export type MedicationDTO = {
  id: string
  medicationName: string
  dose: string | null
  frequency: string | null
  daySupply: number
  lastFillDate: string // ISO date string
  rxNumber: string | null
  refillsRemaining: number | null
  pharmacyName: string | null
  pharmacyAddress: string | null
  pharmacyPhone: string | null
  active: boolean
}

export type MedicationInput = {
  medicationName: string
  dose: string
  frequency: string
  daySupply: string
  lastFillDate: string
  rxNumber: string
  refillsRemaining: string
  pharmacyName: string
  pharmacyAddress: string
  pharmacyPhone: string
}

export type PharmacyOption = {
  id: string
  name: string
  address: string | null
  phone: string | null
}

export type DrugSearchFn = (q: string) => Promise<{ exact: string[]; suggested: string[] }>

type MedicationListProps = {
  patientName: string
  medications: MedicationDTO[]
  onAdd: (data: MedicationInput) => Promise<void>
  onEdit: (id: string, data: MedicationInput) => Promise<void>
  onConfirmRefill: (id: string, refillDate: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  readOnly?: boolean
  pharmacies?: PharmacyOption[]
  onSearchDrugNames?: DrugSearchFn
}

const emptyForm: MedicationInput = {
  medicationName: '', dose: '', frequency: '', daySupply: '30',
  lastFillDate: '', rxNumber: '', refillsRemaining: '', pharmacyName: '', pharmacyAddress: '', pharmacyPhone: '',
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// Formats any phone input as (XXX) XXX-XXXX, live, regardless of how it's typed.
// Inlined (rather than imported) to keep this component's no-site-imports rule intact.
function fmtPhoneInput(val: string): string {
  const d = val.replace(/\D/g, '')
  const digits = d.length === 11 && d[0] === '1' ? d.slice(1) : d
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

function toFormValues(m: MedicationDTO): MedicationInput {
  return {
    medicationName: m.medicationName,
    dose: m.dose || '',
    frequency: m.frequency || '',
    daySupply: String(m.daySupply),
    lastFillDate: m.lastFillDate.slice(0, 10),
    rxNumber: m.rxNumber || '',
    refillsRemaining: m.refillsRemaining != null ? String(m.refillsRemaining) : '',
    pharmacyName: m.pharmacyName || '',
    pharmacyAddress: m.pharmacyAddress || '',
    pharmacyPhone: m.pharmacyPhone || '',
  }
}

function MedicationForm({ initial, onSubmit, onCancel, submitLabel, pharmacies = [], onSearchDrugNames }: {
  initial: MedicationInput
  onSubmit: (data: MedicationInput) => Promise<void>
  onCancel: () => void
  submitLabel: string
  pharmacies?: PharmacyOption[]
  onSearchDrugNames?: DrugSearchFn
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [pharmacySuggestions, setPharmacySuggestions] = useState<PharmacyOption[]>([])
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0)
  const [drugSuggestions, setDrugSuggestions] = useState<string[]>([])
  const [drugAltSuggestions, setDrugAltSuggestions] = useState<string[]>([])
  const [activeDrugIdx, setActiveDrugIdx] = useState(0)
  const drugSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const set = (k: keyof MedicationInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const inputCls = 'w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2'
  const inputStyle = { borderColor: theme.bg, color: theme.navy } as React.CSSProperties

  function handleMedicationNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setForm(f => ({ ...f, medicationName: value }))
    if (drugSearchTimer.current) clearTimeout(drugSearchTimer.current)
    const q = value.trim()
    if (!onSearchDrugNames || q.length < 2) {
      setDrugSuggestions([]); setDrugAltSuggestions([])
      return
    }
    drugSearchTimer.current = setTimeout(async () => {
      const result = await onSearchDrugNames(q)
      setDrugSuggestions(result.exact)
      setDrugAltSuggestions(result.suggested)
      setActiveDrugIdx(0)
    }, 250)
  }

  function selectDrugName(name: string) {
    setForm(f => ({ ...f, medicationName: name }))
    setDrugSuggestions([]); setDrugAltSuggestions([])
  }

  const allDrugSuggestions = [...drugSuggestions, ...drugAltSuggestions]

  function handleMedicationKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (allDrugSuggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveDrugIdx(i => Math.min(i + 1, allDrugSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveDrugIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selectDrugName(allDrugSuggestions[activeDrugIdx] || allDrugSuggestions[0])
    } else if (e.key === 'Escape') {
      setDrugSuggestions([]); setDrugAltSuggestions([])
    }
  }

  function handlePharmacyNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setForm(f => ({ ...f, pharmacyName: value }))
    const q = value.trim().toLowerCase()
    if (!q) { setPharmacySuggestions([]); return }
    setPharmacySuggestions(pharmacies.filter(p => p.name.toLowerCase().includes(q)).slice(0, 6))
    setActiveSuggestionIdx(0)
  }

  function selectPharmacy(p: PharmacyOption) {
    setForm(f => ({ ...f, pharmacyName: p.name, pharmacyAddress: p.address || '', pharmacyPhone: p.phone ? fmtPhoneInput(p.phone) : '' }))
    setPharmacySuggestions([])
  }

  function handlePharmacyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (pharmacySuggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestionIdx(i => Math.min(i + 1, pharmacySuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestionIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selectPharmacy(pharmacySuggestions[activeSuggestionIdx] || pharmacySuggestions[0])
    } else if (e.key === 'Escape') {
      setPharmacySuggestions([])
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.medicationName.trim() || !form.lastFillDate) return
    setSaving(true)
    await onSubmit(form)
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="space-y-2 p-3 rounded-xl" style={{ background: theme.offWhite }}>
      <div className="relative">
        <input
          placeholder="Medication name"
          value={form.medicationName}
          onChange={handleMedicationNameChange}
          onKeyDown={handleMedicationKeyDown}
          onBlur={() => setTimeout(() => { setDrugSuggestions([]); setDrugAltSuggestions([]) }, 100)}
          autoComplete="off"
          required
          className={inputCls}
          style={inputStyle}
        />
        {allDrugSuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-lg overflow-hidden" style={{ borderColor: theme.bg }}>
            {drugSuggestions.map((name, i) => (
              <button
                key={name}
                type="button"
                onMouseDown={() => selectDrugName(name)}
                onMouseEnter={() => setActiveDrugIdx(i)}
                className="block w-full text-left px-3 py-2 text-sm"
                style={i === activeDrugIdx ? { background: theme.navy, color: 'white' } : { color: theme.navy }}
              >
                {name}
              </button>
            ))}
            {drugAltSuggestions.length > 0 && (
              <>
                <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide font-semibold" style={{ color: theme.sage }}>Did you mean…</p>
                {drugAltSuggestions.map((name, i) => {
                  const idx = drugSuggestions.length + i
                  return (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={() => selectDrugName(name)}
                      onMouseEnter={() => setActiveDrugIdx(idx)}
                      className="block w-full text-left px-3 py-2 text-sm"
                      style={idx === activeDrugIdx ? { background: theme.navy, color: 'white' } : { color: theme.navy }}
                    >
                      {name}
                    </button>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Dose (e.g. 10mg)" value={form.dose} onChange={set('dose')} className={inputCls} style={inputStyle} />
        <input placeholder="Frequency (e.g. daily)" value={form.frequency} onChange={set('frequency')} className={inputCls} style={inputStyle} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] uppercase tracking-wide mb-0.5" style={{ color: theme.sage }}>Last Fill</label>
          <input type="date" value={form.lastFillDate} onChange={set('lastFillDate')} required className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide mb-0.5" style={{ color: theme.sage }}>Day Supply</label>
          <input type="number" min="1" value={form.daySupply} onChange={set('daySupply')} className={inputCls} style={inputStyle} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="RX #" value={form.rxNumber} onChange={set('rxNumber')} className={inputCls} style={inputStyle} />
        <input type="number" min="0" placeholder="Refills remaining" value={form.refillsRemaining} onChange={set('refillsRemaining')} className={inputCls} style={inputStyle} />
      </div>
      <div className="relative">
        <input
          placeholder="Pharmacy name"
          value={form.pharmacyName}
          onChange={handlePharmacyNameChange}
          onKeyDown={handlePharmacyKeyDown}
          onBlur={() => setTimeout(() => setPharmacySuggestions([]), 100)}
          autoComplete="off"
          className={inputCls}
          style={inputStyle}
        />
        {pharmacySuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-lg overflow-hidden" style={{ borderColor: theme.bg }}>
            {pharmacySuggestions.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={() => selectPharmacy(p)}
                onMouseEnter={() => setActiveSuggestionIdx(i)}
                className="block w-full text-left px-3 py-2 text-sm"
                style={i === activeSuggestionIdx ? { background: theme.navy, color: 'white' } : { color: theme.navy }}
              >
                <span className="font-semibold">{p.name}</span>
                {p.address && <span className="block text-xs opacity-80">{p.address}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <input placeholder="Pharmacy address" value={form.pharmacyAddress} onChange={set('pharmacyAddress')} className={inputCls} style={inputStyle} />
      <input placeholder="Pharmacy phone" value={form.pharmacyPhone} onChange={e => setForm(f => ({ ...f, pharmacyPhone: fmtPhoneInput(e.target.value) }))} className={inputCls} style={inputStyle} />
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 border rounded-lg py-2 text-sm font-semibold" style={{ borderColor: theme.bg, color: theme.sage }}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: theme.navy }}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function RefillButton({ med, onConfirm, style }: { med: MedicationDTO; onConfirm: (id: string, date: string) => Promise<void>; style: React.CSSProperties }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayStr())
  const [saving, setSaving] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => { setDate(todayStr()); setOpen(true) }}
        className="w-full rounded-lg py-2.5 text-sm font-semibold text-white"
        style={style}
      >
        Mark Refilled
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        className="flex-1 border rounded-lg p-2 text-sm"
        style={{ borderColor: theme.bg, color: theme.navy }}
      />
      <button
        onClick={async () => { setSaving(true); await onConfirm(med.id, date); setSaving(false); setOpen(false) }}
        disabled={saving}
        className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={style}
      >
        {saving ? '…' : 'Confirm'}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs font-semibold" style={{ color: theme.sage }}>
        Cancel
      </button>
    </div>
  )
}

function MedicationCard({ med, onEdit, onConfirmRefill, onDelete, readOnly, pharmacies, onSearchDrugNames }: {
  med: MedicationDTO
  onEdit: (id: string, data: MedicationInput) => Promise<void>
  onConfirmRefill: (id: string, refillDate: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  readOnly?: boolean
  pharmacies?: PharmacyOption[]
  onSearchDrugNames?: DrugSearchFn
}) {
  const [editing, setEditing] = useState(false)
  const dueDate = addDaysStr(med.lastFillDate.slice(0, 10), med.daySupply)

  if (editing) {
    return (
      <MedicationForm
        initial={toFormValues(med)}
        submitLabel="Save Changes"
        onCancel={() => setEditing(false)}
        onSubmit={async data => { await onEdit(med.id, data); setEditing(false) }}
        pharmacies={pharmacies}
        onSearchDrugNames={onSearchDrugNames}
      />
    )
  }

  return (
    <div className="rounded-xl border shadow-sm p-4 bg-white" style={{ borderColor: theme.bg }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-bold text-base" style={{ color: theme.navy }}>{med.medicationName}</p>
          <p className="text-xs" style={{ color: theme.sage }}>
            {[med.dose, med.frequency].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        {!readOnly && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setEditing(true)} className="text-xs font-semibold" style={{ color: theme.sage }}>Edit</button>
            <button onClick={() => onDelete(med.id)} className="text-xs font-semibold text-red-500">Delete</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mb-3" style={{ color: theme.navy }}>
        <div>
          <p className="uppercase tracking-wide text-[10px]" style={{ color: theme.sage }}>Last Fill</p>
          <p className="font-semibold">{fmtDate(med.lastFillDate)}</p>
        </div>
        <div>
          <p className="uppercase tracking-wide text-[10px]" style={{ color: theme.sage }}>Due</p>
          <p className="font-semibold">{fmtDate(dueDate)}</p>
        </div>
        {med.rxNumber && (
          <div>
            <p className="uppercase tracking-wide text-[10px]" style={{ color: theme.sage }}>RX #</p>
            <p className="font-semibold font-mono">{med.rxNumber}</p>
          </div>
        )}
        {med.refillsRemaining != null && (
          <div>
            <p className="uppercase tracking-wide text-[10px]" style={{ color: theme.sage }}>Refills Left</p>
            <p className="font-semibold">{med.refillsRemaining}</p>
          </div>
        )}
        {(med.pharmacyName || med.pharmacyAddress || med.pharmacyPhone) && (
          <div className="col-span-2">
            <p className="uppercase tracking-wide text-[10px]" style={{ color: theme.sage }}>Pharmacy</p>
            <p className="font-semibold">{[med.pharmacyName, med.pharmacyPhone].filter(Boolean).join(' · ')}</p>
            {med.pharmacyAddress && <p className="opacity-80">{med.pharmacyAddress}</p>}
          </div>
        )}
      </div>

      {!readOnly && (
        <RefillButton med={med} onConfirm={onConfirmRefill} style={{ background: theme.sage }} />
      )}
    </div>
  )
}

export default function MedicationList({ patientName, medications, onAdd, onEdit, onConfirmRefill, onDelete, readOnly, pharmacies, onSearchDrugNames }: MedicationListProps) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-widest" style={{ color: theme.navy }}>
          {patientName}&rsquo;s Medications
        </p>
        {!readOnly && !adding && (
          <button onClick={() => setAdding(true)} className="text-xs font-semibold" style={{ color: theme.sage }}>
            + Add Medication
          </button>
        )}
      </div>

      {adding && (
        <MedicationForm
          initial={emptyForm}
          submitLabel="Add Medication"
          onCancel={() => setAdding(false)}
          onSubmit={async data => { await onAdd(data); setAdding(false) }}
          pharmacies={pharmacies}
          onSearchDrugNames={onSearchDrugNames}
        />
      )}

      {medications.length === 0 && !adding ? (
        <p className="text-sm italic" style={{ color: theme.sage }}>No medications on file yet.</p>
      ) : (
        <div className="space-y-3">
          {medications.map(med => (
            <MedicationCard
              key={med.id}
              med={med}
              onEdit={onEdit}
              onConfirmRefill={onConfirmRefill}
              onDelete={onDelete}
              readOnly={readOnly}
              pharmacies={pharmacies}
              onSearchDrugNames={onSearchDrugNames}
            />
          ))}
        </div>
      )}
    </div>
  )
}
