'use client'

import { useEffect, useState, useMemo } from 'react'
import AdminNav from '../../components/AdminNav'
import Link from 'next/link'
import { formalName } from '../../../lib/formatName'

type Nurse = {
  id: string
  displayName: string
  firstName?: string
  lastName?: string
  accountNumber?: string
  billingPlan?: string
  billingDurationType?: string
  planStartDate?: string
  agreementSignedAt?: string
  onboardingComplete: boolean
  enrolledInBilling?: boolean | null
  billingStatus?: string | null
  serviceStartDate?: string | null
  serviceEndDate?: string | null
  npiNumber?: string
  user: {
    id: string
    email: string
    role: string
    createdAt: string
    lastLoginAt?: string
  }
}

type Tab = 'Active' | 'Termed' | 'Seasonal' | 'Pending' | 'Never Enrolled' | 'All Users'

const TABS: Tab[] = ['Active', 'Termed', 'Seasonal', 'Pending', 'Never Enrolled', 'All Users']

const TAB_COLORS: Record<Tab, string> = {
  'Active':         'bg-green-100 text-green-800 border-green-300',
  'Termed':         'bg-red-100 text-red-800 border-red-300',
  'Seasonal':       'bg-blue-100 text-blue-800 border-blue-300',
  'Pending':        'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Never Enrolled': 'bg-gray-100 text-gray-600 border-gray-300',
  'All Users':      'bg-[#D9E1E8] text-[#2F3E4E] border-[#2F3E4E]',
}

const BADGE_COLORS: Record<string, string> = {
  Active:           'bg-green-100 text-green-800',
  Termed:           'bg-red-100 text-red-800',
  Seasonal:         'bg-blue-100 text-blue-800',
  Pending:          'bg-yellow-100 text-yellow-800',
  'Never Enrolled': 'bg-gray-100 text-gray-500',
}

const PLAN_OPTIONS = [
  { value: 'ST-COM',  label: 'ST-COM (Short-Term Commercial)' },
  { value: 'ST-MED',  label: 'ST-MED (Short-Term Medicaid)' },
  { value: 'ST-DUAL', label: 'ST-DUAL (Short-Term Dual)' },
  { value: 'LT-COM',  label: 'LT-COM (Long-Term Commercial)' },
  { value: 'LT-MED',  label: 'LT-MED (Long-Term Medicaid)' },
  { value: 'LT-DUAL', label: 'LT-DUAL (Long-Term Dual)' },
  { value: 'custom',  label: 'Custom' },
]

