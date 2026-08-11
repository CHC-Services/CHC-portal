const MEDLINEPLUS_CONNECT_URL = 'https://connect.medlineplus.gov/service'
const RXNORM_RXCUI_URL = 'https://rxnav.nlm.nih.gov/REST/rxcui.json'

export type DrugFacts = { title: string; summary: string; url: string }

// MedlinePlus summaries come back as government-sourced HTML (headers, lists,
// links) — stripped to plain text rather than rendered raw, so we're never
// injecting third-party markup into the page.
function stripHtml(html: string): string {
  return html
    .replace(/<li>/gi, '\n• ')
    .replace(/<\/(p|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Resolves a free-typed medication name to an RxCUI when one wasn't captured
// at save time (legacy entries, or names typed without picking a suggestion).
// Exact match only — no fuzzy matching, so this either finds the right drug or nothing.
export async function resolveRxcuiByName(name: string): Promise<string | null> {
  try {
    const res = await fetch(`${RXNORM_RXCUI_URL}?name=${encodeURIComponent(name)}`)
    const data = await res.json().catch(() => null)
    const id = data?.idGroup?.rxnormId?.[0]
    return typeof id === 'string' ? id : null
  } catch {
    return null
  }
}

export async function getDrugFacts(rxcui: string): Promise<DrugFacts | null> {
  try {
    const params = new URLSearchParams({
      'mainSearchCriteria.v.cs': '2.16.840.1.113883.6.88', // RxNorm coding system OID
      'mainSearchCriteria.v.c': rxcui,
      knowledgeResponseType: 'application/json',
    })
    const res = await fetch(`${MEDLINEPLUS_CONNECT_URL}?${params.toString()}`)
    const data = await res.json().catch(() => null)
    const entry = data?.feed?.entry?.[0]
    const title = entry?.title?._value
    const url = entry?.link?.[0]?.href
    const rawSummary = entry?.summary?._value
    if (!title || !rawSummary || typeof url !== 'string' || !url.startsWith('https://medlineplus.gov/')) return null
    return { title, summary: stripHtml(rawSummary), url }
  } catch {
    return null
  }
}
