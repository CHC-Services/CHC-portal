'use client'

import { useState, useEffect, useCallback } from 'react'
import AdminNav from '../../../components/AdminNav'
import Link from 'next/link'

type LogRow = {
  id: string
  timestamp: string
  accountType: string
  email: string
  firstName: string | null
  lastName: string | null
  accountNumber: string | null
  result: string
  ip: string | null
}

const ACCOUNT_TYPES = ['admin', 'nurse', 'biller', 'provider', 'guardian', 'unknown']
const RESULT_PREFIXES = ['Success', 'Failed', 'Pending']

function resultBadge(result: string) {
  if (result === 'Success') return 'bg-green-50 text-green-700 border-green-200'
  if (result.startsWith('Pending')) return 'bg-blue-50 text-blue-700 border-blue-200'
  return 'bg-red-50 text-red-600 border-red-200'
}

function resultDot(result: string) {
  if (result === 'Success') return 'bg-green-500'
  if (result.startsWith('Pending')) return 'bg-blue-400'
  return 'bg-red-400'
}

function initials(row: LogRow) {
  const f = row.firstName?.[0]?.toUpperCase() ?? ''
  const l = row.lastName?.[0]?.toUpperCase() ?? ''
  if (f || l) return `${f}${l}`
  const parts = row.email.split('@')[0].split(/[._-]/)
  return (parts[0]?.[0] ?? '').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase()
}

function formatTs(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit', day: '2-digit', year: '2-digit',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
    hour12: true,
  })
}

export default function LoginLogPage() {
  const [rows, setRows] = useState<LogRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // filters
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterResult, setFilterResult] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  // delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterType) params.set('accountType', filterType)
    if (filterResult) params.set('result', filterResult)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    params.set('page', String(p))
    const res = await fetch(`/api/admin/system/login-log?${params}`, { credentials: 'include' })
    const data = await res.json()
    setRows(data.rows ?? [])
    setTotal(data.total ?? 0)
    setPage(p)
    setLoaded(true)
    setLoading(false)
  }, [search, filterType, filterResult, dateFrom, dateTo])

  useEffect(() => { load(1) }, [load])

  async function deleteOne(id: string) {
    setDeletingId(id)
    await fetch('/api/admin/system/login-log', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id }),
    })
    setDeletingId(null)
    load(page)
  }

  async function clearAll() {
    setClearingAll(true)
    await fetch('/api/admin/system/login-log', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ all: true }),
    })
    setClearingAll(false)
    setConfirmClearAll(false)
    load(1)
  }

  function downloadCsv() {
    const headers = ['Date/Time (ET)', 'Account Type', 'Email', 'Initials', 'Account #', 'Result', 'IP']
    const csvRows = rows.map(r => [
      formatTs(r.timestamp),
      r.accountType,
      r.email,
      initials(r),
      r.accountNumber ?? '—',
      r.result,
      r.ip ?? '—',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `login-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / 100)

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <AdminNav />

      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin/system" className="text-sm text-[#7A8F79] hover:text-[#2F3E4E] transition">⚙ System</Link>
        <span className="text-[#7A8F79] text-sm">/</span>
        <span className="text-sm text-[#2F3E4E] font-semibold">Login Log</span>
      </div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2F3E4E]">Login Log</h1>
          <p className="text-sm text-[#7A8F79] mt-1">Every login attempt recorded in real time.</p>
        </div>
        <div className="flex gap-2 mt-1 shrink-0">
          <button
            onClick={downloadCsv}
            disabled={rows.length === 0}
            className="border border-[#D9E1E8] text-[#7A8F79] text-xs font-semibold px-3 py-1.5 rounded-lg hover:border-[#7A8F79] hover:text-[#2F3E4E] transition disabled:opacity-40"
          >
            ↓ Export CSV
          </button>
          {!confirmClearAll ? (
            <button
              onClick={() => setConfirmClearAll(true)}
              disabled={total === 0}
              className="border border-red-200 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-lg hover:border-red-400 hover:text-red-600 transition disabled:opacity-40"
            >
              Clear All
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-white border border-red-300 rounded-lg px-3 py-1.5">
              <span className="text-xs text-red-600 font-semibold">Delete all {total} records?</span>
              <button
                onClick={clearAll}
                disabled={clearingAll}
                className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded transition disabled:opacity-50"
              >
                {clearingAll ? '…' : 'Yes'}
              </button>
              <button onClick={() => setConfirmClearAll(false)} className="text-xs text-[#7A8F79] hover:text-[#2F3E4E]">Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Search email, name, account #, IP…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="col-span-2 border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
          />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
          >
            <option value="">All account types</option>
            {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filterResult}
            onChange={e => setFilterResult(e.target.value)}
            className="border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
          >
            <option value="">All results</option>
            {RESULT_PREFIXES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="flex gap-1.5 items-center">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="flex-1 border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              title="From date"
            />
            <span className="text-[#7A8F79] text-xs">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="flex-1 border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              title="To date"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[#D9E1E8] flex items-center justify-between">
          <p className="text-xs font-semibold text-[#7A8F79] uppercase tracking-wide">
            {loaded ? `${total.toLocaleString()} record${total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
          {loading && <span className="text-xs text-[#7A8F79]">Refreshing…</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#D9E1E8] bg-[#F4F6F5]">
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] whitespace-nowrap">Date / Time (ET)</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[#7A8F79]">Type</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[#7A8F79]">Email</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[#7A8F79]">Initials</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[#7A8F79] whitespace-nowrap">Account #</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[#7A8F79]">Result</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[#7A8F79]">IP</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {!loaded ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[#7A8F79]">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[#7A8F79] italic">No records match the current filters.</td></tr>
              ) : rows.map((row, i) => (
                <tr key={row.id} className={`border-b border-[#D9E1E8] hover:bg-[#F4F6F5] transition ${i % 2 === 0 ? '' : 'bg-[#fafbfc]'}`}>
                  <td className="px-4 py-2.5 text-xs text-[#2F3E4E] font-mono whitespace-nowrap">{formatTs(row.timestamp)}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-semibold capitalize text-[#2F3E4E]">{row.accountType}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#2F3E4E] max-w-[180px] truncate">{row.email}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#D9E1E8] text-[10px] font-bold text-[#2F3E4E]">
                      {initials(row) || '?'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#2F3E4E] font-mono">{row.accountNumber ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${resultBadge(row.result)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${resultDot(row.result)}`} />
                      {row.result}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#7A8F79] font-mono">{row.ip ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => deleteOne(row.id)}
                      disabled={deletingId === row.id}
                      className="text-[11px] text-red-400 hover:text-red-600 font-semibold transition disabled:opacity-40"
                    >
                      {deletingId === row.id ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[#D9E1E8] flex items-center justify-between">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1 || loading}
              className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] disabled:opacity-40 transition"
            >
              ← Previous
            </button>
            <span className="text-xs text-[#7A8F79]">Page {page} of {totalPages}</span>
            <button
              onClick={() => load(page + 1)}
              disabled={page >= totalPages || loading}
              className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] disabled:opacity-40 transition"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
