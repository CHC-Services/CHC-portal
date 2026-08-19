# Base English Dictionary Source

`index.aff` / `index.dic` copied from the npm package `dictionary-en` v4.0.0
(https://github.com/wooorm/dictionaries/tree/main/dictionaries/en), license
`(MIT AND BSD)`. That package repackages the en_US Hunspell dictionary
derived from SCOWL (http://wordlist.sourceforge.net), version 2020.12.07.

Loaded client-side by `lib/medicalSpellcheck.ts` via `typo-js`. Not re-copied
automatically — this is a rarely-changing base dictionary; bump manually by
re-running the copy from a newer `dictionary-en` install if ever needed.

Supplemental medical/clinical vocabulary lives in the `SpellcheckTerm`
database table (see `prisma/schema.prisma`), not in these files.
