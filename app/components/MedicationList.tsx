'use client'

import { useState, useRef } from 'react'
import DateInput from './DateInput'

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

export type RefillStatus = 'due' | 'overdue' | 'ordered' | 'filled'

export type MedicationDTO = {
  id: string
  medicationName: string
  rxcui: string | null
  dose: string | null
  unitStrength: string | null
  frequency: string | null
  daySupply: number
  lastFillDate: string // ISO date string
  rxNumber: string | null
  refillsRemaining: number | null
  pharmacyName: string | null
  pharmacyAddress: string | null
  pharmacyPhone: string | null
  active: boolean
  refillStatus: RefillStatus
  refillOrderedAt: string | null // ISO date string, set while refillStatus === 'ordered'
}

export type MedicationInput = {
  medicationName: string
  rxcui: string
  dose: string
  unitStrength: string
  frequency: string
  daySupply: string
  lastFillDate: string
  rxNumber: string
  refillsRemaining: string
  pharmacyName: string
  pharmacyAddress: string
  pharmacyPhone: string
}

// Parses a leading numeric amount + optional unit off a free-typed string
// ("15mg" -> {value: 15, unit: 'mg'}, "1.5 tablets" -> {value: 1.5, unit: 'tablets'}).
function parseAmount(s: string): { value: number; unit: string } | null {
  const m = s.trim().match(/^([\d.]+)\s*([a-zA-Z]*)/)
  if (!m) return null
  const value = parseFloat(m[1])
  if (!isFinite(value) || value <= 0) return null
  return { value, unit: m[2].toLowerCase() }
}

// How many tablets/units of the on-hand strength make up the patient's
// prescribed dose (e.g. dose "15mg" over unitStrength "10mg" -> 1.5). Returns
// null rather than guessing if either side doesn't parse or units disagree
// (e.g. mg vs mcg) — a wrong count here is a medication-safety issue.
export function computeUnitsPerDose(dose: string | null | undefined, unitStrength: string | null | undefined): number | null {
  if (!dose || !unitStrength) return null
  const d = parseAmount(dose)
  const u = parseAmount(unitStrength)
  if (!d || !u) return null
  if (d.unit && u.unit && d.unit !== u.unit) return null
  return d.value / u.value
}

function fmtUnits(n: number): string {
  return (Math.round(n * 100) / 100).toString()
}

export type PharmacyOption = {
  id: string
  name: string
  address: string | null
  phone: string | null
}

export type DrugNameOption = { name: string; rxcui: string | null }
export type DrugSearchFn = (q: string) => Promise<{ exact: DrugNameOption[]; suggested: DrugNameOption[] }>
export type DrugFactsResult = { title: string; summary: string; url: string } | null
export type DrugFactsFn = (med: { rxcui: string | null; medicationName: string }) => Promise<DrugFactsResult>

