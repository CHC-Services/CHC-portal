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

export type DrugNameResult = { name: string; rxcui: string | null }

export async function searchLocalDrugNames(q: string): Promise<DrugNameResult[]> {
  const rows = await (prisma.drugName.findMany as any)({
    where: { displayName: { startsWith: q, mode: 'insensitive' } },
    take: 8,
    orderBy: { displayName: 'asc' },
  })
  return rows.map((r: { displayName: string; rxcui: string | null }) => ({ name: r.displayName, rxcui: r.rxcui }))
}

export async function searchLiveDrugNames(q: string): Promise<DrugNameResult[]> {
  try {
    const res = await fetch(`${RXTERMS_SEARCH_URL}?terms=${encodeURIComponent(q)}&maxList=8&ef=RXCUIS`)
    const data = await res.json().catch(() => null)
    const rawNames: string[] = Array.isArray(data?.[1]) ? data[1] : []
    const rxcuis: string[][] = Array.isArray(data?.[2]?.RXCUIS) ? data[2].RXCUIS : []
    const seen = new Set<string>()
    const results: DrugNameResult[] = []
    rawNames.forEach((raw, i) => {
      const name = normalizeDrugName(raw)
      if (!name || seen.has(name)) return
      seen.add(name)
      results.push({ name, rxcui: rxcuis[i]?.[0] || null })
    })
    return results.slice(0, 8)
  } catch {
    return []
  }
}

// Last-resort typo fallback — only used when local + live-exact both come up empty.
export async function searchApproximateDrugNames(q: string): Promise<DrugNameResult[]> {
  try {
    const res = await fetch(`${RXNORM_APPROX_URL}?term=${encodeURIComponent(q)}&maxEntries=5`)
    const data = await res.json().catch(() => null)
    const candidates: { name?: string; rxcui?: string }[] = data?.approximateGroup?.candidate || []
    const seen = new Set<string>()
    const results: DrugNameResult[] = []
    for (const c of candidates) {
      const name = c.name?.trim()
      if (!name || seen.has(name)) continue
      seen.add(name)
      results.push({ name, rxcui: c.rxcui || null })
    }
    return results.slice(0, 5)
  } catch {
    return []
  }
}

// Fire-and-forget — caching is a nice-to-have, never block the search response on it.
export async function cacheDrugNames(results: DrugNameResult[]): Promise<void> {
  if (results.length === 0) return
  try {
    await (prisma.drugName.createMany as any)({
      data: results.map(r => ({ displayName: r.name, rxcui: r.rxcui })),
      skipDuplicates: true,
    })
  } catch {
    // ignore — worst case, this name gets looked up live again next time
  }
}
