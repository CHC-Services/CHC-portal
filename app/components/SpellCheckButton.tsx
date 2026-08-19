'use client'

import { useState } from 'react'

export type SpellcheckFlag = {
  word: string
  suggestions: string[]
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Portable UI — no API calls of its own. The caller wires the actual
// dictionary fetch/check/add-term logic in via props (same pattern
// MedicationList.tsx uses for onSearchDrugNames).
export default function SpellCheckButton({
  text, onReplace, onCheck, onAddToDictionary,
}: {
  text: string
  onReplace: (newText: string) => void
  onCheck: (text: string) => Promise<SpellcheckFlag[]>
  onAddToDictionary: (term: string) => Promise<boolean>
}) {
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)
  const [flags, setFlags] = useState<SpellcheckFlag[]>([])
  const [adding, setAdding] = useState<string | null>(null)

  async function runCheck() {
    setChecking(true)
    const result = await onCheck(text)
    setFlags(result)
    setChecked(true)
    setChecking(false)
  }

  function replaceWith(flag: SpellcheckFlag, suggestion: string) {
    const re = new RegExp(`\\b${escapeRegExp(flag.word)}\\b`, 'g')
    onReplace(text.replace(re, suggestion))
    setFlags(fs => fs.filter(f => f.word !== flag.word))
  }

  async function addToDictionary(flag: SpellcheckFlag) {
    setAdding(flag.word)
    const ok = await onAddToDictionary(flag.word.toLowerCase())
    setAdding(null)
    if (ok) setFlags(fs => fs.filter(f => f.word !== flag.word))
  }

  return (
    <div className="mt-2 space-y-2">
      <button
        type="button"
        onClick={runCheck}
        disabled={checking || !text.trim()}
        className="text-xs font-semibold text-[#7A8F79] hover:text-[#2F3E4E] transition disabled:opacity-40"
      >
        {checking ? 'Checking…' : 'Check Spelling'}
      </button>

      {checked && flags.length === 0 && (
        <p className="text-xs text-green-600">No issues found.</p>
      )}

      {flags.length > 0 && (
        <div className="bg-[#F4F6F5] rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A8F79]">
            Flagged ({flags.length})
          </p>
          {flags.map(flag => (
            <div key={flag.word} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-[#2F3E4E]">&quot;{flag.word}&quot;</span>
              {flag.suggestions.length === 0 ? (
                <span className="text-[#7A8F79] italic">no suggestions</span>
              ) : (
                flag.suggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => replaceWith(flag, s)}
                    className="px-2 py-0.5 rounded-full border border-[#D9E1E8] bg-white text-[#2F3E4E] hover:border-[#7A8F79] transition"
                  >
                    {s}
                  </button>
                ))
              )}
              <button
                type="button"
                onClick={() => addToDictionary(flag)}
                disabled={adding === flag.word}
                className="text-[#7A8F79] hover:text-[#2F3E4E] transition underline disabled:opacity-40"
              >
                {adding === flag.word ? 'Adding…' : 'Add to Dictionary'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
