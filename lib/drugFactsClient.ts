// Client-side fetch wrapper for /api/drugs/facts — kept out of MedicationList.tsx
// itself, which is a portable no-API-calls component; pages pass this in as a prop.
import type { DrugFactsResult } from '../app/components/MedicationList'

export async function fetchDrugFacts(med: { rxcui: string | null; medicationName: string }): Promise<DrugFactsResult> {
  try {
    const q = med.rxcui ? `rxcui=${encodeURIComponent(med.rxcui)}` : `name=${encodeURIComponent(med.medicationName)}`
    const res = await fetch(`/api/drugs/facts?${q}`, { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    return data.facts || null
  } catch {
    return null
  }
}
