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
  doseUnit: string | null
  unitStrength: string | null
  unitType: string | null
  frequency: string | null
  route: string | null
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
  doseUnit: string
  unitStrength: string
  unitType: string
  frequency: string
  route: string
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
// prescribed dose (e.g. dose 15 doseUnit "mg" over unitStrength "10mg" ->
// 1.5). Returns null rather than guessing if either side doesn't parse or
// units disagree (e.g. mg vs mcg) — a wrong count here is a medication-safety issue.
export function computeUnitsPerDose(
  dose: string | null | undefined,
  doseUnit: string | null | undefined,
  unitStrength: string | null | undefined
): number | null {
  if (!dose || !unitStrength) return null
  const d = parseFloat(dose)
  if (!isFinite(d) || d <= 0) return null
  const u = parseAmount(unitStrength)
  if (!u) return null
  if (doseUnit && u.unit && doseUnit.toLowerCase() !== u.unit.toLowerCase()) return null
  return d / u.value
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
  medicationName: '', rxcui: '', dose: '', doseUnit: '', unitStrength: '', unitType: '', frequency: '', route: '', daySupply: '30',
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

// ─── Prescribed-administration dropdown option lists ───────────────────────
// Dose unit: standard pharmacy units of measure. Frequency: ISMP recommends
// spelling frequency out rather than using Latin-derived abbreviations (QD,
// QOD, etc. are on ISMP's error-prone abbreviation list — easy to
// misinterpret) — canonical value below IS the label, spelled out. Route:
// common home-health administration routes.
const DOSE_UNIT_OPTIONS = [
  'mg', 'mcg', 'g', 'mL', 'L', 'unit', 'mEq', '%',
  'tablet', 'capsule', 'puff', 'spray', 'drop', 'patch', 'application',
]

const FREQUENCY_OPTIONS = [
  'Once daily', 'Twice daily', 'Three times daily', 'Four times daily',
  'Every other day', 'At bedtime', 'Every morning', 'Before meals', 'After meals',
  'As needed (PRN)', 'Every 4 hours', 'Every 6 hours', 'Every 8 hours', 'Every 12 hours',
  'Weekly', 'Twice weekly', 'Monthly',
]

const ROUTE_OPTIONS = [
  'By mouth (PO)', 'G-Tube', 'J-Tube', 'NG-Tube', 'Sublingual', 'Buccal',
  'Rectal', 'Vaginal', 'Topical', 'Transdermal', 'Inhalation', 'Nebulizer',
  'Intranasal', 'Ophthalmic (eye)', 'Otic (ear)',
  'Intramuscular (IM)', 'Subcutaneous (SQ)', 'Intravenous (IV)',
]

// Normalizes a free-typed shorthand ("qd", "q.i.d.", "po") to its standardized
// dropdown value, so typing a familiar clinical abbreviation into "Other"
// still lands on the same consistent term everyone else picked from the list.
// Keyed on the alias with punctuation/spaces stripped, lowercased.
function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/[.\s-]/g, '')
}

function buildAliasMap(pairs: [string[], string][]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [aliases, canonical] of pairs) {
    for (const alias of aliases) map[normalizeKey(alias)] = canonical
  }
  return map
}

const FREQUENCY_ALIASES = buildAliasMap([
  [['qd', 'od', 'once daily', 'daily'], 'Once daily'],
  [['bid'], 'Twice daily'],
  [['tid'], 'Three times daily'],
  [['qid'], 'Four times daily'],
  [['qod'], 'Every other day'],
  [['qhs', 'hs'], 'At bedtime'],
  [['qam'], 'Every morning'],
  [['ac'], 'Before meals'],
  [['pc'], 'After meals'],
  [['prn'], 'As needed (PRN)'],
  [['q4h', 'q4hr', 'q4hrs', 'q4'], 'Every 4 hours'],
  [['q6h', 'q6hr', 'q6hrs', 'q6'], 'Every 6 hours'],
  [['q8h', 'q8hr', 'q8hrs', 'q8'], 'Every 8 hours'],
  [['q12h', 'q12hr', 'q12hrs', 'q12'], 'Every 12 hours'],
  [['qwk', 'weekly'], 'Weekly'],
  [['biw', '2xweek', '2xwk'], 'Twice weekly'],
  [['qmo', 'monthly'], 'Monthly'],
])

