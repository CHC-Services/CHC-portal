'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { shortInvoiceNumber } from '../../../lib/formatInvoice'
import { formalName } from '../../../lib/formatName'
import DateInput from '../../components/DateInput'

// ── Types ────────────────────────────────────────────────────────────────────

type Invoice = {
  id: string
  invoiceNumber: string
  nurseId: string
  nurseName: string
  nurseEmail: string
  totalAmount: number
  paidAmount: number
  status: string
  dueTerm: string
  dueDate: string
  sentAt: string
  paidAt?: string
  s3Key?: string
  notes?: string
  lateFeePlan?: string | null
  lateFeeAmt?: number | null
  lateFeePercent?: number | null
  promptPayDays?: number | null
  promptPayCredit?: number | null
  nurse?: { displayName: string; accountNumber: string | null }
  payments?: Payment[]
  entries?: { id: string }[]
}

type Payment = {
  id: string
  invoiceId: string
  receiptNumber: string
  amount: number
  method?: string
  note?: string
  s3Key?: string
  appliedAt: string
}

type Stats = {
  pending:    { amount: number; count: number }
  sent:       { amount: number; count: number }
  partial:    { amount: number; count: number }
  paid:       { amount: number; count: number }
  disputed:   { amount: number; count: number }
  writtenOff: { amount: number; count: number }
}

type MonthData = { invoiced: number; collected: number; count: number }
type IncomeData = { monthly: Record<number, MonthData>; yearTotal: MonthData; year: number }

