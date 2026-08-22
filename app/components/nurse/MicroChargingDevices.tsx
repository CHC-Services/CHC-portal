'use client'

import { useEffect, useState } from 'react'

// Replaces the old "Quick-Access Shortcuts" card on the Profile page — same
// underlying token endpoints (app/api/nurse/quick-access-tokens/*,
// unchanged), but a fixed, hard-capped set of numbered device slots instead
// of an open-ended list.
//
// Capped at exactly MAX_SLOTS — every Connect/Reconnect click issues a
// brand-new token row under the hood (tokens can't be renamed/relabeled in
// place, only revoked + recreated), so an open-ended list would grow
// unbounded from ordinary use, retries, and testing. Slot position (1 or 2)
// is derived from creation order among the nurse's currently-ACTIVE tokens,
// not from anything stored — and the displayed label is ALWAYS freshly
// computed as "{FirstName}-Device N", never read from a token's stored
// deviceLabel. This is deliberate: it means a token created under the old
// free-text-label Profile UI (or any other legacy/inconsistent name) can
// never resurface its old name here, with no data migration needed — the
// UI simply never trusts stored label text for display again.
type Token = { id: string; deviceLabel: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }

const MAX_SLOTS = 2

function deviceInstructions(): { steps: string[] } {
  if (typeof navigator === 'undefined') return { steps: [] }
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) {
    return { steps: ['Tap the Share icon at the bottom of the screen', 'Scroll down and tap "Add to Home Screen"'] }
  }
  if (/Android/.test(ua)) {
    return { steps: ['Tap the ⋮ menu in the top right', 'Tap "Add to Home Screen" or "Install app"'] }
  }
  return { steps: ['Open the link above on your phone\'s browser, then use its "Add to Home Screen" option'] }
}

export default function MicroChargingDevices() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('My')
  const [connectingSlot, setConnectingSlot] = useState<number | null>(null)
  const [setupUrl, setSetupUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  function loadTokens() {
    return fetch('/api/nurse/quick-access-tokens', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setTokens(d.tokens || []); setLoading(false) })
  }

  useEffect(() => {
    loadTokens()
    fetch('/api/nurse/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setFirstName(d.profile?.firstName || d.profile?.displayName || 'My'))
      .catch(() => {})
  }, [])

  // Oldest-first among currently-active tokens, capped at MAX_SLOTS — if
  // more than MAX_SLOTS active tokens exist (leftover from before this cap
  // existed), only the two oldest are shown/managed; anything beyond that
  // is simply not surfaced here anymore (still technically usable if
  // someone still has that old link saved, but no longer tracked in this UI).
  const activeTokens = tokens
    .filter(t => !t.revokedAt)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, MAX_SLOTS)

  const slots: (Token | null)[] = Array.from({ length: MAX_SLOTS }, (_, i) => activeTokens[i] || null)

  async function connect(slotIndex: number, existing: Token | null) {
    setError('')
    setConnectingSlot(slotIndex)
    const label = `${firstName}-Device ${slotIndex + 1}`

    if (existing) {
      await fetch(`/api/nurse/quick-access-tokens/${existing.id}`, { method: 'DELETE', credentials: 'include' })
    }
    const res = await fetch('/api/nurse/quick-access-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ deviceLabel: label }),
    })
    setConnectingSlot(null)
    if (res.ok) {
      const { token } = await res.json()
      setSetupUrl(`${window.location.origin}/quick-notes?t=${token}`)
      loadTokens()
    } else {
      setError('Failed to connect. Please try again.')
    }
  }

  async function disconnect(id: string) {
    await fetch(`/api/nurse/quick-access-tokens/${id}`, { method: 'DELETE', credentials: 'include' })
    loadTokens()
  }

  const instructions = deviceInstructions()

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
      <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E]">Micro-Charting Devices</p>
      <p className="text-xs text-[#7A8F79]">Connect up to {MAX_SLOTS} devices (e.g. a phone and a tablet) to dictate progress notes on the go, without logging in each time.</p>

      {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {loading ? (
        <p className="text-sm text-[#7A8F79]">Loading…</p>
      ) : (
        <div className="space-y-1.5">
          {slots.map((token, i) => (
            <div key={i} className="flex items-center justify-between bg-[#F4F6F5] rounded-lg px-3 py-2 gap-2">
              <div>
                <p className="text-sm text-[#2F3E4E] font-semibold">{firstName}-Device {i + 1}</p>
                <p className="text-xs text-[#7A8F79]">
                  {!token ? 'Not connected' : token.lastUsedAt ? `Last used ${new Date(token.lastUsedAt).toLocaleDateString()}` : 'Never used'}
                </p>
              </div>
              {!token ? (
                <button
                  type="button"
                  disabled={connectingSlot === i}
                  onClick={() => connect(i, null)}
                  className="text-xs font-semibold text-white bg-[#2F3E4E] px-3 py-1.5 rounded-lg hover:bg-[#7A8F79] transition disabled:opacity-50 shrink-0"
                >
                  {connectingSlot === i ? 'Connecting…' : 'Connect'}
                </button>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={connectingSlot === i}
                    onClick={() => connect(i, token)}
                    className="text-xs font-semibold text-[#2F3E4E] border border-[#D9E1E8] px-3 py-1.5 rounded-lg hover:border-[#7A8F79] transition disabled:opacity-50"
                  >
                    {connectingSlot === i ? 'Reconnecting…' : 'Reconnect Micro-Charting'}
                  </button>
                  <button type="button" onClick={() => disconnect(token.id)} className="text-xs font-semibold text-red-500 hover:text-red-700 transition">Disconnect</button>
                </div>
              )}
            </div>
          ))}

          {setupUrl && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-800">You&apos;re connected — one more step</p>
              <a
                href={setupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center bg-[#2F3E4E] text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-[#7A8F79] transition"
              >
                Open Micro-Charting
              </a>
              <div className="text-xs text-amber-700 space-y-1">
                <p className="font-semibold">To save it to your home screen:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  {instructions.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
              <p className="text-[10px] text-amber-700">If you lose this later, just come back here and tap &quot;Reconnect&quot; — no need to start over.</p>
              <button type="button" onClick={() => setSetupUrl(null)} className="text-xs font-semibold text-amber-800 hover:text-amber-900 transition">Done</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
