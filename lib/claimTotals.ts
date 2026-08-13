// Shared "which claims count toward a financial total" rule for Claim
// (commercial) records — used everywhere a page/route sums totalBilled,
// totalReimbursed, remainingBalance, etc. across a nurse's or the whole
// org's claims.
//
// A claim can be superseded two different ways, both recorded via the same
// `resubmissionOf` string field pointing at the superseded claim's `claimId`:
//   - a genuine resubmission (a corrected/resubmitted claim for the same
//     work) — the superseded claim's amounts must be EXCLUDED from totals,
//     or the same billed/reimbursed dollars get counted twice.
//   - a void reversal (`voidReversalOf` set, holding the original's `id`) —
//     its `resubmissionOf` is set only so the UI can nest it under the claim
//     it reverses (see app/api/admin/claims/[id]/void/route.ts). The
//     original it reverses must NOT be excluded on that basis alone: the
//     reversal carries every dollar field negated, and the two only net to
//     zero when BOTH rows are summed together.
//
// Real data has a third pattern this rule has to get right: a voided claim
// that then gets genuinely resubmitted (its void-reversal row is itself the
// target of a later, non-void resubmissionOf). If only the reversal were
// excluded there, the original's positive amount would be left standing with
// no offsetting negative — so excluding a void-reversal row must also
// exclude the original it reversed, propagating through the pair.
export type ClaimLike = {
  id: string
  claimId: string | null
  resubmissionOf: string | null
  voidReversalOf: string | null // holds the reversed claim's `id`, not `claimId`
}

export function excludedClaimIds<T extends ClaimLike>(claims: T[]): Set<string> {
  const excluded = new Set<string>()

  // Pass 1 — a claim is excluded once a later, genuine (non-void-reversal)
  // resubmission points at its claimId.
  for (const c of claims) {
    if (!c.resubmissionOf || c.voidReversalOf) continue
    const target = claims.find(t => t.claimId === c.resubmissionOf)
    if (target) excluded.add(target.id)
  }

  // Pass 2 — propagate exclusion across void-reversal pairs: if a reversal
  // row is itself excluded (superseded further), the original it reversed
  // must be excluded too, or its amount is left uncancelled. Iterate to a
  // fixpoint in case of nested void-then-resubmit-then-void chains.
  let changed = true
  while (changed) {
    changed = false
    for (const c of claims) {
      if (c.voidReversalOf && excluded.has(c.id) && !excluded.has(c.voidReversalOf)) {
        excluded.add(c.voidReversalOf)
        changed = true
      }
    }
  }

  return excluded
}

// Claims that should count toward a financial total.
export function activeClaims<T extends ClaimLike>(claims: T[]): T[] {
  const excluded = excludedClaimIds(claims)
  return claims.filter(c => !excluded.has(c.id))
}

export function sumActiveClaimField<T extends ClaimLike>(claims: T[], field: (c: T) => number | null | undefined): number {
  return activeClaims(claims).reduce((s, c) => s + (field(c) ?? 0), 0)
}
