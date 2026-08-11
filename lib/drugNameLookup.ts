import { prisma } from './prisma'

const RXTERMS_SEARCH_URL = 'https://clinicaltables.nlm.nih.gov/api/rxterms/v1/search'
const RXNORM_APPROX_URL = 'https://rxnav.nlm.nih.gov/REST/approximateTerm.json'

function titleCase(s: string): string {
  return s.toLowerCase().replace(/[a-z]+/g, w => w.charAt(0).toUpperCase() + w.slice(1))
}

// RxTerms' DISPLAY_NAME renders brand names in ALL CAPS ("TYLENOL") and generic
// names in mixed case with inline "tall man" letters ("Acetaminophen/traMADol")
// — neither matches our convention directly, so normalize explicitly: brand
// (all-caps source) -> Title Case, generic (anything else) -> all lowercase.
function normalizeDrugName(raw: string): string {
  const stripped = raw.replace(/\s*\([^)]*\)\s*$/, '').trim()
  const letters = stripped.replace(/[^A-Za-z]/g, '')
  const isBrand = letters.length > 0 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()
  return isBrand ? titleCase(stripped) : stripped.toLowerCase()
}

function dedupe(names: string[]): string[] {
  return [...new Set(names.filter(Boolean))]
}

export async function searchLocalDrugNames(q: string): Promise<string[]> {
  const rows = await (prisma.drugName.findMany as any)({
    where: { displayName: { startsWith: q, mode: 'insensitive' } },
    take: 8,
    orderBy: { displayName: 'asc' },
  })
  return rows.map((r: { displayName: string }) => r.displayName)
}

export async function searchLiveDrugNames(q: string): Promise<string[]> {
  try {
    const res = await fetch(`${RXTERMS_SEARCH_URL}?terms=${encodeURIComponent(q)}&maxList=8`)
    const data = await res.json().catch(() => null)
    const rawNames: string[] = Array.isArray(data?.[1]) ? data[1] : []
    return dedupe(rawNames.map(normalizeDrugName)).slice(0, 8)
  } catch {
    return []
  }
}

// Last-resort typo fallback — only used when local + live-exact both come up empty.
export async function searchApproximateDrugNames(q: string): Promise<string[]> {
  try {
    const res = await fetch(`${RXNORM_APPROX_URL}?term=${encodeURIComponent(q)}&maxEntries=5`)
    const data = await res.json().catch(() => null)
    const candidates: { name?: string }[] = data?.approximateGroup?.candidate || []
    const names = candidates.map(c => c.name).filter((n): n is string => !!n).map(n => n.trim())
    return dedupe(names).slice(0, 5)
  } catch {
    return []
  }
}

// Fire-and-forget — caching is a nice-to-have, never block the search response on it.
export async function cacheDrugNames(names: string[]): Promise<void> {
  if (names.length === 0) return
  try {
    await (prisma.drugName.createMany as any)({
      data: names.map(displayName => ({ displayName })),
      skipDuplicates: true,
    })
  } catch {
    // ignore — worst case, this name gets looked up live again next time
  }
}
