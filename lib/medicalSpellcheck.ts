// Client-only Hunspell-style spellchecker (lib/medicalSpellcheck.ts) wrapping
// typo-js. Lazy-loads the library and the bundled base English dictionary
// (public/dictionaries/en/ — see SOURCE.md for provenance/license) only when
// a check actually runs, not on page load. The medical/clinical vocabulary
// that base dictionary doesn't know lives in the SpellcheckTerm table and is
// passed in by the caller (lib/spellcheckClient.ts) as `customTerms`.

import type Typo from 'typo-js'

let typoPromise: Promise<Typo> | null = null

async function getTypo() {
  if (!typoPromise) {
    typoPromise = (async () => {
      const [{ default: Typo }, aff, dic] = await Promise.all([
        import('typo-js'),
        fetch('/dictionaries/en/index.aff').then(r => r.text()),
        fetch('/dictionaries/en/index.dic').then(r => r.text()),
      ])
      return new Typo('en_US', aff, dic)
    })()
  }
  return typoPromise
}

// Hyphens are treated as word breaks (not joined into the token) so a
// hyphenated compound like "G-Tube" or "Passy-Muir" is checked as two plain
// words — this matches how the seed dictionary itself was tokenized (single
// words, no hyphens) rather than depending on typo-js's own hyphen-splitting
// behavior. Apostrophes stay joined so contractions ("don't") check as one word.
const WORD_RE = /[A-Za-z]+(?:'[A-Za-z]+)*/g

export type SpellcheckFlag = {
  word: string
  suggestions: string[]
}

// Tokenizes `text`, skips anything in `customTerms` (case-insensitive) or
// already recognized by the base dictionary, and returns one flag per
// distinct unrecognized word with typo-js's suggestions.
export async function checkText(text: string, customTerms: Set<string>): Promise<SpellcheckFlag[]> {
  const typo = await getTypo()
  const words = text.match(WORD_RE) || []

  const flagged = new Map<string, SpellcheckFlag>()
  for (const word of words) {
    if (word.length < 2) continue
    const key = word.toLowerCase()
    if (flagged.has(key) || customTerms.has(key)) continue
    if (typo.check(word)) continue
    flagged.set(key, { word, suggestions: typo.suggest(word, 5) })
  }

  return [...flagged.values()]
}
