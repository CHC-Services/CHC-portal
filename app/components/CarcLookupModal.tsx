'use client'

import { useState, useRef } from 'react'

type CarcCode = {
  id: string
  code: string
  description: string
  active: boolean
  notes: string | null
}

// Standalone CARC/RARC reference lookup — a button that opens a search modal
// against /api/carc-codes. Not tied to any specific claim's data — Claim.remarkCodes
// is where admin records which codes actually apply to a given claim; this is a
// quick "what does this code on the EOB mean" tool for staff working claims by hand.
export default function CarcLookupModal({ showAdminTools }: { showAdminTools?: boolean }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CarcCode[]>([])
  const [loading, setLoading] = useState(false)
  const [copyMsg, setCopyMsg] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function copyFaqLink() {
    const res = await fetch('/api/admin/carc-codes/pdf', { credentials: 'include' })
    const data = await res.json()
    const fullUrl = `${window.location.origin}${data.link}`
    await navigator.clipboard.writeText(fullUrl)
    setCopyMsg('Link copied — paste it into your FAQ item.')
    setTimeout(() => setCopyMsg(''), 3000)
  }

  function handleChange(value: string) {
    setQuery(value)
    if (timer.current) clearTimeout(timer.current)
    if (value.trim().length < 1) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      const res = await fetch(`/api/carc-codes?q=${encodeURIComponent(value.trim())}`, { credentials: 'include' })
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
      setLoading(false)
    }, 250)
  }

  function close() {
    setOpen(false)
    setQuery('')
    setResults([])
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#D9E1E8] text-[#7A8F79] hover:border-[#7A8F79] hover:text-[#2F3E4E] transition"
      >
        🔍 Look up CARC/RARC code
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16" onClick={close}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[75vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[#D9E1E8]">
              <p className="text-sm font-bold uppercase tracking-widest text-[#2F3E4E] mb-2">Claim Adjustment Reason Code Lookup</p>
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => handleChange(e.target.value)}
                placeholder="Search by code (e.g. 45) or description…"
                className="w-full border border-[#D9E1E8] p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7A8F79]"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {loading && <p className="text-sm text-[#7A8F79] italic p-4">Searching…</p>}
              {!loading && query.trim() && results.length === 0 && (
                <p className="text-sm text-[#7A8F79] italic p-4">No matching codes.</p>
              )}
              {!loading && !query.trim() && (
                <p className="text-sm text-[#7A8F79] italic p-4">Start typing a code or keyword.</p>
              )}
              {results.map(c => (
                <div key={c.id} className="p-3 border-b border-[#F4F6F5] last:border-b-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono font-bold text-sm text-[#2F3E4E]">{c.code}</span>
                    {!c.active && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Deactivated</span>
                    )}
                  </div>
                  <p className="text-xs text-[#2F3E4E] leading-relaxed">{c.description}</p>
                  {c.notes && <p className="text-[10px] text-[#7A8F79] mt-0.5">→ {c.notes}</p>}
                </div>
              ))}
            </div>
            {showAdminTools && (
              <div className="p-3 border-t border-[#D9E1E8] bg-[#F4F6F5]">
                <button onClick={copyFaqLink} className="w-full rounded-lg py-2 text-sm font-semibold text-white bg-[#2F3E4E] hover:bg-[#7A8F79] transition">
                  📄 Copy full code-list PDF link (for FAQ)
                </button>
                {copyMsg && <p className="text-[10px] text-[#7A8F79] mt-1 text-center">{copyMsg}</p>}
              </div>
            )}
            <div className="p-3 border-t border-[#D9E1E8]">
              <button onClick={close} className="w-full rounded-lg py-2 text-sm font-semibold border border-[#D9E1E8] text-[#7A8F79] hover:border-[#7A8F79]">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
