'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Term = {
  id: string
  term: string
  addedByUserId: string | null
  createdAt: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SpellcheckTermsPage() {
  const [terms, setTerms] = useState<Term[]>([])
  const [loaded, setLoaded] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function load() {
    fetch('/api/admin/spellcheck-terms', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setTerms(d.terms || []); setLoaded(true) })
  }

  useEffect(() => { load() }, [])

  async function remove(id: string) {
    setDeletingId(id)
    await fetch(`/api/admin/spellcheck-terms/${id}`, { method: 'DELETE', credentials: 'include' })
    setDeletingId(null)
    load()
  }

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">

      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin/system" className="text-sm text-[#7A8F79] hover:text-[#2F3E4E] transition">⚙ System</Link>
        <span className="text-[#7A8F79] text-sm">/</span>
        <span className="text-sm text-[#2F3E4E] font-semibold">Dictionary Terms</span>
      </div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">Dictionary Terms</h1>
        <p className="text-sm text-[#7A8F79] mt-1">
          Terms nurses have added to the medical spellcheck dictionary via &quot;Add to Dictionary&quot;.
          The bulk seed dictionary (drug names, clinical vocabulary) isn&apos;t shown here — only
          entries added this way, which are the ones worth reviewing.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden max-w-2xl">
        <div className="px-5 py-3 border-b border-[#D9E1E8]">
          <p className="text-xs font-semibold text-[#7A8F79] uppercase tracking-wide">
            {loaded ? `${terms.length} term${terms.length !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {!loaded ? (
              <tr><td className="px-5 py-10 text-center text-sm text-[#7A8F79]">Loading…</td></tr>
            ) : terms.length === 0 ? (
              <tr><td className="px-5 py-10 text-center text-sm text-[#7A8F79] italic">No nurse-added terms yet.</td></tr>
            ) : terms.map((t, i) => (
              <tr key={t.id} className={`border-b border-[#D9E1E8] ${i % 2 === 0 ? '' : 'bg-[#fafbfc]'}`}>
                <td className="px-5 py-2.5 text-[#2F3E4E] font-mono">{t.term}</td>
                <td className="px-5 py-2.5 text-xs text-[#7A8F79] whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                <td className="px-5 py-2.5 text-right">
                  <button
                    onClick={() => remove(t.id)}
                    disabled={deletingId === t.id}
                    className="text-[11px] text-red-400 hover:text-red-600 font-semibold transition disabled:opacity-40"
                  >
                    {deletingId === t.id ? '…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
