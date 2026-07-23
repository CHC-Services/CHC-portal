'use client'

import { useState } from 'react'

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
  pharmacyPhone: string
}

type MedicationListProps = {
  patientName: string
  medications: MedicationDTO[]
  onAdd: (data: MedicationInput) => Promise<void>
  onEdit: (id: string, data: MedicationInput) => Promise<void>
  onConfirmRefill: (id: string, refillDate: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  readOnly?: boolean
}

const emptyForm: MedicationInput = {
  medicationName: '', dose: '', frequency: '', daySupply: '30',
  lastFillDate: '', rxNumber: '', refillsRemaining: '', pharmacyName: '', pharmacyPhone: '',
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
    pharmacyPhone: m.pharmacyPhone || '',
  }
}

function MedicationForm({ initial, onSubmit, onCancel, submitLabel }: {
  initial: MedicationInput
  onSubmit: (data: MedicationInput) => Promise<void>
  onCancel: () => void
  submitLabel: string
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof MedicationInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const inputCls = 'w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2'
  const inputStyle = { borderColor: theme.bg, color: theme.navy } as React.CSSProperties

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.medicationName.trim() || !form.lastFillDate) return
    setSaving(true)
    await onSubmit(form)
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="space-y-2 p-3 rounded-xl" style={{ background: theme.offWhite }}>
      <input placeholder="Medication name" value={form.medicationName} onChange={set('medicationName')} required className={inputCls} style={inputStyle} />
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
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Pharmacy name" value={form.pharmacyName} onChange={set('pharmacyName')} className={inputCls} style={inputStyle} />
        <input placeholder="Pharmacy phone" value={form.pharmacyPhone} onChange={set('pharmacyPhone')} className={inputCls} style={inputStyle} />
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

function MedicationCard({ med, onEdit, onConfirmRefill, onDelete, readOnly }: {
  med: MedicationDTO
  onEdit: (id: string, data: MedicationInput) => Promise<void>
  onConfirmRefill: (id: string, refillDate: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  readOnly?: boolean
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
        {(med.pharmacyName || med.pharmacyPhone) && (
          <div className="col-span-2">
            <p className="uppercase tracking-wide text-[10px]" style={{ color: theme.sage }}>Pharmacy</p>
            <p className="font-semibold">{[med.pharmacyName, med.pharmacyPhone].filter(Boolean).join(' · ')}</p>
          </div>
        )}
      </div>

      {!readOnly && (
        <RefillButton med={med} onConfirm={onConfirmRefill} style={{ background: theme.sage }} />
      )}
    </div>
  )
}

export default function MedicationList({ patientName, medications, onAdd, onEdit, onConfirmRefill, onDelete, readOnly }: MedicationListProps) {
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
