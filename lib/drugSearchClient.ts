// Client-side fetch wrapper for /api/drugs/search — kept out of MedicationList.tsx
// itself, which is a portable no-API-calls component; pages pass this in as a prop.
import type { DrugNameOption } from '../app/components/MedicationList'

export type DrugSearchResult = { exact: DrugNameOption[]; suggested: DrugNameOption[] }

export async function searchDrugNames(q: string): Promise<DrugSearchResult> {
  try {
    const res = await fetch(`/api/drugs/search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
    if (!res.ok) return { exact: [], suggested: [] }
    const data = await res.json()
    return {
      exact: Array.isArray(data.exact) ? data.exact : [],
      suggested: Array.isArray(data.suggested) ? data.suggested : [],
    }
  } catch {
    return { exact: [], suggested: [] }
  }
}
