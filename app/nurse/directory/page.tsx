'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PortalMessages from '../../components/PortalMessages'

type DirectoryNurse = {
  id: string
  firstName: string
  email: string | null
  phone: string | null
}
type CaseGroup = {
  caseId: string
  patientFirstName: string
  nurses: DirectoryNurse[]
}
type MySettings = {
  dirOptIn: boolean
  dirShowEmail: boolean
  dirShowPhone: boolean
  firstName: string | null
}

function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#7A8F79] focus:ring-offset-1 disabled:opacity-40 ${checked ? 'bg-[#7A8F79]' : 'bg-[#D9E1E8]'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function DirectoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [directory, setDirectory] = useState<CaseGroup[]>([])
  const [mySettings, setMySettings] = useState<MySettings>({ dirOptIn: true, dirShowEmail: true, dirShowPhone: true, firstName: null })
  const [sortBy, setSortBy] = useState<'case' | 'name'>('case')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/nurse/directory', { credentials: 'include' })
      .then(r => { if (r.status === 401) { router.push('/login'); return null } return r.json() })
      .then(data => {
        if (!data) return
        setDirectory(data.directory || [])
        if (data.mySettings) setMySettings(data.mySettings)
      })
      .finally(() => setLoading(false))
  }, [router])

  async function patchSetting(updates: Partial<MySettings>) {
    setSaving(true)
    const next = { ...mySettings, ...updates }
    setMySettings(next)
    await fetch('/api/nurse/directory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    })
    setSaving(false)
  }

  // Flatten + sort for "by name" view
  const allNurses = directory.flatMap(c =>
    c.nurses.map(n => ({ ...n, caseLabel: c.patientFirstName, caseId: c.caseId }))
  )
  const byName = [...allNurses].sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''))

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">
      <div className="max-w-3xl mx-auto">

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">my</span>Directory
          </h1>
          <p className="text-sm text-[#7A8F79] mt-1">Care team contacts for the cases you&apos;re assigned to.</p>
        </div>

        <PortalMessages priority="General" />

        {/* ── Privacy Info + Controls ── */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 space-y-5">
          {/* Explainer */}
          <div className="bg-[#F4F6F5] rounded-lg p-4 text-sm text-[#2F3E4E] leading-relaxed space-y-1.5">
            <p className="font-semibold text-[#2F3E4E]">About your directory listing</p>
            <p className="text-xs text-[#7A8F79]">
              Your contact information is only visible to other nurses currently assigned to the same home care case — and only if they are registered users on this portal. You control exactly what is shown below.
            </p>
          </div>

          {/* Main opt-in toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#2F3E4E]">Show me in the directory</p>
              <p className="text-xs text-[#7A8F79] mt-0.5">When off, your name and contact info are hidden from all co-workers.</p>
            </div>
            <Toggle checked={mySettings.dirOptIn} onChange={v => patchSetting({ dirOptIn: v })} />
          </div>

          {/* Sub-toggles — only when opted in */}
          {mySettings.dirOptIn && (
            <div className="pl-4 border-l-2 border-[#D9E1E8] space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-24 shrink-0">
                  <p className="text-sm font-semibold text-[#2F3E4E]">
                    {mySettings.firstName || 'Your First Name'}
                  </p>
                  <p className="text-[10px] text-[#7A8F79]">Always shown</p>
                </div>
                <span className="text-xs text-[#7A8F79] italic">(pulled from your profile)</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#2F3E4E]">Show my email address</p>
                  <p className="text-xs text-[#7A8F79] mt-0.5">Visible to co-workers on shared cases</p>
                </div>
                <Toggle
                  checked={mySettings.dirShowEmail}
                  onChange={v => patchSetting({ dirShowEmail: v })}
                  disabled={!mySettings.dirOptIn}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#2F3E4E]">Show my phone number</p>
                  <p className="text-xs text-[#7A8F79] mt-0.5">Visible to co-workers on shared cases</p>
                </div>
                <Toggle
                  checked={mySettings.dirShowPhone}
                  onChange={v => patchSetting({ dirShowPhone: v })}
                  disabled={!mySettings.dirOptIn}
                />
              </div>
            </div>
          )}

          {saving && <p className="text-xs text-[#7A8F79]">Saving…</p>}
        </div>

        {/* ── Directory ── */}
        {loading ? (
          <p className="text-sm text-[#7A8F79] text-center py-10">Loading…</p>
        ) : directory.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center">
            <p className="text-[#2F3E4E] font-semibold">No cases assigned yet</p>
            <p className="text-sm text-[#7A8F79] mt-1">Your care coordinator will add you to a case and other team members will appear here.</p>
          </div>
        ) : (
          <>
            {/* Sort control */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-[#7A8F79] font-semibold uppercase tracking-wide">Sort by:</span>
              {(['case', 'name'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setSortBy(opt)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${sortBy === opt ? 'bg-[#2F3E4E] text-white' : 'bg-white text-[#7A8F79] hover:bg-[#D9E1E8]'}`}
                >
                  {opt === 'case' ? 'Case' : 'Name'}
                </button>
              ))}
            </div>

            {sortBy === 'case' ? (
              /* ── By Case ── */
              <div className="space-y-4">
                {directory.map(group => (
                  <div key={group.caseId} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="bg-[#2F3E4E] px-5 py-3 flex items-center gap-2">
                      <span className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">Case</span>
                      <span className="text-white font-bold">{group.patientFirstName}</span>
                    </div>
                    {group.nurses.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-[#7A8F79] italic">No other registered nurses listed for this case.</p>
                    ) : (
                      <div className="divide-y divide-[#F4F6F5]">
                        {group.nurses.map(n => (
                          <NurseRow key={n.id} nurse={n} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* ── By Name ── */
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="bg-[#2F3E4E] px-5 py-3">
                  <span className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold">All Co-Workers A–Z</span>
                </div>
                {byName.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-[#7A8F79] italic">No other registered nurses found.</p>
                ) : (
                  <div className="divide-y divide-[#F4F6F5]">
                    {byName.map((n, i) => (
                      <div key={`${n.id}-${i}`} className="px-5 py-3 flex items-center justify-between gap-3">
                        <NurseRow nurse={n} />
                        <span className="text-[10px] text-[#7A8F79] bg-[#F4F6F5] px-2 py-0.5 rounded-full shrink-0">{n.caseLabel}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function NurseRow({ nurse }: { nurse: DirectoryNurse }) {
  return (
    <div className="px-5 py-3 flex items-center gap-4 flex-wrap">
      {/* Avatar initials */}
      <div className="w-9 h-9 rounded-full bg-[#D9E1E8] flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-[#2F3E4E]">{(nurse.firstName || '?')[0].toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#2F3E4E]">{nurse.firstName}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
          {nurse.email && (
            <a href={`mailto:${nurse.email}`} className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] transition truncate">
              ✉ {nurse.email}
            </a>
          )}
          {nurse.phone && (
            <a href={`tel:${nurse.phone.replace(/\D/g, '')}`} className="text-xs text-[#7A8F79] hover:text-[#2F3E4E] transition">
              📞 {nurse.phone}
            </a>
          )}
          {!nurse.email && !nurse.phone && (
            <span className="text-xs text-[#D9E1E8] italic">No contact info shared</span>
          )}
        </div>
      </div>
    </div>
  )
}