function PlanCell({ nurse, onSave }: { nurse: Nurse; onSave: (plan: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState(nurse.billingPlan ?? '')

  function commit(v: string) {
    setOpen(false)
    onSave(v || null)
  }

  if (open) {
    return (
      <select
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => commit(val)}
        onKeyDown={e => { if (e.key === 'Enter') commit(val); if (e.key === 'Escape') setOpen(false) }}
        className="w-[160px] border border-[#7A8F79] rounded px-1 py-0.5 text-[11px] text-[#2F3E4E] bg-white focus:outline-none"
      >
        <option value="">— none —</option>
        {PLAN_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  }

  return (
    <button
      onClick={() => { setVal(nurse.billingPlan ?? ''); setOpen(true) }}
      className="text-left hover:underline transition"
      title="Click to edit plan"
    >
      {nurse.billingPlan ? (
        <span className="bg-[#D9E1E8] text-[#2F3E4E] px-1.5 py-0.5 rounded text-[10px] font-semibold">
          {nurse.billingPlan}
        </span>
      ) : (
        <span className="italic text-[#7A8F79] opacity-50 text-[10px]">set plan</span>
      )}
    </button>
  )
}

function isExpired(dateStr?: string | null): boolean {
  if (!dateStr) return false
  const end = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return end < today
}

function effectiveStatus(n: Nurse): string {
  // Seasonal stays Seasonal even if end date passed
  if (n.billingStatus === 'Seasonal') return 'Seasonal'
  // Expired end date → auto-termed
  if (isExpired(n.serviceEndDate)) return 'Termed'
  if (n.billingStatus) return n.billingStatus
  if (n.enrolledInBilling === true) return 'Active'
  if (n.onboardingComplete && n.enrolledInBilling == null) return 'Pending'
  return 'Never Enrolled'
}

function filterByTab(nurses: Nurse[], tab: Tab): Nurse[] {
  return nurses.filter(n => {
    const s = effectiveStatus(n)
    if (tab === 'All Users') return true
    if (tab === 'Never Enrolled') return s === 'Never Enrolled'
    return s === tab
  })
}

const STATUS_ACTIONS: Record<string, string[]> = {
  Active:           ['Termed', 'Seasonal'],
  Termed:           ['Active', 'Seasonal'],
  Seasonal:         ['Active', 'Termed'],
  Pending:          ['Active', 'Termed'],
  'Never Enrolled': ['Active', 'Pending'],
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: '2-digit' })
}

// ISO date string for <input type="date"> value
function toInputDate(d?: string | null): string {
  if (!d) return ''
  return d.slice(0, 10)
}

type EditingCell = { nurseId: string; field: 'serviceStartDate' | 'serviceEndDate' }

function DateCell({
  nurse, field, editing, editVal, setEditVal, setEditing, startEdit, commitEdit,
}: {
  nurse: Nurse
  field: EditingCell['field']
  editing: EditingCell | null
  editVal: string
  setEditVal: (v: string) => void
  setEditing: (e: EditingCell | null) => void
  startEdit: (nurseId: string, field: EditingCell['field'], current?: string | null) => void
  commitEdit: () => void
}) {
  const isEditingThis = editing?.nurseId === nurse.id && editing?.field === field
  const value = field === 'serviceStartDate' ? nurse.serviceStartDate : nurse.serviceEndDate
  const expired = field === 'serviceEndDate' && isExpired(nurse.serviceEndDate)

  if (isEditingThis) {
    return (
      <input
        type="date"
        autoFocus
        value={editVal}
        onChange={e => setEditVal(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null) }}
        className="w-[110px] border border-[#7A8F79] rounded px-1 py-0.5 text-[11px] text-[#2F3E4E] focus:outline-none"
      />
    )
  }

  return (
    <button
      onClick={() => startEdit(nurse.id, field, value)}
      className={`text-left hover:underline transition ${expired ? 'text-red-500' : 'text-[#7A8F79]'} ${!value ? 'italic opacity-50' : ''}`}
    >
      {value ? fmtDate(value) : (field === 'serviceStartDate' ? 'set start' : 'ongoing')}
    </button>
  )
}

