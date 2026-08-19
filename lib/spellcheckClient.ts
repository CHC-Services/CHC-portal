// Fetch/cache wiring for the custom medical-term dictionary — kept separate
// from lib/medicalSpellcheck.ts (the portable engine) and app/components/
// SpellCheckButton.tsx (the portable UI), same split used for drug-name
// search (lib/drugSearchClient.ts + MedicationList.tsx).

const CACHE_KEY = 'spellcheckCustomTerms'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h — thousands of terms, staleness is harmless

type CacheEntry = { terms: string[]; cachedAt: number }

export async function loadCustomTerms(): Promise<Set<string>> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const cached: CacheEntry = JSON.parse(raw)
      if (Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return new Set(cached.terms)
      }
    }
  } catch {
    // corrupt cache — fall through to a fresh fetch
  }

  const res = await fetch('/api/spellcheck/terms', { credentials: 'include' })
  if (!res.ok) return new Set()
  const data = await res.json()
  const terms: string[] = Array.isArray(data.terms) ? data.terms : []

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ terms, cachedAt: Date.now() } satisfies CacheEntry))
  } catch {
    // storage full/unavailable — not fatal, just skip caching
  }

  return new Set(terms)
}

// "Add to Dictionary" — posts the term, then patches the local cache so the
// word stops being flagged immediately without waiting for the 24h TTL.
export async function addCustomTerm(term: string): Promise<boolean> {
  const res = await fetch('/api/spellcheck/terms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ term }),
  })
  if (!res.ok) return false

  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const cached: CacheEntry = raw ? JSON.parse(raw) : { terms: [], cachedAt: Date.now() }
    const key = term.trim().toLowerCase()
    if (!cached.terms.includes(key)) cached.terms.push(key)
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached))
  } catch {
    // non-fatal — next full reload will pick it up from the server anyway
  }

  return true
}