const ROUTE_ALIASES = buildAliasMap([
  [['po'], 'By mouth (PO)'],
  [['gt', 'gtube'], 'G-Tube'],
  [['jt', 'jtube'], 'J-Tube'],
  [['ng', 'ngt', 'ngtube'], 'NG-Tube'],
  [['sl'], 'Sublingual'],
  [['pr'], 'Rectal'],
  [['pv'], 'Vaginal'],
  [['top'], 'Topical'],
  [['td'], 'Transdermal'],
  [['inh'], 'Inhalation'],
  [['neb'], 'Nebulizer'],
  [['ophth', 'eye'], 'Ophthalmic (eye)'],
  [['otic', 'ear'], 'Otic (ear)'],
  [['im'], 'Intramuscular (IM)'],
  [['sq', 'subq', 'sc'], 'Subcutaneous (SQ)'],
  [['iv'], 'Intravenous (IV)'],
])

const DOSE_UNIT_ALIASES = buildAliasMap([
  [['mcg', 'ug', 'microgram', 'micrograms'], 'mcg'],
  [['mg', 'milligram', 'milligrams'], 'mg'],
  [['ml', 'milliliter', 'milliliters'], 'mL'],
  [['unit', 'units'], 'unit'],
  [['tab', 'tabs', 'tablet', 'tablets'], 'tablet'],
  [['cap', 'caps', 'capsule', 'capsules'], 'capsule'],
  [['puff', 'puffs'], 'puff'],
  [['spray', 'sprays'], 'spray'],
  [['drop', 'drops', 'gtt', 'gtts'], 'drop'],
  [['patch', 'patches'], 'patch'],
])

// A <select> of preset values, with an "Other…" option that reveals a free
// text input. Typing a recognized clinical shorthand into that text input
// (e.g. "qd", "q.i.d.", "po") snaps back to the matching standardized preset
// on blur, so a shortcut typed by habit still lands on the same term everyone
// else picked from the dropdown.
function DropdownOrOther({ value, onChange, options, aliases, otherPlaceholder, className, style }: {
  value: string
  onChange: (v: string) => void
  options: string[]
  aliases?: Record<string, string>
  otherPlaceholder: string
  className: string
  style: React.CSSProperties
}) {
  const isPreset = value === '' || options.includes(value)
  const [customMode, setCustomMode] = useState(!isPreset)

  function handleBlur() {
    const canonical = aliases?.[normalizeKey(value)]
    if (canonical) {
      onChange(canonical)
      setCustomMode(false)
    }
  }

  if (customMode) {
    return (
      <div className="inline-flex items-center gap-1">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={otherPlaceholder}
          className={className}
          style={style}
        />
        <button
          type="button"
          onClick={() => { setCustomMode(false); onChange('') }}
          title="Choose from list instead"
          className="text-xs shrink-0"
          style={{ color: theme.sage }}
        >
          ↩
        </button>
      </div>
    )
  }

  return (
    <select
      value={value}
      onChange={e => {
        if (e.target.value === '__other__') { setCustomMode(true); onChange('') }
        else onChange(e.target.value)
      }}
      className={className}
      style={style}
    >
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
      <option value="__other__">Other…</option>
    </select>
  )
}

