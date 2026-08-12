'use client'

import { useState, useEffect } from 'react'
import AdminNav from '../../../components/AdminNav'
import Link from 'next/link'

// Kept local (not imported from lib/profileCards.ts) so this client component
// never pulls the Prisma client into the browser bundle — just labels.
const CARD_LABELS: Record<string, string> = {
  demographics: 'Demographics',
  billing_info: 'Billing Info',
  banking: 'Banking',
}
const ROLE_LABELS: Record<string, string> = {
  nurse: 'Nurse',
  admin: 'Admin',
  biller: 'Biller',
  provider: 'Provider',
  guardian: 'Guardian / Family',
}
const ROLES = ['nurse', 'admin', 'biller', 'provider', 'guardian']

type MatrixRow = { cardKey: string; roles: Record<string, boolean> }

export default function ProfileCardsSettingsPage() {
  const [matrix, setMatrix] = useState<MatrixRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingCell, setSavingCell] = useState<string | null>(null)

  function load() {
    fetch('/api/admin/profile-card-config', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setMatrix(data.matrix || [])
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [])

  async function toggle(cardKey: string, role: string, enabled: boolean) {
    const cellId = `${cardKey}:${role}`
    setSavingCell(cellId)
    setMatrix(m => m.map(row => row.cardKey === cardKey ? { ...row, roles: { ...row.roles, [role]: enabled } } : row))
    await fetch('/api/admin/profile-card-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cardKey, role, enabled }),
    })
    setSavingCell(null)
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <AdminNav />

      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin/system" className="text-sm text-[#7A8F79] hover:text-[#2F3E4E] transition">⚙ System</Link>
        <span className="text-[#7A8F79] text-sm">/</span>
        <span className="text-sm text-[#2F3E4E] font-semibold">User Profile Data</span>
      </div>
      <h1 className="text-3xl font-bold text-[#2F3E4E] mb-1">User Profile Data</h1>
      <p className="text-sm text-[#7A8F79] mb-8">
        Choose which profile cards each account role sees on their profile page. Changes apply immediately — no deploy needed.
      </p>

      <div className="max-w-3xl">
        {loading ? (
          <p className="text-sm text-[#7A8F79]">Loading…</p>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F4F6F5]">
                  <tr>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] px-4 py-3">Card</th>
                    {ROLES.map(role => (
                      <th key={role} className="text-center text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] px-4 py-3">
                        {ROLE_LABELS[role]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map(row => (
                    <tr key={row.cardKey} className="border-t border-[#D9E1E8]">
                      <td className="px-4 py-3 text-sm font-semibold text-[#2F3E4E]">{CARD_LABELS[row.cardKey] || row.cardKey}</td>
                      {ROLES.map(role => {
                        const cellId = `${row.cardKey}:${role}`
                        return (
                          <td key={role} className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={!!row.roles[role]}
                              disabled={savingCell === cellId}
                              onChange={e => toggle(row.cardKey, role, e.target.checked)}
                              className="accent-[#7A8F79] w-4 h-4 disabled:opacity-50"
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
