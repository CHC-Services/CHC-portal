'use client'

import { useEffect, useState } from 'react'

type QuickAccessToken = { id: string; deviceLabel: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }

// Read-only view of a nurse's Progress Note quick-access shortcuts, with a
// Revoke button — for lost/stolen-device support. Admin never sees the
// token itself, only metadata (see app/nurse/profile/page.tsx for where the
// nurse generates these).
export default function NurseQuickAccessTokensCard({ nurseId }: { nurseId: string }) {
  const [tokens, setTokens] = useState<QuickAccessToken[]>([])
  const [loading, setLoading] = useState(true)

  function load() {
    fetch(`/api/admin/nurses/${nurseId}/quick-access-tokens`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setTokens(d.tokens || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [nurseId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function revoke(id: string) {
    await fetch(`/api/admin/nurses/${nurseId}/quick-access-tokens/${id}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-[#D9E1E8]">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79]">Quick-Access Shortcuts</h2>
      </div>
      {loading ? (
        <p className="text-sm text-[#7A8F79]">Loading…</p>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-[#7A8F79] italic">No shortcuts created.</p>
      ) : (
        <div className="space-y-1.5">
          {tokens.map(t => (
            <div key={t.id} className="flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2">
              <div>
                <p className="text-sm text-[#2F3E4E] font-semibold">{t.deviceLabel}{t.revokedAt ? ' (revoked)' : ''}</p>
                <p className="text-xs text-[#7A8F79]">
                  Created {new Date(t.createdAt).toLocaleDateString()}
                  {t.lastUsedAt ? ` · Last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : ' · Never used'}
                </p>
              </div>
              {!t.revokedAt && (
                <button type="button" onClick={() => revoke(t.id)} className="text-xs font-semibold text-red-500 hover:text-red-700 transition">Revoke</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
