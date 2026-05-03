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
}

type EntryLike = {
  workDate: Date | string
  invoiceFeeAmt?: number | null
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
  if (!campaign.startDate && !campaign.weekCount) return true

  const ws = weekStart(entryDate)

  if (campaign.startDate) {
    const campaignStart = weekStart(new Date(campaign.startDate))
    if (ws < campaignStart) return false

    if (campaign.weekCount != null) {
      const campaignEnd = new Date(campaignStart)
      campaignEnd.setUTCDate(campaignEnd.getUTCDate() + campaign.weekCount * 7)
      if (ws >= campaignEnd) return false
    }
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

    if (!isInCampaignWindow(campaign, date)) {
      campaignTotal += standardFee
      const endOfWeek = new Date(date)
      endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 6)
      weekBreakdown.push({
        weekLabel: fmtWeek(date, endOfWeek),
        standardFee,
        campaignFee: standardFee,
        saving: 0,
      })
      continue
    }

    const campaignFeeRaw = wEntries.length * flatAmt
    const campaignFee = Math.min(campaignFeeRaw, weekMax)
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
    if (isInCampaignWindow(campaign, new Date(e.workDate))) {
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
  if (!campaign.startDate && !campaign.weekCount) return 'Indefinite'
  const start = campaign.startDate
    ? new Date(campaign.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : 'Immediately'
  if (!campaign.weekCount) return `Starting ${start}`
  return `${campaign.weekCount} week${campaign.weekCount === 1 ? '' : 's'} from ${start}`
}