type MedicationListProps = {
  patientName: string
  medications: MedicationDTO[]
  onAdd: (data: MedicationInput) => Promise<void>
  onEdit: (id: string, data: MedicationInput) => Promise<void>
  onConfirmRefill: (id: string, refillDate: string, daySupply: string) => Promise<void>
  onOrderRefill: (id: string, orderedDate: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  readOnly?: boolean
  pharmacies?: PharmacyOption[]
  onSearchDrugNames?: DrugSearchFn
  onFetchDrugFacts?: DrugFactsFn
}

const emptyForm: MedicationInput = {
  medicationName: '', rxcui: '', dose: '', unitStrength: '', frequency: '', daySupply: '30',
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
    rxcui: m.rxcui || '',
    dose: m.dose || '',
    unitStrength: m.unitStrength || '',
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
  const [drugSuggestions, setDrugSuggestions] = useState<DrugNameOption[]>([])
  const [drugAltSuggestions, setDrugAltSuggestions] = useState<DrugNameOption[]>([])
  const [activeDrugIdx, setActiveDrugIdx] = useState(0)
  const drugSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const set = (k: keyof MedicationInput) => (e: { target: { value: string } }) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const inputCls = 'w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2'
  const inputStyle = { borderColor: theme.bg, color: theme.navy } as React.CSSProperties
  const unitsPerDose = computeUnitsPerDose(form.dose, form.unitStrength)

  function handleMedicationNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    // Free-typing invalidates any previously-selected rxcui — it no longer
    // necessarily matches what's on screen.
    setForm(f => ({ ...f, medicationName: value, rxcui: '' }))
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

  function selectDrugName(option: DrugNameOption) {
    setForm(f => ({ ...f, medicationName: option.name, rxcui: option.rxcui || '' }))
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
            {drugSuggestions.map((option, i) => (
              <button
                key={option.name}
                type="button"
                onMouseDown={() => selectDrugName(option)}
                onMouseEnter={() => setActiveDrugIdx(i)}
                className="block w-full text-left px-3 py-2 text-sm"
                style={i === activeDrugIdx ? { background: theme.navy, color: 'white' } : { color: theme.navy }}
              >
                {option.name}
              </button>
            ))}
            {drugAltSuggestions.length > 0 && (
              <>
                <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide font-semibold" style={{ color: theme.sage }}>Did you mean…</p>
                {drugAltSuggestions.map((option, i) => {
                  const idx = drugSuggestions.length + i
                  return (
                    <button
                      key={option.name}
                      type="button"
                      onMouseDown={() => selectDrugName(option)}
                      onMouseEnter={() => setActiveDrugIdx(idx)}
                      className="block w-full text-left px-3 py-2 text-sm"
                      style={idx === activeDrugIdx ? { background: theme.navy, color: 'white' } : { color: theme.navy }}
                    >
                      {option.name}
                    </button>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Prescribed dose (e.g. 15mg)" value={form.dose} onChange={set('dose')} className={inputCls} style={inputStyle} />
        <input placeholder="Frequency (e.g. daily)" value={form.frequency} onChange={set('frequency')} className={inputCls} style={inputStyle} />
      </div>
      <div>
        <input placeholder="Unit strength on hand (e.g. 10mg/tablet)" value={form.unitStrength} onChange={set('unitStrength')} className={inputCls} style={inputStyle} />
        {unitsPerDose != null && (
          <p className="text-[10px] mt-1 font-semibold" style={{ color: theme.sage }}>
            = {fmtUnits(unitsPerDose)} unit(s) per dose ({form.dose} ÷ {form.unitStrength})
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] uppercase tracking-wide mb-0.5" style={{ color: theme.sage }}>Last Fill</label>
          <DateInput value={form.lastFillDate} onChange={set('lastFillDate')} required className={inputCls} style={inputStyle} />
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

const refillStatusMeta: Record<RefillStatus, { label: string; bg: string; text: string }> = {
  due: { label: 'Refill Due', bg: '#FEF3C7', text: '#92400E' },
  overdue: { label: 'Refill Overdue', bg: '#FEE2E2', text: '#B91C1C' },
  ordered: { label: 'Refill Ordered', bg: '#DBEAFE', text: '#1D4ED8' },
  filled: { label: 'Filled', bg: theme.offWhite, text: theme.sage },
}

function RefillStatusBadge({ status }: { status: RefillStatus }) {
  const meta = refillStatusMeta[status]
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: meta.bg, color: meta.text }}>
      {meta.label}
    </span>
  )
}

// Buttons only populate once a refill is due/overdue (or already ordered, in
// which case only "RX Filled" remains — no double-ordering in the same cycle).
// "RX Ordered" just logs the date the order was placed with the pharmacy and
// silences the reminder for everyone on the account until it's picked up.
// "RX Filled" is the actual restock: prompts for the fill date, pre-fills the
// day supply from the current value (editable), and clears any in-flight order.
function RefillActions({ med, onConfirmRefill, onOrderRefill }: {
  med: MedicationDTO
  onConfirmRefill: (id: string, refillDate: string, daySupply: string) => Promise<void>
  onOrderRefill: (id: string, orderedDate: string) => Promise<void>
}) {
  const [prompt, setPrompt] = useState<'order' | 'fill' | null>(null)
  const [date, setDate] = useState(todayStr())
  const [daySupply, setDaySupply] = useState(String(med.daySupply))
  const [saving, setSaving] = useState(false)

  if (prompt === 'order') {
    return (
      <div className="flex items-center gap-2">
        <DateInput
          value={date}
          onChange={e => setDate(e.target.value)}
          className="flex-1 border rounded-lg p-2 text-sm"
          style={{ borderColor: theme.bg, color: theme.navy }}
        />
        <button
          onClick={async () => { setSaving(true); await onOrderRefill(med.id, date); setSaving(false); setPrompt(null) }}
          disabled={saving}
          className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: theme.navy }}
        >
          {saving ? '…' : 'Confirm'}
        </button>
        <button onClick={() => setPrompt(null)} className="text-xs font-semibold" style={{ color: theme.sage }}>
          Cancel
        </button>
      </div>
    )
  }

  if (prompt === 'fill') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <DateInput
            value={date}
            onChange={e => setDate(e.target.value)}
            className="flex-1 border rounded-lg p-2 text-sm"
            style={{ borderColor: theme.bg, color: theme.navy }}
          />
          <input
            type="number"
            min="1"
            value={daySupply}
            onChange={e => setDaySupply(e.target.value)}
            placeholder="Day supply"
            className="w-24 border rounded-lg p-2 text-sm"
            style={{ borderColor: theme.bg, color: theme.navy }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => { setSaving(true); await onConfirmRefill(med.id, date, daySupply); setSaving(false); setPrompt(null) }}
            disabled={saving}
            className="flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: theme.sage }}
          >
            {saving ? '…' : 'Confirm Filled'}
          </button>
          <button onClick={() => setPrompt(null)} className="text-xs font-semibold" style={{ color: theme.sage }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      {med.refillStatus !== 'ordered' && (
        <button
          onClick={() => { setDate(todayStr()); setPrompt('order') }}
          className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white"
          style={{ background: theme.navy }}
        >
          RX Ordered
        </button>
      )}
      <button
        onClick={() => { setDate(todayStr()); setDaySupply(String(med.daySupply)); setPrompt('fill') }}
        className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white"
        style={{ background: theme.sage }}
      >
        RX Filled
      </button>
    </div>
  )
}

function DrugFactsModal({ medicationName, facts, loading, onClose }: {
  medicationName: string
  facts: DrugFactsResult
  loading: boolean
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        {loading ? (
          <p className="text-sm py-8 text-center" style={{ color: theme.sage }}>Loading drug facts…</p>
        ) : !facts ? (
          <>
            <p className="font-bold text-base mb-2" style={{ color: theme.navy }}>{medicationName}</p>
            <p className="text-sm" style={{ color: theme.sage }}>No drug facts found for this medication name. Try re-selecting it from the typeahead when editing.</p>
          </>
        ) : (
          <>
            <p className="font-bold text-base mb-2" style={{ color: theme.navy }}>{facts.title}</p>
            <p className="text-sm whitespace-pre-line mb-4" style={{ color: theme.navy }}>{facts.summary}</p>
            <a href={facts.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline" style={{ color: theme.sage }}>
              Full details on MedlinePlus ↗
            </a>
          </>
        )}
        <button onClick={onClose} className="mt-4 w-full rounded-lg py-2 text-sm font-semibold border" style={{ borderColor: theme.bg, color: theme.sage }}>
          Close
        </button>
      </div>
    </div>
  )
}

function MedicationCard({ med, onEdit, onConfirmRefill, onOrderRefill, onDelete, readOnly, pharmacies, onSearchDrugNames, onFetchDrugFacts }: {
  med: MedicationDTO
  onEdit: (id: string, data: MedicationInput) => Promise<void>
  onConfirmRefill: (id: string, refillDate: string, daySupply: string) => Promise<void>
  onOrderRefill: (id: string, orderedDate: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  readOnly?: boolean
  pharmacies?: PharmacyOption[]
  onSearchDrugNames?: DrugSearchFn
  onFetchDrugFacts?: DrugFactsFn
}) {
  const [editing, setEditing] = useState(false)
  const [showFacts, setShowFacts] = useState(false)
  const [factsLoading, setFactsLoading] = useState(false)
  const [facts, setFacts] = useState<DrugFactsResult>(null)
  const dueDate = addDaysStr(med.lastFillDate.slice(0, 10), med.daySupply)

  async function handleShowFacts() {
    if (!onFetchDrugFacts) return
    setShowFacts(true)
    setFactsLoading(true)
    const result = await onFetchDrugFacts({ rxcui: med.rxcui, medicationName: med.medicationName })
    setFacts(result)
    setFactsLoading(false)
  }

  const unitsPerDose = computeUnitsPerDose(med.dose, med.unitStrength)

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
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-base" style={{ color: theme.navy }}>{med.medicationName}</p>
            <RefillStatusBadge status={med.refillStatus} />
            {onFetchDrugFacts && (
              <button onClick={handleShowFacts} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0" style={{ borderColor: theme.sage, color: theme.sage }}>
                Drug Facts
              </button>
            )}
          </div>
          <p className="text-xs" style={{ color: theme.sage }}>
            {[med.dose, med.frequency].filter(Boolean).join(' · ') || '—'}
            {med.unitStrength && ` · ${med.unitStrength} on hand`}
          </p>
        </div>
        {!readOnly && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setEditing(true)} className="text-xs font-semibold" style={{ color: theme.sage }}>Edit</button>
            <button onClick={() => onDelete(med.id)} className="text-xs font-semibold text-red-500">Delete</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-3" style={{ color: theme.navy }}>
        <div className="flex items-baseline gap-1 min-w-0">
          <span className="uppercase tracking-wide text-[10px] shrink-0" style={{ color: theme.sage }}>Last Fill:</span>
          <span className="font-semibold truncate">{fmtDate(med.lastFillDate)}</span>
        </div>
        <div className="flex items-baseline gap-1 min-w-0 flex-wrap">
          <span className="uppercase tracking-wide text-[10px] shrink-0" style={{ color: theme.sage }}>Due:</span>
          <span className="font-semibold truncate">{fmtDate(dueDate)}</span>
          {med.refillStatus === 'ordered' && med.refillOrderedAt && (
            <span className="text-[10px] font-semibold" style={{ color: refillStatusMeta.ordered.text }}>
              · Ordered {fmtDate(med.refillOrderedAt)}
            </span>
          )}
        </div>
        {med.rxNumber && (
          <div className="flex items-baseline gap-1 min-w-0">
            <span className="uppercase tracking-wide text-[10px] shrink-0" style={{ color: theme.sage }}>RX #:</span>
            <span className="font-semibold font-mono truncate">{med.rxNumber}</span>
          </div>
        )}
        {med.refillsRemaining != null && (
          <div className="flex items-baseline gap-1 min-w-0">
            <span className="uppercase tracking-wide text-[10px] shrink-0" style={{ color: theme.sage }}>Refills Left:</span>
            <span className="font-semibold">{med.refillsRemaining}</span>
          </div>
        )}
        {unitsPerDose != null && (
          <div className="flex items-baseline gap-1 min-w-0">
            <span className="uppercase tracking-wide text-[10px] shrink-0" style={{ color: theme.sage }}>Per Dose:</span>
            <span className="font-semibold">{fmtUnits(unitsPerDose)} unit(s)</span>
          </div>
        )}
        {(med.pharmacyName || med.pharmacyAddress || med.pharmacyPhone) && (
          <div className="col-span-2 flex items-baseline gap-1 flex-wrap">
            <span className="uppercase tracking-wide text-[10px] shrink-0" style={{ color: theme.sage }}>Pharmacy:</span>
            <span className="font-semibold">{[med.pharmacyName, med.pharmacyPhone].filter(Boolean).join(' · ')}</span>
            {med.pharmacyAddress && <span className="opacity-80">· {med.pharmacyAddress}</span>}
          </div>
        )}
      </div>

      {!readOnly && med.refillStatus !== 'filled' && (
        <RefillActions med={med} onConfirmRefill={onConfirmRefill} onOrderRefill={onOrderRefill} />
      )}

      {showFacts && (
        <DrugFactsModal
          medicationName={med.medicationName}
          facts={facts}
          loading={factsLoading}
          onClose={() => setShowFacts(false)}
        />
      )}
    </div>
  )
}

export default function MedicationList({ patientName, medications, onAdd, onEdit, onConfirmRefill, onOrderRefill, onDelete, readOnly, pharmacies, onSearchDrugNames, onFetchDrugFacts }: MedicationListProps) {
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
              onOrderRefill={onOrderRefill}
              onDelete={onDelete}
              readOnly={readOnly}
              pharmacies={pharmacies}
              onSearchDrugNames={onSearchDrugNames}
              onFetchDrugFacts={onFetchDrugFacts}
            />
          ))}
        </div>
      )}
    </div>
  )
}