function toFormValues(m: MedicationDTO): MedicationInput {
  return {
    medicationName: m.medicationName,
    rxcui: m.rxcui || '',
    dose: m.dose || '',
    doseUnit: m.doseUnit || '',
    unitStrength: m.unitStrength || '',
    unitType: m.unitType || '',
    frequency: m.frequency || '',
    route: m.route || '',
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
  // Unlike inputCls, doesn't force full width — paired with an explicit w-*
  // so fields with a known bounded length (day supply, refill count, dates,
  // phone numbers, on-hand dose/type) don't stretch across the whole row.
  const narrowCls = 'border rounded-lg p-2 text-sm focus:outline-none focus:ring-2'
  const inputStyle = { borderColor: theme.bg, color: theme.navy } as React.CSSProperties
  const unitsPerDose = computeUnitsPerDose(form.dose, form.doseUnit, form.unitStrength)

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
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <input
            placeholder="Medication Name"
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
        <input placeholder="Dose (e.g. 10mg)" value={form.unitStrength} onChange={set('unitStrength')} className={`${narrowCls} w-28`} style={inputStyle} />
        <input placeholder="Dose Form (e.g. tablet)" value={form.unitType} onChange={set('unitType')} className={`${narrowCls} w-32`} style={inputStyle} />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wide mb-1" style={{ color: theme.sage }}>Prescribed Administration</label>
        <div className="flex flex-wrap items-center gap-1.5 text-sm" style={{ color: theme.navy }}>
          <span><strong>SIG:</strong>Administer</span>
          <input type="number" step="any" min="0" placeholder="dose" value={form.dose} onChange={set('dose')} className={`${narrowCls} w-16`} style={inputStyle} />
          <DropdownOrOther
            value={form.doseUnit}
            onChange={v => setForm(f => ({ ...f, doseUnit: v }))}
            options={DOSE_UNIT_OPTIONS}
            aliases={DOSE_UNIT_ALIASES}
            otherPlaceholder="unit"
            className={`${narrowCls} w-20`}
            style={inputStyle}
          />
          <DropdownOrOther
            value={form.frequency}
            onChange={v => setForm(f => ({ ...f, frequency: v }))}
            options={FREQUENCY_OPTIONS}
            aliases={FREQUENCY_ALIASES}
            otherPlaceholder="frequency"
            className={`${narrowCls} w-36`}
            style={inputStyle}
          />
          <span>via</span>
          <DropdownOrOther
            value={form.route}
            onChange={v => setForm(f => ({ ...f, route: v }))}
            options={ROUTE_OPTIONS}
            aliases={ROUTE_ALIASES}
            otherPlaceholder="route"
            className={`${narrowCls} w-32`}
            style={inputStyle}
          />
        </div>
        {unitsPerDose != null && (
          <p className="text-[10px] mt-1 font-semibold" style={{ color: theme.sage }}>
            = {fmtUnits(unitsPerDose)} unit(s) per dose ({form.dose}{form.doseUnit} ÷ {form.unitStrength})
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <div>
          <label className="block text-[10px] uppercase tracking-wide mb-0.5" style={{ color: theme.sage }}>Last Fill</label>
          <DateInput value={form.lastFillDate} onChange={set('lastFillDate')} required className={`${narrowCls} w-28`} style={inputStyle} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide mb-0.5" style={{ color: theme.sage }}>Day Supply</label>
          <input type="number" min="1" value={form.daySupply} onChange={set('daySupply')} className={`${narrowCls} w-16`} style={inputStyle} />
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-[10px] uppercase tracking-wide mb-0.5" style={{ color: theme.sage }}>RX #</label>
          <input placeholder="RX #" value={form.rxNumber} onChange={set('rxNumber')} className={inputCls} style={inputStyle} />
        </div>
      </div>

      <div className="flex gap-2 items-start">
        <div className="relative flex-1 min-w-0">
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
        <div>
          <label className="block text-[10px] uppercase tracking-wide mb-0.5" style={{ color: theme.sage }}>Refills Left</label>
          <input type="number" min="0" value={form.refillsRemaining} onChange={set('refillsRemaining')} className={`${narrowCls} w-14`} style={inputStyle} />
        </div>
      </div>

      <div className="flex gap-2">
        <input placeholder="Pharmacy address" value={form.pharmacyAddress} onChange={set('pharmacyAddress')} className={`${inputCls} flex-1 min-w-0`} style={inputStyle} />
        <input placeholder="Pharmacy phone" value={form.pharmacyPhone} onChange={e => setForm(f => ({ ...f, pharmacyPhone: fmtPhoneInput(e.target.value) }))} className={`${narrowCls} w-36`} style={inputStyle} />
      </div>
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

function adminSentenceOf(med: Pick<MedicationDTO, 'medicationName' | 'dose' | 'doseUnit' | 'frequency' | 'route'>): string | null {
  const doseText = med.dose ? `${med.dose}${med.doseUnit || ''}` : null
  const parts = [doseText, med.frequency].filter(Boolean).join(' ')
  if (!parts && !med.route) return null
  return `Administer ${med.medicationName}${parts ? ` ${parts}` : ''}${med.route ? ` via ${med.route}` : ''}.`
}

function onHandOf(med: Pick<MedicationDTO, 'unitStrength' | 'unitType'>): string {
  return [med.unitStrength, med.unitType].filter(Boolean).join(' ')
}

// One line of the data sheet — plain read-only cells, no per-row action
// controls. Clicking anywhere on the row opens MedicationDetailModal, which
// owns editing/refill/delete/drug-facts so the sheet itself stays dense and scannable.
function MedicationRow({ med, onClick }: { med: MedicationDTO; onClick: () => void }) {
  const dueDate = addDaysStr(med.lastFillDate.slice(0, 10), med.daySupply)
  const cellCls = 'px-3 py-2 align-top whitespace-nowrap'
  return (
    <tr onClick={onClick} className="cursor-pointer border-b last:border-b-0 hover:bg-black/[0.02]" style={{ borderColor: theme.bg }}>
      <td className={cellCls}>
        <p className="font-semibold" style={{ color: theme.navy }}>{med.medicationName}</p>
      </td>
      <td className={`${cellCls} text-xs`} style={{ color: theme.navy }}>{onHandOf(med) || '—'}</td>
      <td className={`${cellCls} text-xs whitespace-normal min-w-[14rem]`} style={{ color: theme.navy }}>{adminSentenceOf(med) || '—'}</td>
      <td className={`${cellCls} text-xs`} style={{ color: theme.navy }}>{med.daySupply}d</td>
      <td className={`${cellCls} text-xs`} style={{ color: theme.navy }}>{fmtDate(med.lastFillDate)}</td>
      <td className={`${cellCls} text-xs`} style={{ color: theme.navy }}>{fmtDate(dueDate)}</td>
      <td className={cellCls}><RefillStatusBadge status={med.refillStatus} /></td>
      <td className={`${cellCls} text-xs font-mono`} style={{ color: theme.navy }}>{med.rxNumber || '—'}</td>
      <td className={`${cellCls} text-xs`} style={{ color: theme.navy }}>{med.refillsRemaining ?? '—'}</td>
      <td className={`${cellCls} text-xs`} style={{ color: theme.navy }}>{med.pharmacyName || '—'}</td>
    </tr>
  )
}

const tableHeaders = ['Medication', 'On Hand', 'Prescribed Administration', 'Supply', 'Last Fill', 'Due', 'Status', 'RX #', 'Refills', 'Pharmacy']

function MedicationTable({ medications, onSelect }: { medications: MedicationDTO[]; onSelect: (med: MedicationDTO) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: theme.bg }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: theme.offWhite }}>
            {tableHeaders.map(h => (
              <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: theme.sage }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {medications.map(med => (
            <MedicationRow key={med.id} med={med} onClick={() => onSelect(med)} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Side panel opened by clicking a row (or "+ Add Medication"). Owns the
// read/edit toggle, refill workflow, delete, and drug-facts lookup — the one
// place per medication where those actions live, keeping MedicationTable pure display.
function MedicationDetailModal({ med, onAdd, onEdit, onConfirmRefill, onOrderRefill, onDelete, onClose, readOnly, pharmacies, onSearchDrugNames, onFetchDrugFacts }: {
  med: MedicationDTO | null // null = "add new" mode
  onAdd?: (data: MedicationInput) => Promise<void>
  onEdit: (id: string, data: MedicationInput) => Promise<void>
  onConfirmRefill: (id: string, refillDate: string, daySupply: string) => Promise<void>
  onOrderRefill: (id: string, orderedDate: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
  readOnly?: boolean
  pharmacies?: PharmacyOption[]
  onSearchDrugNames?: DrugSearchFn
  onFetchDrugFacts?: DrugFactsFn
}) {
  const [editing, setEditing] = useState(!med)
  const [showFacts, setShowFacts] = useState(false)
  const [factsLoading, setFactsLoading] = useState(false)
  const [facts, setFacts] = useState<DrugFactsResult>(null)

  async function handleShowFacts() {
    if (!onFetchDrugFacts || !med) return
    setShowFacts(true)
    setFactsLoading(true)
    const result = await onFetchDrugFacts({ rxcui: med.rxcui, medicationName: med.medicationName })
    setFacts(result)
    setFactsLoading(false)
  }

  const unitsPerDose = med ? computeUnitsPerDose(med.dose, med.doseUnit, med.unitStrength) : null
  const dueDate = med ? addDaysStr(med.lastFillDate.slice(0, 10), med.daySupply) : null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        {editing ? (
          <MedicationForm
            initial={med ? toFormValues(med) : emptyForm}
            submitLabel={med ? 'Save Changes' : 'Add Medication'}
            onCancel={() => (med ? setEditing(false) : onClose())}
            onSubmit={async data => {
              if (med) { await onEdit(med.id, data); setEditing(false) }
              else { await onAdd?.(data); onClose() }
            }}
            pharmacies={pharmacies}
            onSearchDrugNames={onSearchDrugNames}
          />
        ) : med && (
          <>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-lg" style={{ color: theme.navy }}>{med.medicationName}</p>
                <RefillStatusBadge status={med.refillStatus} />
              </div>
              {!readOnly && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditing(true)} className="text-xs font-semibold" style={{ color: theme.sage }}>Edit</button>
                  <button onClick={async () => { await onDelete(med.id); onClose() }} className="text-xs font-semibold text-red-500">Delete</button>
                </div>
              )}
            </div>

            <p className="text-sm mb-1" style={{ color: theme.navy }}>{adminSentenceOf(med) || '—'}</p>
            {onHandOf(med) && <p className="text-xs mb-3" style={{ color: theme.sage }}>{onHandOf(med)} on hand</p>}

            {onFetchDrugFacts && (
              <button onClick={handleShowFacts} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 mb-3" style={{ borderColor: theme.sage, color: theme.sage }}>
                Drug Facts
              </button>
            )}

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-3" style={{ color: theme.navy }}>
              <div className="flex items-baseline gap-1 min-w-0">
                <span className="uppercase tracking-wide text-[10px] shrink-0" style={{ color: theme.sage }}>Last Fill:</span>
                <span className="font-semibold truncate">{fmtDate(med.lastFillDate)}</span>
              </div>
              <div className="flex items-baseline gap-1 min-w-0 flex-wrap">
                <span className="uppercase tracking-wide text-[10px] shrink-0" style={{ color: theme.sage }}>Due:</span>
                <span className="font-semibold truncate">{dueDate && fmtDate(dueDate)}</span>
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

            <button onClick={onClose} className="mt-4 w-full rounded-lg py-2 text-sm font-semibold border" style={{ borderColor: theme.bg, color: theme.sage }}>
              Close
            </button>

            {showFacts && (
              <DrugFactsModal
                medicationName={med.medicationName}
                facts={facts}
                loading={factsLoading}
                onClose={() => setShowFacts(false)}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function MedicationList({ patientName, medications, onAdd, onEdit, onConfirmRefill, onOrderRefill, onDelete, readOnly, pharmacies, onSearchDrugNames, onFetchDrugFacts }: MedicationListProps) {
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<MedicationDTO | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-widest" style={{ color: theme.navy }}>
          Medications
        </p>
        {!readOnly && (
          <button onClick={() => setAdding(true)} className="text-xs font-semibold" style={{ color: theme.sage }}>
            + Add Medication
          </button>
        )}
      </div>

      {medications.length === 0 ? (
        <p className="text-sm italic" style={{ color: theme.sage }}>No medications on file yet.</p>
      ) : (
        <MedicationTable medications={medications} onSelect={setSelected} />
      )}

      {(adding || selected) && (
        <MedicationDetailModal
          med={selected}
          onAdd={onAdd}
          onEdit={onEdit}
          onConfirmRefill={onConfirmRefill}
          onOrderRefill={onOrderRefill}
          onDelete={onDelete}
          onClose={() => { setAdding(false); setSelected(null) }}
          readOnly={readOnly}
          pharmacies={pharmacies}
          onSearchDrugNames={onSearchDrugNames}
          onFetchDrugFacts={onFetchDrugFacts}
        />
      )}
    </div>
  )
}
