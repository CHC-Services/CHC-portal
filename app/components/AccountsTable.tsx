'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export type Account = {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
  lastLoginAt: string | null
  displayName: string | null
  accountNumber: string | null
  nurseProfileId: string | null
  isDemo: boolean
}

type SortKey = 'name' | 'role' | 'createdAt' | 'lastLoginAt'

const ROLE_LABEL: Record<string, string> = {
  nurse: 'Nurse',
  provider: 'Pending Provider',
  admin: 'Admin',
  biller: 'Biller',
  guardian: 'Guardian / Family',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Nurse/provider rows go to the existing per-nurse detail page (keyed by
// nurseProfile.id, not user.id); admin/guardian rows go to the new lightweight
// account-profile page (keyed by user.id). Biller has no portal at all today,
// so there's nowhere meaningful to send those rows yet.
function accountHref(a: Account): string | null {
  if ((a.role === 'nurse' || a.role === 'provider') && a.nurseProfileId) return `/admin/nurse/${a.nurseProfileId}`
  if (a.role === 'admin' || a.role === 'guardian') return `/admin/accounts/${a.id}`
  return null
}

export default function AccountsTable({ accounts, loading }: { accounts: Account[]; loading: boolean }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = accounts
    if (q) {
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.displayName || '').toLowerCase().includes(q) ||
        (a.accountNumber || '').toLowerCase().includes(q)
      )
    }
    const sorted = [...list].sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      if (sortKey === 'name') { av = a.displayName || a.name; bv = b.displayName || b.name }
      else if (sortKey === 'role') { av = a.role; bv = b.role }
      else if (sortKey === 'createdAt') { av = a.createdAt; bv = b.createdAt }
      else if (sortKey === 'lastLoginAt') { av = a.lastLoginAt || ''; bv = b.lastLoginAt || '' }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [accounts, search, sortKey, sortDir])

  const th = (key: SortKey, label: string) => (
    <th
      onClick={() => toggleSort(key)}
      className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] px-3 py-2 cursor-pointer select-none hover:text-[#2F3E4E] transition"
    >
      {label} {sortKey === key && (sortDir === 'asc' ? '▲' : '▼')}
    </th>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-[#D9E1E8]">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full max-w-sm border border-[#D9E1E8] p-2 rounded-lg text-sm text-[#2F3E4E] placeholder-[#aab] focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
        />
      </div>

      {loading ? (
        <p className="text-sm text-[#7A8F79] p-4">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[#7A8F79] italic p-4">No accounts found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F4F6F5]">
              <tr>
                {th('name', 'Name')}
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] px-3 py-2">Email</th>
                {th('role', 'Role')}
                {th('createdAt', 'Created')}
                {th('lastLoginAt', 'Last Login')}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const href = accountHref(a)
                return (
                <tr key={a.id} className="border-t border-[#D9E1E8] hover:bg-[#F4F6F5] transition">
                  <td className="px-3 py-2 text-sm text-[#2F3E4E] font-semibold">
                    {href ? (
                      <Link href={href} className="hover:text-[#7A8F79] hover:underline transition">
                        {a.displayName || a.name}
                      </Link>
                    ) : (
                      a.displayName || a.name
                    )}
                    {a.isDemo && <span className="ml-2 text-[9px] font-bold uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Test</span>}
                  </td>
                  <td className="px-3 py-2 text-sm text-[#7A8F79]">{a.email}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className="font-semibold text-[#2F3E4E]">{ROLE_LABEL[a.role] || a.role}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-[#7A8F79]">{fmtDate(a.createdAt)}</td>
                  <td className="px-3 py-2 text-xs text-[#7A8F79]">{fmtDate(a.lastLoginAt)}</td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
