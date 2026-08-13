import { prisma } from './prisma'
import { isMedicaidPayerName } from './medicaidPayCycle'
import { activeClaims } from './claimTotals'

// Shared financial aggregation for admin income reports and nurse tax
// reports. Claim is the single source of truth for claim income (Medicaid +
// Commercial) — MedicaidClaim is legacy/excluded, see prisma/schema.prisma's
// AdminReport comment and the 2026-08-12 data-cleanup session. A claim's void
// pattern in this codebase is a paired negative "-VOID" row that nets the
// original to zero, not a flag to filter on — so aggregateClaimIncome sums
// every void-paired row, voided or not, rather than excluding voidedAt. It
// does exclude claims superseded by a genuine resubmission though (via
// lib/claimTotals.ts's activeClaims) — otherwise a corrected/resubmitted
// claim that both sides recorded totalReimbursed on double-counts real
// reimbursed income.

export function getQuarter(monthIndex1: number): number {
  return Math.ceil(monthIndex1 / 3)
}

export type PeriodBucket = { medicaid: number; commercial: number; count: number }
function emptyBucket(): PeriodBucket {
  return { medicaid: 0, commercial: 0, count: 0 }
}

export type ClaimIncomeResult = {
  monthly: Record<number, PeriodBucket> // 1-12
  quarterly: Record<number, PeriodBucket> // 1-4
  total: PeriodBucket
  year: number
}

// Bucketed by when the money was actually received (primaryPaidDate, falling
// back to secondaryPaidDate, then dosStart for anything not yet paid — those
// contribute 0 either way since totalReimbursed is null/0 until paid).
export async function aggregateClaimIncome(opts: { nurseId?: string; year: number }): Promise<ClaimIncomeResult> {
  const { nurseId, year } = opts
  const allClaims = await (prisma.claim.findMany as any)({
    where: nurseId ? { nurseId } : {},
    select: {
      id: true,
      claimId: true,
      resubmissionOf: true,
      voidReversalOf: true,
      primaryPayer: true,
      secondaryPayer: true,
      primaryPaidDate: true,
      secondaryPaidDate: true,
      dosStart: true,
      totalReimbursed: true,
    },
  })
  const claims: any[] = activeClaims(allClaims as any[])

  const monthly: Record<number, PeriodBucket> = {}
  const quarterly: Record<number, PeriodBucket> = {}
  for (let m = 1; m <= 12; m++) monthly[m] = emptyBucket()
  for (let q = 1; q <= 4; q++) quarterly[q] = emptyBucket()
  const total = emptyBucket()

  for (const c of claims) {
    const bucketDate: Date | null = c.primaryPaidDate || c.secondaryPaidDate || c.dosStart
    if (!bucketDate) continue
    const d = new Date(bucketDate)
    if (d.getUTCFullYear() !== year) continue

    const amount = c.totalReimbursed ?? 0
    const isMedicaid = isMedicaidPayerName(c.primaryPayer) || isMedicaidPayerName(c.secondaryPayer)
    const month = d.getUTCMonth() + 1
    const quarter = getQuarter(month)

    for (const bucket of [monthly[month], quarterly[quarter], total]) {
      if (isMedicaid) bucket.medicaid += amount
      else bucket.commercial += amount
      bucket.count++
    }
  }

  return { monthly, quarterly, total, year }
}

export type InvoicePeriodBucket = { invoiced: number; collected: number; count: number }
function emptyInvoiceBucket(): InvoicePeriodBucket {
  return { invoiced: 0, collected: 0, count: 0 }
}

export type InvoiceIncomeResult = {
  monthly: Record<number, InvoicePeriodBucket>
  quarterly: Record<number, InvoicePeriodBucket>
  yearTotal: InvoicePeriodBucket
  year: number
}

