/**
 * Campaign discount calculation utilities.
 *
 * Week boundaries: Mon 00:00 UTC → Sun 23:59 UTC.
 * weekCount bound: only entries whose Mon-week falls within
 *   [campaign.startDate, startDate + weekCount * 7 days) are discounted.
 */

type CampaignLike = {
  type: string
  flatAmtPerDos?: number | null
  weeklyMaxAmt?: number | null
  percentOff?: number | null
  startDate?: Date | null
  weekCount?: number | null
  endDate?: Date | null
  appliesFeePlans?: string[] | null
}

type EntryLike = {
  workDate: Date | string
  invoiceFeeAmt?: number | null
  invoiceFeePlan?: string | null
}

/** Empty/missing appliesFeePlans = every fee plan (pre-existing behavior). */
function appliesToFeePlan(campaign: CampaignLike, entry: EntryLike): boolean {
  if (!campaign.appliesFeePlans || campaign.appliesFeePlans.length === 0) return true
  return !!entry.invoiceFeePlan && campaign.appliesFeePlans.includes(entry.invoiceFeePlan)
}

/** Combined eligibility — date window AND (if scoped) fee-plan match. */
function isCampaignEligible(campaign: CampaignLike, entry: EntryLike): boolean {
  return isInCampaignWindow(campaign, new Date(entry.workDate)) && appliesToFeePlan(campaign, entry)
}

/** Returns the Monday (UTC midnight) of the week containing the given date. */
function weekStart(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay() // 0=Sun,1=Mon,...,6=Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

/** True if the entry's week falls within the campaign's valid date window. */
function isInCampaignWindow(campaign: CampaignLike, entryDate: Date): boolean {
  if (!campaign.startDate && !campaign.weekCount && !campaign.endDate) return true

  const ws = weekStart(entryDate)

  if (campaign.startDate) {
    const campaignStart = weekStart(new Date(campaign.startDate))
    if (ws < campaignStart) return false

    if (campaign.endDate) {
      // Exact day-precision cutoff — the entry's actual date must be on or
      // before the stop date, not just its Monday-starting week. Takes
      // priority over weekCount when both are somehow set.
      if (entryDate > new Date(campaign.endDate)) return false
    } else if (campaign.weekCount != null) {
      const campaignEnd = new Date(campaignStart)
      campaignEnd.setUTCDate(campaignEnd.getUTCDate() + campaign.weekCount * 7)
      if (ws >= campaignEnd) return false
    }
  } else if (campaign.endDate) {
    // endDate with no startDate — open-ended start, hard stop.
    if (entryDate > new Date(campaign.endDate)) return false
  }

  return true
}

export type DiscountResult = {
  grossAmount: number
  discountAmt: number
  totalAmount: number
  weekBreakdown: { weekLabel: string; standardFee: number; campaignFee: number; saving: number }[]
}

export function calcCampaignDiscount(
  campaign: CampaignLike,
  entries: EntryLike[],
): DiscountResult {
  const grossAmount = entries.reduce((s, e) => s + (e.invoiceFeeAmt ?? 0), 0)

  if (campaign.type === 'flat_per_dos') {
    return calcFlatPerDos(campaign, entries, grossAmount)
  }

  if (campaign.type === 'percent_off') {
    return calcPercentOff(campaign, entries, grossAmount)
  }

  return { grossAmount, discountAmt: 0, totalAmount: grossAmount, weekBreakdown: [] }
}

function calcFlatPerDos(campaign: CampaignLike, entries: EntryLike[], grossAmount: number): DiscountResult {
  const flatAmt = campaign.flatAmtPerDos ?? 0
  const weekMax = campaign.weeklyMaxAmt ?? Infinity

  // Group entries by Mon week
  const weeks = new Map<string, { date: Date; entries: EntryLike[] }>()
  for (const e of entries) {
    const d = new Date(e.workDate)
    const ws = weekStart(d)
    const key = ws.toISOString()
    if (!weeks.has(key)) weeks.set(key, { date: ws, entries: [] })
    weeks.get(key)!.entries.push(e)
  }

  let campaignTotal = 0
  const weekBreakdown: DiscountResult['weekBreakdown'] = []

  for (const [, { date, entries: wEntries }] of weeks) {
    const standardFee = wEntries.reduce((s, e) => s + (e.invoiceFeeAmt ?? 0), 0)

    // Entries outside the campaign's date window OR (if scoped) fee-plan
    // list still bill at their normal fee — only the eligible subset gets
    // the flat per-DOS rate, and only that subset counts toward the weekly cap.
    const eligible = wEntries.filter(e => isCampaignEligible(campaign, e))
    const ineligibleFee = wEntries
      .filter(e => !isCampaignEligible(campaign, e))
      .reduce((s, e) => s + (e.invoiceFeeAmt ?? 0), 0)

    const campaignFeeRaw = eligible.length * flatAmt
    const campaignFee = ineligibleFee + Math.min(campaignFeeRaw, weekMax)
    campaignTotal += campaignFee

    const endOfWeek = new Date(date)
    endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 6)
    weekBreakdown.push({
      weekLabel: fmtWeek(date, endOfWeek),
      standardFee,
      campaignFee,
      saving: standardFee - campaignFee,
    })
  }

  const discountAmt = Math.max(0, grossAmount - campaignTotal)
  return { grossAmount, discountAmt, totalAmount: grossAmount - discountAmt, weekBreakdown }
}

function calcPercentOff(campaign: CampaignLike, entries: EntryLike[], grossAmount: number): DiscountResult {
  const pct = campaign.percentOff ?? 0

  // Only apply to entries within the campaign window
  let eligibleGross = 0
  for (const e of entries) {
    if (isCampaignEligible(campaign, e)) {
      eligibleGross += e.invoiceFeeAmt ?? 0
    }
  }

  const discountAmt = Math.round(eligibleGross * (pct / 100) * 100) / 100
  return {
    grossAmount,
    discountAmt,
    totalAmount: grossAmount - discountAmt,
    weekBreakdown: [],
  }
}

function fmtWeek(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`
}

/** Describe a campaign's rules in plain English (for UI labels). */
export function campaignRuleLabel(campaign: CampaignLike): string {
  if (campaign.type === 'flat_per_dos') {
    const base = `$${campaign.flatAmtPerDos?.toFixed(2)} per date of service`
    const cap = campaign.weeklyMaxAmt ? `, max $${campaign.weeklyMaxAmt?.toFixed(2)}/week` : ''
    return base + cap
  }
  if (campaign.type === 'percent_off') {
    return `${campaign.percentOff}% off`
  }
  return campaign.type
}

/** Describe campaign date window in plain English. */
export function campaignWindowLabel(campaign: CampaignLike): string {
  if (!campaign.startDate && !campaign.weekCount && !campaign.endDate) return 'Indefinite'
  const fmt = (d: Date | string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  const start = campaign.startDate ? fmt(campaign.startDate) : 'Immediately'
  if (campaign.endDate) return `${start} – ${fmt(campaign.endDate)}`
  if (!campaign.weekCount) return `Starting ${start}`
  return `${campaign.weekCount} week${campaign.weekCount === 1 ? '' : 's'} from ${start}`
}
