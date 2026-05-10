'use client'

import { useEffect, useState, useMemo } from 'react'
import AdminNav from '../../components/AdminNav'
import Link from 'next/link'

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
  Active:   'bg-green-100 text-green-800',
  Termed:   'bg-red-100 text-red-800',
  Seasonal: 'bg-blue-100 text-blue-800',
  Pending:  'bg-yellow-100 text-yellow-800',
  'Never Enrolled': 'bg-gray-100 text-gray-500',
}

const PLAN_LABELS: Record<string, string> = {
  A1: 'A1 — Medicaid',
  A2: 'A2 — Commercial',
  B:  'B — Dual',
  custom: 'Custom',
}

function effectiveStatus(n: Nurse): string {
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

function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: '2-digit' })
}

export default function EnrollmentPage() {
  const [nurses, setNurses] = useState<Nurse[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Active')
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'status' | 'name' | 'plan' | 'since' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function toggleSort(field: 'status' | 'name' | 'plan' | 'since') {
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
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }
    return filtered
  }, [nurses, tab, search, sortField, sortDir])

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

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <AdminNav />

        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div>
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
                tab === t
                  ? TAB_COLORS[t]
                  : 'bg-white text-[#7A8F79] border-[#D9E1E8] hover:border-[#7A8F79]'
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
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <p className="text-sm text-[#7A8F79] p-6 text-center">Loading...</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-[#7A8F79] p-6 text-center">No providers in this view.</p>
          ) : (
            <table className="w-full text-xs text-[#2F3E4E]">
              <thead>
                <tr className="bg-[#2F3E4E] text-white text-left">
                  {([
                    { key: 'name',   label: 'Provider',   cls: '' },
                    { key: null,     label: 'Account',    cls: '' },
                    { key: 'plan',   label: 'Plan',       cls: 'hidden sm:table-cell' },
                    { key: null,     label: 'Duration',   cls: 'hidden md:table-cell' },
                    { key: 'since',  label: 'Since',      cls: 'hidden md:table-cell' },
                    { key: null,     label: 'Last Login', cls: 'hidden lg:table-cell' },
                    { key: 'status', label: 'Status',     cls: '' },
                    { key: null,     label: 'Actions',    cls: 'text-right' },
                  ] as { key: 'name'|'plan'|'since'|'status'|null; label: string; cls: string }[]).map(col => (
                    <th key={col.label} className={`px-3 py-2 font-semibold ${col.cls}`}>
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
                  return (
                    <tr key={n.id} className="hover:bg-[#F4F6F5] transition">
                      {/* Provider */}
                      <td className="px-3 py-2">
                        <Link href={`/admin/nurse/${n.user.id}`} className="font-semibold hover:text-[#7A8F79] transition">
                          {n.displayName}
                        </Link>
                        <div className="text-[10px] text-[#7A8F79] truncate max-w-[140px]">{n.user.email}</div>
                      </td>

                      {/* Account # */}
                      <td className="px-3 py-2 font-mono text-[11px] text-[#7A8F79]">
                        {n.accountNumber ?? '—'}
                      </td>

                      {/* Plan */}
                      <td className="px-3 py-2 hidden sm:table-cell">
                        {n.billingPlan ? (
                          <span className="bg-[#D9E1E8] text-[#2F3E4E] px-1.5 py-0.5 rounded text-[10px] font-semibold">
                            {PLAN_LABELS[n.billingPlan] ?? n.billingPlan}
                          </span>
                        ) : '—'}
                      </td>

                      {/* Duration */}
                      <td className="px-3 py-2 hidden md:table-cell text-[#7A8F79]">
                        {n.billingDurationType === 'full_year' ? 'Full Year'
                          : n.billingDurationType === 'policy_specific' ? 'Policy Specific'
                          : '—'}
                      </td>

                      {/* Since */}
                      <td className="px-3 py-2 hidden md:table-cell text-[#7A8F79]">
                        {fmt(n.agreementSignedAt ?? n.planStartDate)}
                      </td>

                      {/* Last login */}
                      <td className="px-3 py-2 hidden lg:table-cell text-[#7A8F79]">
                        {fmt(n.user.lastLoginAt)}
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

          {/* Footer count */}
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