// Extends the bucketing already trusted by app/api/admin/invoicing's
// ?view=income branch (same fields, same local-time .getMonth() bucketing —
// kept identical on purpose so this never silently disagrees with that
// existing, already-relied-on view) and adds quarterly buckets alongside it.
export async function aggregateInvoiceIncome(opts: { year: number }): Promise<InvoiceIncomeResult> {
  const { year } = opts
  const [invoices, payments] = await Promise.all([
    (prisma.invoice.findMany as any)({
      where: { sentAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59Z`) } },
      select: { sentAt: true, totalAmount: true },
    }),
    (prisma.payment.findMany as any)({
      where: { appliedAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59Z`) } },
      select: { appliedAt: true, amount: true },
    }),
  ])

  const monthly: Record<number, InvoicePeriodBucket> = {}
  const quarterly: Record<number, InvoicePeriodBucket> = {}
  for (let m = 1; m <= 12; m++) monthly[m] = emptyInvoiceBucket()
  for (let q = 1; q <= 4; q++) quarterly[q] = emptyInvoiceBucket()

  for (const inv of invoices) {
    const m = new Date(inv.sentAt).getMonth() + 1
    const q = getQuarter(m)
    monthly[m].invoiced += inv.totalAmount
    monthly[m].count++
    quarterly[q].invoiced += inv.totalAmount
    quarterly[q].count++
  }
  for (const p of payments) {
    const m = new Date(p.appliedAt).getMonth() + 1
    const q = getQuarter(m)
    monthly[m].collected += p.amount
    quarterly[q].collected += p.amount
  }

  const yearTotal = Object.values(monthly).reduce(
    (s, m) => ({ invoiced: s.invoiced + m.invoiced, collected: s.collected + m.collected, count: s.count + m.count }),
    emptyInvoiceBucket()
  )

  return { monthly, quarterly, yearTotal, year }
}

export type ReceivablesResult = { outstanding: number; count: number; asOf: string }

// Accounts Receivable — Outstanding: invoices sent but not yet fully paid, as
// of the moment the report runs. A snapshot, not bound to the reporting
// period (an unpaid invoice from Q1 is still outstanding when you run a Q3
// report). Deliberately NOT labeled a "liability" — see prisma schema notes.
export async function aggregateReceivables(): Promise<ReceivablesResult> {
  const invoices = await (prisma.invoice.findMany as any)({
    where: { status: { not: 'Paid' } },
    select: { totalAmount: true, paidAmount: true },
  })
  const outstanding = invoices.reduce((sum: number, inv: any) => sum + Math.max(0, inv.totalAmount - (inv.paidAmount ?? 0)), 0)
  return { outstanding, count: invoices.length, asOf: new Date().toISOString() }
}

export type DiscountExpenseResult = { total: number; count: number; year: number }

// Prompt-pay and service-date discounts, both captured in Invoice.discountAmt
// — categorized as Marketing / Promotional Discount expense.
export async function aggregateDiscountExpense(opts: { year: number }): Promise<DiscountExpenseResult> {
  const { year } = opts
  const invoices = await (prisma.invoice.findMany as any)({
    where: {
      sentAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59Z`) },
      discountAmt: { gt: 0 },
    },
    select: { discountAmt: true },
  })
  const total = invoices.reduce((sum: number, inv: any) => sum + inv.discountAmt, 0)
  return { total, count: invoices.length, year }
}

export type NurseExpenseResult = { totalPaid: number; count: number; year: number }

// A nurse's own paid platform-subscription invoices — their deductible
// business expense line on the nurse-facing tax report.
export async function aggregateNurseInvoiceExpense(opts: { nurseId: string; year: number }): Promise<NurseExpenseResult> {
  const { nurseId, year } = opts
  const invoices = await (prisma.invoice.findMany as any)({
    where: { nurseId, sentAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59Z`) } },
    select: { paidAmount: true },
  })
  const totalPaid = invoices.reduce((sum: number, inv: any) => sum + (inv.paidAmount ?? 0), 0)
  return { totalPaid, count: invoices.length, year }
}