export default function EnrollmentPage() {
  const [nurses, setNurses] = useState<Nurse[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Active')
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [resetting, setResetting] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'status' | 'name' | 'plan' | 'since' | 'range' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [editVal, setEditVal] = useState('')

  function toggleSort(field: 'status' | 'name' | 'plan' | 'since' | 'range') {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  useEffect(() => {
    fetch('/api/admin/enrollment', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setNurses(data); setLoading(false) })
  }, [])

  const counts = useMemo(() => {
    const result: Record<Tab, number> = { Active: 0, Termed: 0, Seasonal: 0, Pending: 0, 'Never Enrolled': 0, 'All Users': nurses.length }
    nurses.forEach(n => {
      const s = effectiveStatus(n)
      if (s === 'Active') result['Active']++
      else if (s === 'Termed') result['Termed']++
      else if (s === 'Seasonal') result['Seasonal']++
      else if (s === 'Pending') result['Pending']++
      else result['Never Enrolled']++
    })
    return result
  }, [nurses])

  const visible = useMemo(() => {
    let filtered = filterByTab(nurses, tab)
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(n =>
        n.displayName.toLowerCase().includes(q) ||
        n.user.email.toLowerCase().includes(q) ||
        n.accountNumber?.toLowerCase().includes(q) ||
        n.npiNumber?.includes(q)
      )
    }
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let av = '', bv = ''
        if (sortField === 'status') { av = effectiveStatus(a); bv = effectiveStatus(b) }
        else if (sortField === 'name') { av = a.displayName; bv = b.displayName }
        else if (sortField === 'plan') { av = a.billingPlan ?? ''; bv = b.billingPlan ?? '' }
        else if (sortField === 'since') { av = a.agreementSignedAt ?? a.planStartDate ?? ''; bv = b.agreementSignedAt ?? b.planStartDate ?? '' }
        else if (sortField === 'range') { av = a.serviceStartDate ?? ''; bv = b.serviceStartDate ?? '' }
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }
    return filtered
  }, [nurses, tab, search, sortField, sortDir])

  async function resetEnrollment(nurseId: string, displayName: string) {
    if (!confirm(`Reset enrollment for ${displayName}? They will be sent through the full onboarding wizard on their next login.`)) return
    setResetting(nurseId)
    const res = await fetch(`/api/admin/enrollment/${nurseId}/reset`, {
      method: 'POST',
      credentials: 'include',
    })
    if (res.ok) {
      setNurses(prev => prev.map(n => n.id === nurseId ? {
        ...n,
        onboardingComplete: false,
        enrolledInBilling: undefined,
        billingPlan: undefined,
        billingDurationType: undefined,
        billingStatus: undefined,
      } : n))
    }
    setResetting(null)
  }

  async function setPlan(nurseId: string, plan: string | null) {
    const res = await fetch(`/api/admin/enrollment/${nurseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ billingPlan: plan }),
    })
    if (res.ok) {
      const updated = await res.json()
      setNurses(prev => prev.map(n => n.id === nurseId ? { ...n, billingPlan: updated.billingPlan } : n))
    }
  }

  async function setStatus(nurseId: string, status: string | null) {
    setUpdating(nurseId)
    const res = await fetch(`/api/admin/enrollment/${nurseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ billingStatus: status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setNurses(prev => prev.map(n => n.id === nurseId ? { ...n, billingStatus: updated.billingStatus } : n))
    }
    setUpdating(null)
  }

  function startEdit(nurseId: string, field: EditingCell['field'], current?: string | null) {
    setEditing({ nurseId, field })
    setEditVal(toInputDate(current))
  }

  async function commitEdit() {
    if (!editing) return
    const { nurseId, field } = editing
    const nurse = nurses.find(n => n.id === nurseId)
    if (!nurse) { setEditing(null); return }

    // Require start date if saving end date
    if (field === 'serviceEndDate' && editVal && !nurse.serviceStartDate && !editVal) {
      setEditing(null); return
    }
    if (field === 'serviceStartDate' && !editVal) {
      setEditing(null); return // blank start not allowed — just cancel
    }

    setUpdating(nurseId)
    const res = await fetch(`/api/admin/enrollment/${nurseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ [field]: editVal || null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setNurses(prev => prev.map(n => n.id === nurseId ? {
        ...n,
        serviceStartDate: updated.serviceStartDate,
        serviceEndDate: updated.serviceEndDate,
      } : n))
    }
    setUpdating(null)
    setEditing(null)
  }

  const cols = [
    { key: 'name',   label: 'Provider',       cls: '' },
    { key: null,     label: 'Account',         cls: '' },
    { key: 'plan',   label: 'Plan',            cls: 'hidden sm:table-cell' },
    { key: null,     label: 'Duration',        cls: 'hidden md:table-cell' },
    { key: 'since',  label: 'Since',           cls: 'hidden md:table-cell' },
    { key: 'range',  label: 'Service Range',   cls: 'hidden lg:table-cell' },
    { key: null,     label: 'Last Login',      cls: 'hidden lg:table-cell' },
    { key: 'status', label: 'Status',          cls: '' },
    { key: null,     label: 'Actions',         cls: 'text-right' },
  ] as { key: 'name'|'plan'|'since'|'range'|'status'|null; label: string; cls: string }[]

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <AdminNav />

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="page-heading">
            <h1 className="text-2xl font-bold text-[#2F3E4E]">
              <span className="text-[#7A8F79] italic">ad</span>Enrollment
            </h1>
            <p className="text-xs text-[#7A8F79] mt-0.5">Billing service enrollment status for all providers</p>
          </div>
          <input
            type="text"
            placeholder="Search name, email, account..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-[#D9E1E8] bg-white px-3 py-1.5 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79] w-56"
          />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition ${
                tab === t ? TAB_COLORS[t] : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'
              }`}
            >
              {t}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-white/40' : 'bg-[#D9E1E8]'}`}>
                {counts[t]}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card bg-white rounded-xl overflow-x-auto">
          {loading ? (
            <p className="text-sm text-[#7A8F79] p-6 text-center">Loading...</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-[#7A8F79] p-6 text-center">No providers in this view.</p>
          ) : (
            <table className="w-full text-xs text-[#2F3E4E]">
              <thead>
                <tr className="bg-[#2F3E4E] text-white text-left">
                  {cols.map(col => (
                    <th key={col.label} className={`px-3 py-2 font-semibold whitespace-nowrap ${col.cls}`}>
                      {col.key ? (
                        <button onClick={() => toggleSort(col.key!)} className="flex items-center gap-1 hover:text-[#7A8F79] transition">
                          {col.label}
                          <span className="text-[10px]">
                            {sortField === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                          </span>
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E1E8]">
                {visible.map(n => {
                  const status = effectiveStatus(n)
                  const actions = STATUS_ACTIONS[status] ?? []
                  const autoTermed = isExpired(n.serviceEndDate) && n.billingStatus !== 'Seasonal'
                  return (
                    <tr key={n.id} className="data-row">

                      {/* Provider */}
                      <td className="px-3 py-2">
                        <Link href={`/admin/nurse/${n.user.id}`} className="font-semibold hover:text-[#7A8F79] transition">
                          {formalName(n) || n.displayName}
                        </Link>
                        <div className="text-[10px] text-[#7A8F79] truncate max-w-[140px]">{n.user.email}</div>
                      </td>

                      {/* Account # */}
                      <td className="px-3 py-2 font-mono text-[11px] text-[#7A8F79]">
                        {n.accountNumber ?? '—'}
                      </td>

                      {/* Plan */}
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <PlanCell nurse={n} onSave={(plan) => setPlan(n.id, plan)} />
                      </td>

                      {/* Duration */}
                      <td className="px-3 py-2 hidden md:table-cell text-[#7A8F79]">
                        {n.billingDurationType === 'full_year' ? 'Full Year'
                          : n.billingDurationType === 'policy_specific' ? 'Policy Specific'
                          : '—'}
                      </td>

                      {/* Since */}
                      <td className="px-3 py-2 hidden md:table-cell text-[#7A8F79]">
                        {fmtDate(n.agreementSignedAt ?? n.planStartDate)}
                      </td>

                      {/* Service Range */}
                      <td className="px-3 py-2 hidden lg:table-cell">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-bold uppercase tracking-wide text-[#7A8F79] w-7">Start</span>
                            <DateCell nurse={n} field="serviceStartDate" editing={editing} editVal={editVal} setEditVal={setEditVal} setEditing={setEditing} startEdit={startEdit} commitEdit={commitEdit} />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-bold uppercase tracking-wide text-[#7A8F79] w-7">End</span>
                            <DateCell nurse={n} field="serviceEndDate" editing={editing} editVal={editVal} setEditVal={setEditVal} setEditing={setEditing} startEdit={startEdit} commitEdit={commitEdit} />
                          </div>
                          {autoTermed && (
                            <span className="text-[9px] text-red-400 font-semibold">auto-termed</span>
                          )}
                        </div>
                      </td>

                      {/* Last login */}
                      <td className="px-3 py-2 hidden lg:table-cell text-[#7A8F79]">
                        {fmtDate(n.user.lastLoginAt)}
                      </td>

                      {/* Status badge */}
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${BADGE_COLORS[status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {actions.map(a => (
                            <button
                              key={a}
                              disabled={updating === n.id}
                              onClick={() => setStatus(n.id, a)}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold border border-[#D9E1E8] hover:border-[#7A8F79] hover:text-[#7A8F79] transition disabled:opacity-40"
                            >
                              {a}
                            </button>
                          ))}
                          <button
                            disabled={resetting === n.id}
                            onClick={() => resetEnrollment(n.id, n.displayName)}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold border border-red-200 text-red-400 hover:border-red-400 hover:text-red-600 transition disabled:opacity-40"
                            title="Reset enrollment — nurse will re-complete onboarding on next login"
                          >
                            {resetting === n.id ? '…' : 'Reset'}
                          </button>
                          <Link
                            href={`/admin/nurse/${n.user.id}`}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#2F3E4E] text-white hover:bg-[#7A8F79] transition"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {!loading && visible.length > 0 && (
            <div className="px-4 py-2 border-t border-[#D9E1E8] text-[10px] text-[#7A8F79]">
              {visible.length} provider{visible.length !== 1 ? 's' : ''} {search ? 'matched' : 'in this view'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