type ClaimPeriodData = { medicaid: number; commercial: number; count: number }
type IncomeExtraData = {
  claimIncome: { monthly: Record<number, ClaimPeriodData>; quarterly: Record<number, ClaimPeriodData>; total: ClaimPeriodData }
  invoiceIncome: { quarterly: Record<number, MonthData> }
  receivables: { outstanding: number; count: number; asOf: string }
  discountExpense: { total: number; count: number }
  reports: { id: string; periodLabel: string; fileName: string; createdAt: string }[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const METHODS = ['Venmo','Zelle','CashApp','ApplePay','Cash','Check','ACH','Account Balance','Other']

const STATUS_STYLE: Record<string, string> = {
  Sent:       'bg-blue-100 text-blue-700',
  Partial:    'bg-amber-100 text-amber-700',
  Paid:       'bg-green-100 text-green-700',
  Disputed:   'bg-red-100 text-red-700',
  WrittenOff: 'bg-gray-100 text-gray-500',
  Overdue:    'bg-orange-100 text-orange-700',
  Pending:    'bg-blue-100 text-blue-700',
}

function fmt(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function currency(n: number) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, amount, count, color }: { label: string; amount: number; count: number; color: string }) {
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border-t-4 ${color}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">{label}</p>
      <p className="text-2xl font-black text-[#2F3E4E] mt-0.5">{currency(amount)}</p>
      <p className="text-xs text-[#7A8F79] mt-0.5">{count} invoice{count !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ── Generate Invoices ────────────────────────────────────────────────────────
// The cross-nurse "what's outstanding" batch screen — replaces having to open
// each nurse's profile individually to see and check off which dates of
// service still need to be invoiced. One row per nurse (count outstanding,
// oldest unbilled date, running total); expand a nurse to see the actual
// entries and pick a month to auto-check everything billed that month — the
// normal case is then just "expand → pick month → Generate." Unchecking down
// to a subset still works for an off-cycle/partial invoice.

type OutstandingEntry = {
  id: string
  workDate: string
  hours: number
  billed: boolean
  readyToInvoice: boolean
  invoiceFeePlan: string | null
  invoiceFeeAmt: number | null
  nurse: { id: string; firstName: string | null; lastName: string | null; displayName: string; accountNumber: string | null }
  patient: { firstName: string; lastName: string; accountNumber: string | null } | null
}

// Display-only estimate before generation — the authoritative amount is
// always computed server-side in POST /api/admin/time-entry/[id] at flag
// time. Keep these two in sync if the fee schedule ever changes.
const FEE_PLAN_OPTIONS = [
  { value: 'ST-MED',  label: 'Short-Term Medicaid',  amount: 3.00 },
  { value: 'ST-COM',  label: 'Short-Term Commercial', amount: 4.00 },
  { value: 'ST-DUAL', label: 'Short-Term Dual',        amount: 5.00 },
  { value: 'LT-MED',  label: 'Long-Term Medicaid',    amount: 2.00 },
  { value: 'LT-COM',  label: 'Long-Term Commercial',   amount: 3.00 },
  { value: 'LT-DUAL', label: 'Long-Term Dual',          amount: 4.00 },
]
const FEE_AMOUNT: Record<string, number> = Object.fromEntries(FEE_PLAN_OPTIONS.map(p => [p.value, p.amount]))

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7) // YYYY-MM
}
function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function NurseOutstandingRow({ nurseEntries, onGenerated }: {
  nurseEntries: OutstandingEntry[]
  onGenerated: () => void
}) {
  const nurse = nurseEntries[0].nurse
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [plans, setPlans] = useState<Record<string, string>>({})
  const [monthPick, setMonthPick] = useState('')
  const [dueTerm, setDueTerm] = useState('30')
  const [notes, setNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')

  const sorted = [...nurseEntries].sort((a, b) => a.workDate.localeCompare(b.workDate))
  const billedEntries = sorted.filter(e => e.billed)
  const unbilledCount = sorted.length - billedEntries.length
  const oldest = sorted[0]
  const knownTotal = sorted.reduce((s, e) => s + (e.invoiceFeeAmt ?? 0), 0)

  const monthOptions = useMemo(() => {
    const keys = Array.from(new Set(billedEntries.map(e => monthKey(e.workDate)))).sort()
    return keys.map(k => ({ value: k, label: monthLabel(k) }))
  }, [billedEntries])

  function planFor(entry: OutstandingEntry) {
    return plans[entry.id] ?? entry.invoiceFeePlan ?? 'LT-MED'
  }

  function pickMonth(key: string) {
    setMonthPick(key)
    setMessage('')
    if (!key) { setSelected(new Set()); return }
    setSelected(new Set(billedEntries.filter(e => monthKey(e.workDate) === key).map(e => e.id)))
  }

  function toggleEntry(entry: OutstandingEntry) {
    if (!entry.billed) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(entry.id)) next.delete(entry.id); else next.add(entry.id)
      return next
    })
  }

  const selectedTotal = sorted
    .filter(e => selected.has(e.id))
    .reduce((s, e) => s + (FEE_AMOUNT[planFor(e)] ?? 0), 0)

  async function handleGenerate() {
    if (selected.size === 0) return
    setGenerating(true)
    setMessage('')
    try {
      // POST /api/admin/invoices sweeps up every readyToInvoice:true entry
      // for this nurse, not just what we flag below — so any stale flag left
      // over from an earlier interrupted session (or the old per-nurse
      // screen) needs to be explicitly cleared here too, or it would ride
      // along on this invoice invisibly to what's actually checked above.
      for (const entry of sorted) {
        const shouldFlag = selected.has(entry.id)
        if (!shouldFlag && !entry.readyToInvoice) continue
        const res = await fetch(`/api/admin/time-entry/${entry.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(shouldFlag
            ? { readyToInvoice: true, invoiceFeePlan: planFor(entry) }
            : { readyToInvoice: false }),
        })
        if (!res.ok) throw new Error('Failed to flag one or more entries.')
      }
      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nurseId: nurse.id, dueTerm, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create invoice.')
      setMessage(`✓ Invoice ${data.invoiceNumber || ''} created.`)
      setSelected(new Set())
      setMonthPick('')
      onGenerated()
    } catch (err: any) {
      setMessage(err.message || 'Something went wrong.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-[#F4F6F5] transition"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-[#2F3E4E]">{formalName(nurse) || nurse.displayName}</span>
          {nurse.accountNumber && <span className="text-[10px] font-mono text-[#7A8F79] bg-[#F4F6F5] px-2 py-0.5 rounded-full">{nurse.accountNumber}</span>}
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-[#7A8F79]">{billedEntries.length} billed, uninvoiced{unbilledCount > 0 ? ` · ${unbilledCount} not billed yet` : ''}</span>
          <span className="text-[#7A8F79]">Oldest: {fmt(oldest.workDate)}</span>
          {knownTotal > 0 && <span className="font-bold text-[#2F3E4E]">{currency(knownTotal)} flagged so far</span>}
          <span className="text-[#7A8F79]">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#D9E1E8] px-5 py-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-64">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] mb-1">Pick a month to auto-check</label>
              <select
                value={monthPick}
                onChange={e => pickMonth(e.target.value)}
                className="w-full h-[34px] border border-[#D9E1E8] rounded-lg px-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              >
                <option value="">— Custom selection —</option>
                {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] mb-1">Due Term</label>
              <select
                value={dueTerm}
                onChange={e => setDueTerm(e.target.value)}
                className="w-full h-[34px] border border-[#D9E1E8] rounded-lg px-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              >
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="ASAP">ASAP</option>
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] mb-1">Notes <span className="normal-case font-normal text-[#aab]">(optional)</span></label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full h-[34px] border border-[#D9E1E8] rounded-lg px-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D9E1E8] text-left text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">
                  <th className="px-2 py-2 w-8"></th>
                  <th className="px-2 py-2">DOS</th>
                  <th className="px-2 py-2">Patient</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Fee Plan</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(entry => (
                  <tr key={entry.id} className={`border-b border-[#D9E1E8] last:border-0 ${!entry.billed ? 'opacity-40' : ''}`}>
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        disabled={!entry.billed}
                        checked={selected.has(entry.id)}
                        onChange={() => toggleEntry(entry)}
                        className="accent-[#7A8F79] w-4 h-4"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-[#2F3E4E]">{fmt(entry.workDate)}</td>
                    <td className="px-2 py-1.5 text-[#2F3E4E]">
                      {entry.patient ? `${entry.patient.firstName} ${entry.patient.lastName}` : '—'}
                    </td>
                    <td className="px-2 py-1.5">
                      {entry.billed ? (
                        <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Billed</span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#7A8F79] bg-[#F4F6F5] px-2 py-0.5 rounded-full" title="No claim submitted yet — can't be invoiced">Not billed</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {selected.has(entry.id) ? (
                        <select
                          value={planFor(entry)}
                          onChange={e => setPlans(p => ({ ...p, [entry.id]: e.target.value }))}
                          className="h-[30px] border border-[#D9E1E8] rounded-lg px-2 text-xs text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                        >
                          {FEE_PLAN_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      ) : entry.invoiceFeePlan ? (
                        <span className="text-xs text-[#7A8F79]">{entry.invoiceFeePlan}</span>
                      ) : (
                        <span className="text-xs text-[#aab]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-[#2F3E4E]">
                      {selected.has(entry.id) ? currency(FEE_AMOUNT[planFor(entry)] ?? 0) : entry.invoiceFeeAmt != null ? currency(entry.invoiceFeeAmt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="text-sm">
              <span className="text-[#7A8F79]">{selected.size} selected · </span>
              <span className="font-bold text-[#2F3E4E]">{currency(selectedTotal)}</span>
              {message && <span className="ml-3 text-xs font-semibold text-[#2F3E4E]">{message}</span>}
            </div>
            <button
              onClick={handleGenerate}
              disabled={selected.size === 0 || generating}
              className="bg-[#2F3E4E] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
            >
              {generating ? 'Generating…' : `Generate Invoice (${selected.size})`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function GenerateInvoicesTab({ onCreated }: { onCreated: () => void }) {
  const [entries, setEntries] = useState<OutstandingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [nurseSearch, setNurseSearch] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/invoices/outstanding', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEntries(data) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const byNurse = useMemo(() => {
    const map = new Map<string, OutstandingEntry[]>()
    for (const e of entries) {
      if (!map.has(e.nurse.id)) map.set(e.nurse.id, [])
      map.get(e.nurse.id)!.push(e)
    }
    return Array.from(map.values())
      .filter(group => !nurseSearch || (formalName(group[0].nurse) || group[0].nurse.displayName).toLowerCase().includes(nurseSearch.toLowerCase()))
      .sort((a, b) => (formalName(a[0].nurse) || a[0].nurse.displayName).localeCompare(formalName(b[0].nurse) || b[0].nurse.displayName))
  }, [entries, nurseSearch])

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-4">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] mb-1">Nurse</label>
        <input
          value={nurseSearch}
          onChange={e => setNurseSearch(e.target.value)}
          placeholder="Search by nurse name…"
          className="w-64 h-[34px] border border-[#D9E1E8] rounded-lg px-2 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
        />
      </div>

      {loading ? (
        <p className="text-sm text-[#7A8F79] py-4">Loading…</p>
      ) : byNurse.length === 0 ? (
        <p className="text-sm text-[#7A8F79] py-4">Nothing outstanding — every entry has been invoiced.</p>
      ) : (
        <div className="space-y-2">
          {byNurse.map(group => (
            <NurseOutstandingRow key={group[0].nurse.id} nurseEntries={group} onGenerated={() => { load(); onCreated() }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AdminInvoicingPage() {
  const [tab, setTab] = useState<'overview' | 'generate' | 'invoices' | 'payments' | 'income'>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [incomeData, setIncomeData] = useState<IncomeData | null>(null)
  const [incomeYear, setIncomeYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)

  // Income tab — claim income / receivables / discount-expense / report export
  const [incomeExtra, setIncomeExtra] = useState<IncomeExtraData | null>(null)
  const [reportQuarter, setReportQuarter] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')

  // Invoices tab state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusSaving, setStatusSaving] = useState<string | null>(null)
  const [s3Saving, setS3Saving] = useState<string | null>(null)

  // Payment tab state
  const [payNurseFilter, setPayNurseFilter] = useState('')
  const [payInvoiceId, setPayInvoiceId] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('Venmo')
  const [payNote, setPayNote] = useState('')
  const [payPaidDate, setPayPaidDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [payMsg, setPayMsg] = useState('')
  const [paySubmitting, setPaySubmitting] = useState(false)
  const [payNurseBalance, setPayNurseBalance] = useState<number | null>(null)

  // Statement state
  const [stmtNurseId, setStmtNurseId] = useState('')
  const [stmtFilter, setStmtFilter] = useState<'all' | 'outstanding'>('outstanding')
  const [stmtSending, setStmtSending] = useState(false)
  const [stmtMsg, setStmtMsg] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [statsRes, allRes] = await Promise.all([
      fetch('/api/admin/invoicing', { credentials: 'include' }),
      fetch('/api/admin/invoicing?view=all', { credentials: 'include' }),
    ])
    const [statsData, allData] = await Promise.all([statsRes.json(), allRes.json()])
    if (statsRes.ok) setStats(statsData)
    if (allRes.ok && Array.isArray(allData)) setInvoices(allData)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    const inv = invoices.find(i => i.id === payInvoiceId)
    if (!inv) { setPayNurseBalance(null); return }
    fetch(`/api/admin/nurses/${inv.nurseId}/account-balance`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { balance: 0 })
      .then(d => setPayNurseBalance(d.balance || 0))
  }, [payInvoiceId, invoices])

  useEffect(() => {
    if (tab !== 'income') return
    fetch(`/api/admin/invoicing?view=income&year=${incomeYear}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.monthly) setIncomeData(d) })
    fetch(`/api/admin/reports/income?year=${incomeYear}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.claimIncome) setIncomeExtra(d) })
  }, [tab, incomeYear])

  async function exportIncomeReport() {
    setExporting(true)
    setExportMsg('')
    const res = await fetch('/api/admin/reports/income/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ year: incomeYear, quarter: reportQuarter }),
    })
    const data = await res.json()
    setExporting(false)
    if (res.ok && data.url) {
      window.open(data.url, '_blank')
      fetch(`/api/admin/reports/income?year=${incomeYear}`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => { if (d.claimIncome) setIncomeExtra(d) })
    } else {
      setExportMsg(data.error || 'Export failed')
    }
  }

  async function redownloadReport(id: string) {
    const res = await fetch(`/api/admin/reports/income/${id}`, { credentials: 'include' })
    const data = await res.json()
    if (res.ok && data.url) window.open(data.url, '_blank')
  }

  async function changeStatus(invoiceId: string, status: string) {
    setStatusSaving(invoiceId)
    await fetch(`/api/admin/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    })
    setStatusSaving(null)
    await loadAll()
  }

  async function saveToS3(invoiceId: string) {
    setS3Saving(invoiceId)
    const res = await fetch(`/api/admin/invoices/${invoiceId}/s3`, {
      method: 'POST',
      credentials: 'include',
    })
    const data = await res.json()
    setS3Saving(null)
    if (res.ok && data.url) {
      window.open(data.url, '_blank')
      await loadAll()
    } else {
      alert(data.error || 'S3 save failed')
    }
  }

  async function applyPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payInvoiceId) { setPayMsg('Select an invoice first.'); return }
    setPaySubmitting(true)
    setPayMsg('')
    const res = await fetch(`/api/admin/invoices/${payInvoiceId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ amount: parseFloat(payAmount), method: payMethod, note: payNote, paidDate: payPaidDate }),
    })
    const data = await res.json()
    setPaySubmitting(false)
    if (res.ok) {
      const inv = invoices.find(i => i.id === payInvoiceId)
      const s3Note = data.s3Key ? ' Receipt saved to S3.' : ''
      const creditNote = data.promptPayCreditApplied
        ? ` ✓ Prompt-pay credit of ${currency(data.promptPayCreditApplied)} queued for next invoice.`
        : ''
      const lateFeeNote = data.lateFeeApplied
        ? ` Late fee of ${currency(data.lateFeeApplied)} recorded.`
        : ''
      const overageNote = data.overageAmount
        ? ` ✓ Overpayment of ${currency(data.overageAmount)} added to account balance (new balance: ${currency(data.accountBalance)}).`
        : ''
      const balanceSpendNote = data.appliedFromBalance
        ? ` ${currency(data.appliedFromBalance)} applied from account balance (remaining: ${currency(data.accountBalance)}).`
        : ''
      setPayMsg(`Payment applied — Receipt ${data.receiptNumber} · ${inv ? shortInvoiceNumber(inv.invoiceNumber) : ''} · Status: ${data.newStatus}.${s3Note}${creditNote}${lateFeeNote}${overageNote}${balanceSpendNote}`)
      setPayAmount('')
      setPayNote('')
      setPayPaidDate(new Date().toISOString().slice(0, 10))
      setPayNurseBalance(data.accountBalance)
      await loadAll()
    } else {
      setPayMsg(data.error || 'Payment failed.')
    }
  }

  async function deletePayment(invoiceId: string, paymentId: string) {
    if (!confirm('Remove this payment? The invoice balance will be adjusted.')) return
    await fetch(`/api/admin/invoices/${invoiceId}/payment`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ paymentId }),
    })
    await loadAll()
  }

  async function sendStatement(e: React.FormEvent) {
    e.preventDefault()
    if (!stmtNurseId) { setStmtMsg('Select a provider.'); return }
    setStmtSending(true)
    setStmtMsg('')
    const res = await fetch(`/api/admin/invoices/${stmtNurseId}/statement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ filter: stmtFilter }),
    })
    const data = await res.json()
    setStmtSending(false)
    setStmtMsg(res.ok ? 'Statement emailed successfully.' : (data.error || 'Failed to send.'))
  }

  function downloadStatement() {
    if (!stmtNurseId) { setStmtMsg('Select a provider first.'); return }
    window.open(`/api/admin/invoices/${stmtNurseId}/statement?filter=${stmtFilter}`, '_blank')
  }

  function printInvoice(invoiceId: string) {
    window.open(`/admin/invoicing/${invoiceId}/print`, '_blank')
  }

  // Filtered invoices list
  const filteredInvoices = invoices.filter(inv => {
    const matchSearch = search === '' ||
      inv.nurseName?.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      (inv.nurse?.accountNumber ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter ||
      (statusFilter === 'Sent' && inv.status === 'Pending')
    return matchSearch && matchStatus
  })

  // Unique nurses for statement/payment selects
  const uniqueNurses = Array.from(
    new Map(invoices.map(i => [i.nurseId, { id: i.nurseId, name: i.nurseName }])).values()
  )

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">

      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#2F3E4E]">
          <span className="italic text-[#7A8F79]">ad</span>Invoicing
        </h1>
        <p className="text-xs text-[#7A8F79] mt-0.5">Payments, statements, receipts &amp; income tracking</p>
      </div>

      {/* ── Stats Strip ── */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
          <StatCard label="Pending"    amount={stats.pending.amount}    count={stats.pending.count}    color="border-slate-400" />
          <StatCard label="Invoiced"   amount={stats.sent.amount}       count={stats.sent.count}       color="border-blue-400" />
          <StatCard label="Partial"    amount={stats.partial.amount}    count={stats.partial.count}    color="border-amber-400" />
          <StatCard label="Paid"       amount={stats.paid.amount}       count={stats.paid.count}       color="border-green-500" />
          <StatCard label="Disputed"   amount={stats.disputed.amount}   count={stats.disputed.count}   color="border-red-400" />
          <StatCard label="Written Off" amount={stats.writtenOff.amount} count={stats.writtenOff.count} color="border-gray-300" />
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {([
          ['overview', 'Overview'],
          ['generate', 'Generate Invoices'],
          ['invoices', 'Invoices'],
          ['payments', 'Payments'],
          ['income', 'Income'],
        ] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
              tab === t ? 'bg-[#2F3E4E] text-white' : 'bg-white text-[#2F3E4E] border border-[#D9E1E8] hover:border-[#7A8F79]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && tab !== 'generate' && <p className="text-sm text-[#7A8F79] py-4">Loading…</p>}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB: GENERATE INVOICES
      ═══════════════════════════════════════════════════════════════════ */}
      {tab === 'generate' && <GenerateInvoicesTab onCreated={loadAll} />}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB: OVERVIEW
      ═══════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'overview' && (
        <div className="space-y-4">
          {/* Recent invoices quick-view */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-[#2F3E4E] uppercase tracking-widest mb-3 pb-2 border-b border-[#D9E1E8]">
              Recent Invoices
            </h2>
            <div className="space-y-1.5">
              {invoices.slice(0, 8).map(inv => {
                const balance = inv.totalAmount - (inv.paidAmount || 0)
                const status = inv.status === 'Pending' ? 'Sent' : inv.status
                return (
                  <div key={inv.id} className="flex items-center gap-3 py-1.5 border-b border-[#D9E1E8] last:border-0 text-sm">
                    <span className="font-mono font-semibold text-[#2F3E4E] text-xs w-36 shrink-0">{shortInvoiceNumber(inv.invoiceNumber)}</span>
                    <span className="flex-1 text-xs text-[#7A8F79] truncate">{inv.nurse?.displayName || inv.nurseName}</span>
                    <span className="text-xs text-[#2F3E4E]">{fmt(inv.sentAt)}</span>
                    <span className="text-xs font-semibold text-[#2F3E4E]">{currency(inv.totalAmount)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[status] || 'bg-gray-100 text-gray-500'}`}>
                      {status}
                    </span>
                    {balance > 0 && balance < inv.totalAmount && (
                      <span className="text-[10px] text-amber-600 font-semibold">{currency(balance)} due</span>
                    )}
                    <button
                      onClick={() => printInvoice(inv.id)}
                      title="Print / Download"
                      className="text-[#7A8F79] hover:text-[#2F3E4E] text-xs transition"
                    >🖨</button>
                  </div>
                )
              })}
              {invoices.length > 8 && (
                <button
                  onClick={() => setTab('invoices')}
                  className="text-xs text-[#7A8F79] underline pt-1"
                >
                  View all {invoices.length} invoices →
                </button>
              )}
            </div>
          </div>

          {/* Statement generator */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-[#2F3E4E] uppercase tracking-widest mb-3 pb-2 border-b border-[#D9E1E8]">
              Generate Account Statement
            </h2>
            <form onSubmit={sendStatement} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] mb-1">Provider</label>
                  <select
                    value={stmtNurseId}
                    onChange={e => setStmtNurseId(e.target.value)}
                    className="w-full border border-[#D9E1E8] rounded-lg px-2 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  >
                    <option value="">— Select provider —</option>
                    {uniqueNurses.map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] mb-1">Include</label>
                  <select
                    value={stmtFilter}
                    onChange={e => setStmtFilter(e.target.value as 'all' | 'outstanding')}
                    className="w-full border border-[#D9E1E8] rounded-lg px-2 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  >
                    <option value="outstanding">Outstanding only</option>
                    <option value="all">All invoices</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={downloadStatement}
                  className="flex-1 border border-[#D9E1E8] text-[#2F3E4E] py-1.5 rounded-lg text-sm font-semibold hover:bg-[#f4f6f8] transition"
                >
                  📄 Download / Print
                </button>
                <button
                  type="submit"
                  disabled={stmtSending || !stmtNurseId}
                  className="flex-1 bg-[#2F3E4E] text-white py-1.5 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
                >
                  {stmtSending ? 'Sending…' : '✉️ Email Statement'}
                </button>
              </div>
              {stmtMsg && (
                <p className={`text-xs font-medium ${stmtMsg.includes('success') || stmtMsg.includes('emailed') ? 'text-[#7A8F79]' : 'text-red-500'}`}>
                  {stmtMsg}
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB: INVOICES
      ═══════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'invoices' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="text"
              placeholder="Search name, invoice #, account…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-[#D9E1E8] rounded-lg px-3 py-1.5 text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] w-64"
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-[#D9E1E8] rounded-lg px-3 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
            >
              <option value="all">All statuses</option>
              <option value="Sent">Sent (Invoiced)</option>
              <option value="Partial">Partial</option>
              <option value="Paid">Paid</option>
              <option value="Disputed">Disputed</option>
              <option value="WrittenOff">Written Off</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                  <th className="text-left py-2 pr-3">Invoice #</th>
                  <th className="text-left py-2 pr-3">Provider</th>
                  <th className="text-left py-2 pr-3">Sent</th>
                  <th className="text-left py-2 pr-3">Due</th>
                  <th className="text-right py-2 pr-3">Billed</th>
                  <th className="text-right py-2 pr-3">Paid</th>
                  <th className="text-right py-2 pr-3">Balance</th>
                  <th className="text-left py-2 pr-3">Status</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv, i) => {
                  const status = inv.status === 'Pending' ? 'Sent' : inv.status
                  const balance = inv.totalAmount - (inv.paidAmount || 0)
                  const isExpanded = expandedId === inv.id
                  const isOverdue = !['Paid','WrittenOff','Disputed'].includes(status) && new Date(inv.dueDate) < new Date()

                  return (
                    <>
                      <tr
                        key={inv.id}
                        className={`border-b border-[#D9E1E8] last:border-0 cursor-pointer hover:bg-[#f8fafb] transition ${
                          i % 2 === 0 ? 'bg-white' : 'bg-[#F4F6F5]'
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                      >
                        <td className="py-2 pr-3 font-mono text-xs font-semibold text-[#2F3E4E]">{shortInvoiceNumber(inv.invoiceNumber)}</td>
                        <td className="py-2 pr-3 text-xs text-[#2F3E4E]">
                          {inv.nurse?.displayName || inv.nurseName}
                          {inv.nurse?.accountNumber && (
                            <span className="ml-1 text-[#7A8F79] font-mono">·{inv.nurse.accountNumber}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs text-[#7A8F79] whitespace-nowrap">{fmt(inv.sentAt)}</td>
                        <td className={`py-2 pr-3 text-xs whitespace-nowrap ${isOverdue ? 'text-orange-600 font-semibold' : 'text-[#7A8F79]'}`}>
                          {fmt(inv.dueDate)}{isOverdue ? ' ⚠' : ''}
                        </td>
                        <td className="py-2 pr-3 text-xs text-right font-semibold text-[#2F3E4E]">{currency(inv.totalAmount)}</td>
                        <td className="py-2 pr-3 text-xs text-right text-green-600 font-semibold">{currency(inv.paidAmount || 0)}</td>
                        <td className={`py-2 pr-3 text-xs text-right font-bold ${balance > 0 ? 'text-red-500' : 'text-[#7A8F79]'}`}>
                          {currency(balance)}
                        </td>
                        <td className="py-2 pr-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[status] || 'bg-gray-100 text-gray-500'}`}>
                            {status}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => printInvoice(inv.id)}
                              title="Print / Download receipt"
                              className="text-[#7A8F79] hover:text-[#2F3E4E] text-sm transition"
                            >🖨</button>
                            <button
                              onClick={() => saveToS3(inv.id)}
                              disabled={s3Saving === inv.id}
                              title={inv.s3Key ? 'Stored in S3 — click to re-save & download' : 'Save to S3'}
                              className={`text-sm transition ${inv.s3Key ? 'text-green-500 hover:text-green-700' : 'text-[#7A8F79] hover:text-[#2F3E4E]'} disabled:opacity-40`}
                            >
                              {s3Saving === inv.id ? '⏳' : '☁️'}
                            </button>
                            <select
                              value={status}
                              onChange={async e => {
                                await changeStatus(inv.id, e.target.value)
                              }}
                              disabled={statusSaving === inv.id}
                              onClick={e => e.stopPropagation()}
                              className="border border-[#D9E1E8] rounded px-1 py-0.5 text-[10px] text-[#2F3E4E] focus:outline-none disabled:opacity-50"
                            >
                              {['Sent','Partial','Paid','Disputed','WrittenOff','Overdue'].map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded payment detail */}
                      {isExpanded && (
                        <tr key={`${inv.id}-detail`} className="bg-blue-50">
                          <td colSpan={9} className="px-4 py-3">
                            <div className="flex flex-wrap gap-6">
                              {/* Payment history */}
                              <div className="flex-1 min-w-[260px]">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] mb-1.5">Payment History</p>
                                {(!inv.payments || inv.payments.length === 0) ? (
                                  <p className="text-xs text-[#7A8F79] italic">No payments applied yet.</p>
                                ) : (
                                  <table className="w-full text-xs">
                                    <tbody>
                                      {inv.payments.map(p => (
                                        <tr key={p.id} className="border-b border-blue-100 last:border-0">
                                          <td className="py-1 pr-2 font-mono text-[#7A8F79] text-[10px]">{p.receiptNumber}</td>
                                          <td className="py-1 pr-2 text-green-700 font-semibold">{currency(p.amount)}</td>
                                          <td className="py-1 pr-2 text-[#7A8F79]">{p.method || '—'}</td>
                                          <td className="py-1 pr-2 text-[#7A8F79]">{p.note || ''}</td>
                                          <td className="py-1 pr-2 text-[#7A8F79] whitespace-nowrap">{fmt(p.appliedAt)}</td>
                                          <td className="py-1 pr-2">
                                            {p.s3Key
                                              ? <span title={`S3: ${p.s3Key}`} className="text-green-500 text-[11px]">☁️</span>
                                              : <span className="text-[#D9E1E8] text-[11px]" title="Not in S3">☁️</span>
                                            }
                                          </td>
                                          <td className="py-1 pr-1">
                                            <button
                                              onClick={() => window.open(`/admin/invoicing/${inv.id}/receipt?paymentId=${p.id}`, '_blank')}
                                              className="text-[#7A8F79] hover:text-[#2F3E4E] transition text-[11px]"
                                              title="Print receipt"
                                            >🖨</button>
                                          </td>
                                          <td className="py-1">
                                            <button
                                              onClick={() => deletePayment(inv.id, p.id)}
                                              className="text-red-400 hover:text-red-600 transition text-xs"
                                              title="Remove payment"
                                            >✕</button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                              {/* Quick apply payment */}
                              <div className="min-w-[220px]">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] mb-1.5">Apply Payment</p>
                                <div className="flex gap-1.5">
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    placeholder={`Max ${currency(balance)}`}
                                    className="border border-[#D9E1E8] rounded px-2 py-1 text-xs text-[#2F3E4E] w-24 focus:outline-none focus:ring-1 focus:ring-[#7A8F79]"
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        const input = e.currentTarget
                                        if (!input.value) return
                                        setPayInvoiceId(inv.id)
                                        setPayAmount(input.value)
                                        setTab('payments')
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => { setPayInvoiceId(inv.id); setTab('payments') }}
                                    className="bg-[#7A8F79] text-white px-2 py-1 rounded text-xs font-semibold hover:bg-[#2F3E4E] transition"
                                  >
                                    Apply →
                                  </button>
                                </div>
                                <p className="text-[10px] text-[#7A8F79] mt-1">
                                  Or go to the Payments tab for full details.
                                </p>
                              </div>
                              {/* Notes */}
                              {inv.notes && (
                                <div className="min-w-[160px]">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] mb-1">Notes</p>
                                  <p className="text-xs text-[#2F3E4E] italic">{inv.notes}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
            {filteredInvoices.length === 0 && (
              <p className="text-sm text-[#7A8F79] italic text-center py-6">No invoices match.</p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB: PAYMENTS
      ═══════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'payments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Apply payment form */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-[#2F3E4E] uppercase tracking-widest mb-3 pb-2 border-b border-[#D9E1E8]">
              Apply Payment to Invoice
            </h2>
            <form onSubmit={applyPayment} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] mb-1">Provider</label>
                <select
                  value={payNurseFilter}
                  onChange={e => { setPayNurseFilter(e.target.value); setPayInvoiceId('') }}
                  className="w-full border border-[#D9E1E8] rounded-lg px-2 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                >
                  <option value="">— All providers —</option>
                  {uniqueNurses.map(n => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] mb-1">Invoice</label>
                <select
                  value={payInvoiceId}
                  onChange={e => setPayInvoiceId(e.target.value)}
                  className="w-full border border-[#D9E1E8] rounded-lg px-2 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                >
                  <option value="">— Select invoice —</option>
                  {invoices
                    .filter(i => !['Paid','WrittenOff'].includes(i.status) && (!payNurseFilter || i.nurseId === payNurseFilter))
                    .map(inv => {
                      const balance = inv.totalAmount - (inv.paidAmount || 0)
                      return (
                        <option key={inv.id} value={inv.id}>
                          {shortInvoiceNumber(inv.invoiceNumber)} · {inv.nurse?.displayName || inv.nurseName} · {currency(balance)} due
                        </option>
                      )
                    })}
                </select>
                {payInvoiceId && (() => {
                  const inv = invoices.find(i => i.id === payInvoiceId)
                  if (!inv) return null
                  const balance = inv.totalAmount - (inv.paidAmount || 0)
                  return (
                    <p className="text-[10px] text-[#7A8F79] mt-1">
                      {shortInvoiceNumber(inv.invoiceNumber)} — Billed: {currency(inv.totalAmount)} · Paid: {currency(inv.paidAmount || 0)} · Balance: <strong className="text-red-500">{currency(balance)}</strong>
                    </p>
                  )
                })()}
              </div>

              {/* Date Paid */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] mb-1">
                  Date Paid <span className="normal-case font-normal text-[#7A8F79]">(used for late fee &amp; prompt-pay calculations)</span>
                </label>
                <DateInput
                  required
                  value={payPaidDate}
                  onChange={e => setPayPaidDate(e.target.value)}
                  className="w-full border border-[#D9E1E8] rounded-lg px-2 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
              </div>

              {/* Live fee / discount preview */}
              {payInvoiceId && payPaidDate && (() => {
                const inv = invoices.find(i => i.id === payInvoiceId)
                if (!inv) return null
                const paidMs   = new Date(payPaidDate + 'T12:00:00Z').getTime()
                const sentMs   = new Date(inv.sentAt).getTime()
                const dueMs    = new Date(inv.dueDate).getTime()
                const daysSinceSent = Math.floor((paidMs - sentMs) / 86_400_000)
                const daysOverdue   = Math.floor((paidMs - dueMs)  / 86_400_000)
                const monthsOverdue = daysOverdue > 0 ? Math.floor(daysOverdue / 30) : 0

                const lateFeeOwed =
                  inv.lateFeePlan === 'flat' && inv.lateFeeAmt && monthsOverdue > 0
                    ? monthsOverdue * inv.lateFeeAmt
                  : inv.lateFeePlan === 'percent' && inv.lateFeePercent && monthsOverdue > 0
                    ? monthsOverdue * (inv.lateFeePercent / 100) * inv.totalAmount
                  : 0

                const promptPayQualifies =
                  inv.promptPayDays != null && inv.promptPayCredit != null &&
                  daysSinceSent <= inv.promptPayDays

                if (!inv.lateFeePlan && !inv.promptPayDays) return null

                return (
                  <div className="rounded-lg border border-[#D9E1E8] bg-[#F4F6F5] px-3 py-2.5 space-y-1.5 text-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#7A8F79]">Payment Date Analysis</p>
                    <p className="text-[#2F3E4E]">
                      <span className="text-[#7A8F79]">Days since invoice sent:</span>{' '}
                      <strong>{daysSinceSent}</strong>
                      {daysOverdue > 0 && (
                        <span className="ml-2 text-orange-600 font-semibold">
                          ({daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue · {monthsOverdue} month{monthsOverdue !== 1 ? 's' : ''})
                        </span>
                      )}
                    </p>
                    {inv.lateFeePlan && inv.lateFeePlan !== 'none' && (
                      lateFeeOwed > 0 ? (
                        <p className="text-orange-700 font-semibold">
                          Late fee: {currency(lateFeeOwed)}{' '}
                          <span className="font-normal text-[#7A8F79]">
                            ({inv.lateFeePlan === 'flat'
                              ? `${currency(inv.lateFeeAmt!)} × ${monthsOverdue} month${monthsOverdue !== 1 ? 's' : ''}`
                              : `${inv.lateFeePercent}% × ${monthsOverdue} month${monthsOverdue !== 1 ? 's' : ''} on ${currency(inv.totalAmount)}`})
                            — will be recorded automatically on full payment
                          </span>
                        </p>
                      ) : (
                        <p className="text-[#7A8F79]">No late fee — payment is on time.</p>
                      )
                    )}
                    {inv.promptPayDays != null && inv.promptPayCredit != null && (
                      promptPayQualifies ? (
                        <p className="text-green-700 font-semibold">
                          Prompt-pay credit: {currency(inv.promptPayCredit)}{' '}
                          <span className="font-normal text-[#7A8F79]">
                            (paid within {inv.promptPayDays}-day window — credit queued for next invoice on full payment)
                          </span>
                        </p>
                      ) : (
                        <p className="text-[#7A8F79]">
                          No prompt-pay credit — {daysSinceSent} days since sent, window was {inv.promptPayDays} days.
                        </p>
                      )
                    )}
                  </div>
                )
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] mb-1">Amount</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-[#D9E1E8] rounded-lg px-2 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] mb-1">Method</label>
                  <select
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value)}
                    className="w-full border border-[#D9E1E8] rounded-lg px-2 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                  >
                    {METHODS.map(m => (
                      <option key={m} value={m} disabled={m === 'Account Balance' && !payNurseBalance}>
                        {m}{m === 'Account Balance' && payNurseBalance ? ` (${currency(payNurseBalance)} available)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {payMethod === 'Account Balance' && payInvoiceId && (
                <p className={`text-[10px] font-medium ${payNurseBalance ? 'text-[#7A8F79]' : 'text-red-500'}`}>
                  {payNurseBalance
                    ? `Account balance available: ${currency(payNurseBalance)}. Amount will be deducted from this balance instead of recording new money received.`
                    : 'This provider has no account balance to apply.'}
                </p>
              )}

              {payMethod !== 'Account Balance' && payInvoiceId && payAmount && (() => {
                const inv = invoices.find(i => i.id === payInvoiceId)
                if (!inv) return null
                const due = inv.totalAmount - (inv.paidAmount || 0)
                const over = parseFloat(payAmount) - due
                if (!(over > 0)) return null
                return (
                  <p className="text-[10px] font-medium text-blue-600">
                    This overpays the invoice by {currency(over)} — the excess will be credited to the provider&rsquo;s account balance for a future invoice.
                  </p>
                )
              })()}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] mb-1">Note <span className="normal-case font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  placeholder="e.g. Ref #1234"
                  className="w-full border border-[#D9E1E8] rounded-lg px-2 py-1.5 text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
                />
              </div>
              <button
                type="submit"
                disabled={
                  paySubmitting || !payInvoiceId || !payAmount || !payPaidDate ||
                  (payMethod === 'Account Balance' && parseFloat(payAmount) > (payNurseBalance || 0))
                }
                className="w-full bg-[#2F3E4E] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
              >
                {paySubmitting ? 'Applying…' : 'Apply Payment'}
              </button>
              {payMsg && (
                <p className={`text-xs font-medium ${payMsg.includes('applied') ? 'text-[#7A8F79]' : 'text-red-500'}`}>
                  {payMsg}
                </p>
              )}
            </form>
          </div>

          {/* Recent payment history */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-[#2F3E4E] uppercase tracking-widest mb-3 pb-2 border-b border-[#D9E1E8]">
              Payment History
            </h2>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {invoices
                .filter(i => i.payments && i.payments.length > 0)
                .flatMap(i => i.payments!.map(p => ({ ...p, invoiceNumber: i.invoiceNumber, nurseName: i.nurse?.displayName || i.nurseName, invoiceId: i.id })))
                .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
                .slice(0, 30)
                .map(p => (
                  <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-[#D9E1E8] last:border-0 text-xs">
                    <span className="font-mono text-[#7A8F79] text-[10px] shrink-0 w-28">{p.receiptNumber}</span>
                    <span className="text-green-600 font-bold w-14 shrink-0">{currency(p.amount)}</span>
                    <span className="text-[#7A8F79] w-14 shrink-0">{p.method || '—'}</span>
                    <span className="flex-1 text-[#2F3E4E] truncate">{(p as any).nurseName} · {(p as any).invoiceNumber}</span>
                    {p.note && <span className="text-[#7A8F79] italic truncate max-w-[80px]">{p.note}</span>}
                    <span className="text-[#7A8F79] whitespace-nowrap shrink-0">{fmt(p.appliedAt)}</span>
                    {p.s3Key && <span title={`S3: ${p.s3Key}`} className="text-green-500 shrink-0">☁️</span>}
                    <button
                      onClick={() => deletePayment((p as any).invoiceId, p.id)}
                      className="text-red-400 hover:text-red-600 transition shrink-0"
                      title="Remove"
                    >✕</button>
                  </div>
                ))}
              {invoices.every(i => !i.payments || i.payments.length === 0) && (
                <p className="text-xs text-[#7A8F79] italic">No payments on record.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB: INCOME
      ═══════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'income' && (
        <div className="space-y-4">
          {/* Year selector */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIncomeYear(y => y - 1)}
              className="bg-white border border-[#D9E1E8] px-3 py-1.5 rounded-lg text-sm font-semibold text-[#2F3E4E] hover:border-[#7A8F79] transition"
            >← {incomeYear - 1}</button>
            <span className="text-lg font-bold text-[#2F3E4E]">{incomeYear}</span>
            <button
              onClick={() => setIncomeYear(y => y + 1)}
              disabled={incomeYear >= new Date().getFullYear()}
              className="bg-white border border-[#D9E1E8] px-3 py-1.5 rounded-lg text-sm font-semibold text-[#2F3E4E] hover:border-[#7A8F79] transition disabled:opacity-40"
            >{incomeYear + 1} →</button>
          </div>

          {incomeData ? (
            <>
              {/* Year totals */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-[#7A8F79]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">YTD Invoiced</p>
                  <p className="text-2xl font-black text-[#2F3E4E] mt-1">{currency(incomeData.yearTotal.invoiced)}</p>
                  <p className="text-xs text-[#7A8F79]">{incomeData.yearTotal.count} paid/partial invoices</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-green-500">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">YTD Collected</p>
                  <p className="text-2xl font-black text-green-600 mt-1">{currency(incomeData.yearTotal.collected)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-amber-400">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">YTD Uncollected</p>
                  <p className="text-2xl font-black text-amber-600 mt-1">
                    {currency(incomeData.yearTotal.invoiced - incomeData.yearTotal.collected)}
                  </p>
                </div>
              </div>

              {/* Monthly bar chart */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-[#2F3E4E] uppercase tracking-widest mb-4 pb-2 border-b border-[#D9E1E8]">
                  Monthly Breakdown — {incomeYear}
                </h2>
                <div className="grid grid-cols-12 gap-1 items-end h-36">
                  {MONTHS.map((month, idx) => {
                    const m = incomeData.monthly[idx + 1]
                    const maxVal = Math.max(...Object.values(incomeData.monthly).map(d => d.invoiced), 1)
                    const invoicedPct = Math.round((m.invoiced / maxVal) * 100)
                    const collectedPct = Math.round((m.collected / maxVal) * 100)
                    return (
                      <div key={month} className="flex flex-col items-center gap-0.5" title={`${month}: Invoiced ${currency(m.invoiced)} · Collected ${currency(m.collected)}`}>
                        <div className="w-full relative flex gap-0.5 items-end" style={{ height: '100px' }}>
                          <div
                            className="flex-1 bg-[#D9E1E8] rounded-t transition-all"
                            style={{ height: `${invoicedPct}%`, minHeight: m.invoiced > 0 ? '4px' : '0' }}
                          />
                          <div
                            className="flex-1 bg-[#7A8F79] rounded-t transition-all"
                            style={{ height: `${collectedPct}%`, minHeight: m.collected > 0 ? '4px' : '0' }}
                          />
                        </div>
                        <p className="text-[9px] text-[#7A8F79] font-semibold">{month}</p>
                        {m.invoiced > 0 && (
                          <p className="text-[8px] text-[#2F3E4E] font-bold">{currency(m.invoiced)}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-4 mt-3 justify-center">
                  <div className="flex items-center gap-1.5 text-xs text-[#7A8F79]">
                    <div className="w-3 h-3 rounded bg-[#D9E1E8]" /> Invoiced
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#7A8F79]">
                    <div className="w-3 h-3 rounded bg-[#7A8F79]" /> Collected
                  </div>
                </div>
              </div>

              {/* Monthly table */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-[#2F3E4E] uppercase tracking-widest mb-3 pb-2 border-b border-[#D9E1E8]">
                  Monthly Detail
                </h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                      <th className="text-left py-1.5 pr-4">Month</th>
                      <th className="text-right py-1.5 pr-4">Invoiced</th>
                      <th className="text-right py-1.5 pr-4">Collected</th>
                      <th className="text-right py-1.5 pr-4">Uncollected</th>
                      <th className="text-right py-1.5">Invoices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHS.map((month, idx) => {
                      const m = incomeData.monthly[idx + 1]
                      const uncollected = m.invoiced - m.collected
                      return (
                        <tr key={month} className={`border-b border-[#D9E1E8] last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F4F6F5]'}`}>
                          <td className="py-1.5 pr-4 font-semibold text-[#2F3E4E] text-xs">{month} {incomeYear}</td>
                          <td className="py-1.5 pr-4 text-right text-xs text-[#2F3E4E]">{m.invoiced > 0 ? currency(m.invoiced) : '—'}</td>
                          <td className="py-1.5 pr-4 text-right text-xs text-green-600 font-semibold">{m.collected > 0 ? currency(m.collected) : '—'}</td>
                          <td className={`py-1.5 pr-4 text-right text-xs font-semibold ${uncollected > 0 ? 'text-amber-600' : 'text-[#7A8F79]'}`}>
                            {uncollected > 0 ? currency(uncollected) : '—'}
                          </td>
                          <td className="py-1.5 text-right text-xs text-[#7A8F79]">{m.count || '—'}</td>
                        </tr>
                      )
                    })}
                    <tr className="border-t-2 border-[#2F3E4E] bg-[#f4f6f8]">
                      <td className="py-2 pr-4 font-bold text-xs text-[#2F3E4E]">TOTAL {incomeYear}</td>
                      <td className="py-2 pr-4 text-right font-black text-xs text-[#2F3E4E]">{currency(incomeData.yearTotal.invoiced)}</td>
                      <td className="py-2 pr-4 text-right font-black text-xs text-green-600">{currency(incomeData.yearTotal.collected)}</td>
                      <td className="py-2 pr-4 text-right font-black text-xs text-amber-600">
                        {currency(incomeData.yearTotal.invoiced - incomeData.yearTotal.collected)}
                      </td>
                      <td className="py-2 text-right font-bold text-xs text-[#7A8F79]">{incomeData.yearTotal.count}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {incomeExtra && (
                <>
                  {/* Receivables + discount expense */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-red-400">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">Accounts Receivable — Outstanding</p>
                      <p className="text-2xl font-black text-red-600 mt-1">{currency(incomeExtra.receivables.outstanding)}</p>
                      <p className="text-xs text-[#7A8F79]">{incomeExtra.receivables.count} invoice(s) not yet fully paid, as of today</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-red-400">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">Marketing / Promo Discount Expense ({incomeYear})</p>
                      <p className="text-2xl font-black text-red-600 mt-1">{currency(incomeExtra.discountExpense.total)}</p>
                      <p className="text-xs text-[#7A8F79]">{incomeExtra.discountExpense.count} discounted invoice(s)</p>
                    </div>
                  </div>

                  {/* Claim income (Medicaid vs Commercial) */}
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-[#2F3E4E] uppercase tracking-widest mb-3 pb-2 border-b border-[#D9E1E8]">
                      Claim Income Billed Through Service — {incomeYear}
                    </h2>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[#7A8F79] text-xs uppercase tracking-wide border-b border-[#D9E1E8]">
                          <th className="text-left py-1.5 pr-4">Month</th>
                          <th className="text-right py-1.5 pr-4">Medicaid</th>
                          <th className="text-right py-1.5 pr-4">Commercial</th>
                          <th className="text-right py-1.5">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MONTHS.map((month, idx) => {
                          const m = incomeExtra.claimIncome.monthly[idx + 1]
                          return (
                            <tr key={month} className={`border-b border-[#D9E1E8] last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F4F6F5]'}`}>
                              <td className="py-1.5 pr-4 font-semibold text-[#2F3E4E] text-xs">{month} {incomeYear}</td>
                              <td className="py-1.5 pr-4 text-right text-xs text-[#2F3E4E]">{m.medicaid > 0 ? currency(m.medicaid) : '—'}</td>
                              <td className="py-1.5 pr-4 text-right text-xs text-[#2F3E4E]">{m.commercial > 0 ? currency(m.commercial) : '—'}</td>
                              <td className="py-1.5 text-right text-xs font-semibold text-[#2F3E4E]">{(m.medicaid + m.commercial) > 0 ? currency(m.medicaid + m.commercial) : '—'}</td>
                            </tr>
                          )
                        })}
                        <tr className="border-t-2 border-[#2F3E4E] bg-[#f4f6f8]">
                          <td className="py-2 pr-4 font-bold text-xs text-[#2F3E4E]">TOTAL {incomeYear}</td>
                          <td className="py-2 pr-4 text-right font-black text-xs text-[#2F3E4E]">{currency(incomeExtra.claimIncome.total.medicaid)}</td>
                          <td className="py-2 pr-4 text-right font-black text-xs text-[#2F3E4E]">{currency(incomeExtra.claimIncome.total.commercial)}</td>
                          <td className="py-2 text-right font-black text-xs text-[#2F3E4E]">{currency(incomeExtra.claimIncome.total.medicaid + incomeExtra.claimIncome.total.commercial)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Export */}
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-[#2F3E4E] uppercase tracking-widest mb-3 pb-2 border-b border-[#D9E1E8]">
                      Export Report
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <button
                        onClick={() => setReportQuarter(null)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${reportQuarter === null ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'}`}
                      >Full Year</button>
                      {[1, 2, 3, 4].map(q => (
                        <button
                          key={q}
                          onClick={() => setReportQuarter(q)}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${reportQuarter === q ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]' : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'}`}
                        >Q{q}</button>
                      ))}
                    </div>
                    <button
                      onClick={exportIncomeReport}
                      disabled={exporting}
                      className="bg-[#2F3E4E] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#7A8F79] transition disabled:opacity-50"
                    >
                      {exporting ? 'Generating…' : `Export ${reportQuarter ? `Q${reportQuarter}` : 'Full Year'} ${incomeYear} PDF`}
                    </button>
                    {exportMsg && <p className="text-xs text-red-500 mt-2">{exportMsg}</p>}

                    {incomeExtra.reports.length > 0 && (
                      <div className="mt-5 pt-4 border-t border-[#D9E1E8]">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] mb-2">Report History</p>
                        <div className="space-y-1.5">
                          {incomeExtra.reports.map(r => (
                            <div key={r.id} className="flex items-center justify-between text-xs">
                              <span className="text-[#2F3E4E] font-medium">{r.periodLabel} — {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              <button onClick={() => redownloadReport(r.id)} className="text-[#7A8F79] font-semibold hover:text-[#2F3E4E] transition">Download</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-[#7A8F79]">Loading income data…</p>
          )}
        </div>
      )}
    </div>
  )
}
