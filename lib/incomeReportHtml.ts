import { loadLogoBase64 } from './agreementDocument'

// Shared landscape-report chrome (header/footer/table styles) for every
// generated financial report — admin income report and nurse tax report both
// build on this so a single change keeps them visually consistent, the same
// way lib/invoiceHtml.ts is the one template for every invoice surface.

export const REPORT_CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 0;
    color: #2F3E4E;
    font-size: 11px;
  }
  .report-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .report-logo { height: 34px; width: auto; display: block; }
  .report-logo-fallback { font-weight: 700; font-size: 14px; color: #2F3E4E; }
  .report-summary {
    text-align: right;
    font-size: 13px;
    font-weight: 700;
    color: #2F3E4E;
    letter-spacing: 0.2px;
  }
  .report-title {
    font-size: 16px;
    font-weight: 700;
    color: #2F3E4E;
    margin: 0 0 12px;
  }
  .report-section {
    margin-bottom: 12px;
  }
  .report-section-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #7A8F79;
    border-bottom: 1px solid #D9E1E8;
    padding-bottom: 3px;
    margin-bottom: 4px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    text-align: left;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #7A8F79;
    padding: 3px 8px;
    border-bottom: 1px solid #D9E1E8;
  }
  th.num, td.num { text-align: right; }
  td {
    padding: 3px 8px;
    font-size: 11px;
    border-bottom: 1px solid #F4F6F5;
  }
  tr.total-row td {
    font-weight: 700;
    border-top: 1.5px solid #2F3E4E;
    border-bottom: none;
  }
  .amt-pos { color: #1a202c; }
  .amt-neg { color: #c0392b; }
  .stat-row { display: flex; gap: 10px; margin-bottom: 12px; }
  .stat-tile {
    flex: 1;
    background: #F4F6F5;
    border-radius: 6px;
    padding: 8px 12px;
  }
  .stat-label { font-size: 9px; text-transform: uppercase; color: #7A8F79; letter-spacing: 0.3px; }
  .stat-value { font-size: 15px; font-weight: 700; margin-top: 2px; }
  .report-footer {
    margin-top: 14px;
    padding-top: 6px;
    border-top: 1px solid #D9E1E8;
    font-size: 9px;
    color: #7A8F79;
  }
`

export function fmtAmount(value: number, opts: { negative?: boolean } = {}): string {
  const abs = Math.abs(value)
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (opts.negative && abs > 0) {
    return `<span class="amt-neg">(${formatted})</span>`
  }
  return `<span class="amt-pos">${formatted}</span>`
}

export function reportHeaderHtml(summaryLabel: string): string {
  const logoBase64 = loadLogoBase64()
  const logo = logoBase64
    ? `<img class="report-logo" src="data:image/png;base64,${logoBase64}" alt="Coming Home Care" />`
    : `<div class="report-logo-fallback">Coming Home Care</div>`
  return `
    <div class="report-header">
      ${logo}
      <div class="report-summary">${summaryLabel}</div>
    </div>
  `
}

export function reportFooterHtml(reportName: string): string {
  const generated = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return `<div class="report-footer">${reportName} &middot; Generated ${generated}</div>`
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Builds the admin's own quarterly/annual income report — Invoiced/Collected
// (business revenue), Claim Income (Medicaid vs Commercial, money nurses were
// paid through claims billed via the service — informational context, not
// CHC's own revenue), Accounts Receivable, and Marketing/Promotional Discount
// Expense. `quarter` null means "full year"; MONTH_LABELS index is scoped to
// that quarter's 3 months when set.
export function buildAdminIncomeReportHtml(opts: {
  year: number
  quarter: number | null
  invoiceIncome: { monthly: Record<number, { invoiced: number; collected: number; count: number }>; quarterly: Record<number, { invoiced: number; collected: number; count: number }>; yearTotal: { invoiced: number; collected: number; count: number } }
  claimIncome: { monthly: Record<number, { medicaid: number; commercial: number; count: number }>; quarterly: Record<number, { medicaid: number; commercial: number; count: number }>; total: { medicaid: number; commercial: number; count: number } }
  receivables: { outstanding: number; count: number; asOf: string }
  discountExpense: { total: number; count: number }
}): string {
  const { year, quarter } = opts
  const periodLabel = quarter ? `Q${quarter} ${year}` : `${year}`
  const months = quarter ? [1, 2, 3].map(m => (quarter - 1) * 3 + m) : Array.from({ length: 12 }, (_, i) => i + 1)

  const invRows = months.map(m => {
    const row = opts.invoiceIncome.monthly[m]
    const uncollected = row.invoiced - row.collected
    return `<tr><td>${MONTH_LABELS[m - 1]}</td><td class="num">${fmtAmount(row.invoiced)}</td><td class="num">${fmtAmount(row.collected)}</td><td class="num">${fmtAmount(uncollected, { negative: uncollected > 0 })}</td></tr>`
  }).join('')
  const invTotal = quarter ? opts.invoiceIncome.quarterly[quarter] : opts.invoiceIncome.yearTotal
  const invUncollected = invTotal.invoiced - invTotal.collected

  const claimRows = months.map(m => {
    const row = opts.claimIncome.monthly[m]
    return `<tr><td>${MONTH_LABELS[m - 1]}</td><td class="num">${fmtAmount(row.medicaid)}</td><td class="num">${fmtAmount(row.commercial)}</td><td class="num">${fmtAmount(row.medicaid + row.commercial)}</td></tr>`
  }).join('')
  const claimTotal = quarter ? opts.claimIncome.quarterly[quarter] : opts.claimIncome.total

  const bodyHtml = `
    <div class="stat-row">
      <div class="stat-tile"><div class="stat-label">Invoiced (Business Revenue)</div><div class="stat-value">${fmtAmount(invTotal.invoiced)}</div></div>
      <div class="stat-tile"><div class="stat-label">Collected</div><div class="stat-value">${fmtAmount(invTotal.collected)}</div></div>
      <div class="stat-tile"><div class="stat-label">Accounts Receivable &mdash; Outstanding</div><div class="stat-value">${fmtAmount(opts.receivables.outstanding, { negative: opts.receivables.outstanding > 0 })}</div></div>
      <div class="stat-tile"><div class="stat-label">Marketing / Promo Discount Expense</div><div class="stat-value">${fmtAmount(opts.discountExpense.total, { negative: opts.discountExpense.total > 0 })}</div></div>
    </div>

    <div class="report-section">
      <p class="report-section-title">Business Revenue — Invoiced vs. Collected</p>
      <table>
        <thead><tr><th>Month</th><th class="num">Invoiced</th><th class="num">Collected</th><th class="num">Uncollected</th></tr></thead>
        <tbody>
          ${invRows}
          <tr class="total-row"><td>Total</td><td class="num">${fmtAmount(invTotal.invoiced)}</td><td class="num">${fmtAmount(invTotal.collected)}</td><td class="num">${fmtAmount(invUncollected, { negative: invUncollected > 0 })}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="report-section">
      <p class="report-section-title">Claim Income Billed Through Service (Medicaid vs. Commercial)</p>
      <table>
        <thead><tr><th>Month</th><th class="num">Medicaid</th><th class="num">Commercial</th><th class="num">Total</th></tr></thead>
        <tbody>
          ${claimRows}
          <tr class="total-row"><td>Total</td><td class="num">${fmtAmount(claimTotal.medicaid)}</td><td class="num">${fmtAmount(claimTotal.commercial)}</td><td class="num">${fmtAmount(claimTotal.medicaid + claimTotal.commercial)}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="report-section">
      <p class="report-section-title">Accounts Receivable — Outstanding (as of report date, not period-bound)</p>
      <table>
        <thead><tr><th>Open Invoices</th><th class="num">Amount Outstanding</th></tr></thead>
        <tbody>
          <tr><td>${opts.receivables.count} invoice(s) not yet fully paid</td><td class="num">${fmtAmount(opts.receivables.outstanding, { negative: opts.receivables.outstanding > 0 })}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="report-section">
      <p class="report-section-title">Marketing / Promotional Discount Expense</p>
      <table>
        <thead><tr><th>Discounted Invoices This Period</th><th class="num">Total Discount Given</th></tr></thead>
        <tbody>
          <tr><td>${opts.discountExpense.count} invoice(s) with a prompt-pay or service-date discount applied</td><td class="num">${fmtAmount(opts.discountExpense.total, { negative: opts.discountExpense.total > 0 })}</td></tr>
        </tbody>
      </table>
    </div>
  `

  return reportPageHtml({
    title: 'Business Income & Expense Report',
    summaryLabel: `${periodLabel} All Financial Data`,
    footerName: 'Business Income & Expense Report',
    bodyHtml,
  })
}

export type TaxReportFilterKey = 'all_claims' | 'medicaid' | 'commercial' | 'expenses' | 'all_financial'

export const TAX_REPORT_FILTERS: { key: TaxReportFilterKey; label: string }[] = [
  { key: 'all_claims', label: 'All Claim Data' },
  { key: 'medicaid', label: 'Medicaid' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'all_financial', label: 'All Financial Data' },
]

// The nurse/provider-facing year-end tax report — income they were paid via
// claims billed through the service, and their own deductible platform
// subscription cost. Filtered by TaxReportFilterKey, which controls both the
// on-screen view (page.tsx) and this exported PDF identically.
export function buildNurseTaxReportHtml(opts: {
  nurseName: string
  year: number
  quarter: number | null
  filterKey: TaxReportFilterKey
  claimIncome: { monthly: Record<number, { medicaid: number; commercial: number; count: number }>; quarterly: Record<number, { medicaid: number; commercial: number; count: number }>; total: { medicaid: number; commercial: number; count: number } }
  expense: { totalPaid: number; count: number }
}): string {
  const { year, quarter, filterKey } = opts
  const periodLabel = quarter ? `Q${quarter} ${year}` : `${year}`
  const filterLabel = TAX_REPORT_FILTERS.find(f => f.key === filterKey)?.label || 'All Financial Data'
  const months = quarter ? [1, 2, 3].map(m => (quarter - 1) * 3 + m) : Array.from({ length: 12 }, (_, i) => i + 1)
  const claimTotal = quarter ? opts.claimIncome.quarterly[quarter] : opts.claimIncome.total

  const showMedicaid = filterKey === 'all_claims' || filterKey === 'medicaid' || filterKey === 'all_financial'
  const showCommercial = filterKey === 'all_claims' || filterKey === 'commercial' || filterKey === 'all_financial'
  const showExpenses = filterKey === 'expenses' || filterKey === 'all_financial'
  const showClaimSection = showMedicaid || showCommercial

  const claimRows = months.map(m => {
    const row = opts.claimIncome.monthly[m]
    const cells = [`<td>${MONTH_LABELS[m - 1]}</td>`]
    if (showMedicaid) cells.push(`<td class="num">${fmtAmount(row.medicaid)}</td>`)
    if (showCommercial) cells.push(`<td class="num">${fmtAmount(row.commercial)}</td>`)
    if (showMedicaid && showCommercial) cells.push(`<td class="num">${fmtAmount(row.medicaid + row.commercial)}</td>`)
    return `<tr>${cells.join('')}</tr>`
  }).join('')

  const claimHeaderCells = ['<th>Month</th>']
  if (showMedicaid) claimHeaderCells.push('<th class="num">Medicaid</th>')
  if (showCommercial) claimHeaderCells.push('<th class="num">Commercial</th>')
  if (showMedicaid && showCommercial) claimHeaderCells.push('<th class="num">Total</th>')

  const claimTotalCells = ['<td>Total</td>']
  if (showMedicaid) claimTotalCells.push(`<td class="num">${fmtAmount(claimTotal.medicaid)}</td>`)
  if (showCommercial) claimTotalCells.push(`<td class="num">${fmtAmount(claimTotal.commercial)}</td>`)
  if (showMedicaid && showCommercial) claimTotalCells.push(`<td class="num">${fmtAmount(claimTotal.medicaid + claimTotal.commercial)}</td>`)

  const netIncome = claimTotal.medicaid + claimTotal.commercial - opts.expense.totalPaid

  const statTiles: string[] = []
  if (showClaimSection) statTiles.push(`<div class="stat-tile"><div class="stat-label">Total Claim Income</div><div class="stat-value">${fmtAmount(claimTotal.medicaid + claimTotal.commercial)}</div></div>`)
  if (showExpenses) statTiles.push(`<div class="stat-tile"><div class="stat-label">Platform / Billing Service Expense</div><div class="stat-value">${fmtAmount(opts.expense.totalPaid, { negative: opts.expense.totalPaid > 0 })}</div></div>`)
  if (filterKey === 'all_financial') statTiles.push(`<div class="stat-tile"><div class="stat-label">Net Income</div><div class="stat-value">${fmtAmount(netIncome, { negative: netIncome < 0 })}</div></div>`)

  const bodyHtml = `
    <p style="font-size:12px;color:#7A8F79;margin:-8px 0 12px;">${opts.nurseName}</p>
    <div class="stat-row">${statTiles.join('')}</div>

    ${showClaimSection ? `
    <div class="report-section">
      <p class="report-section-title">Income Billed Through Service</p>
      <table>
        <thead><tr>${claimHeaderCells.join('')}</tr></thead>
        <tbody>
          ${claimRows}
          <tr class="total-row">${claimTotalCells.join('')}</tr>
        </tbody>
      </table>
    </div>` : ''}

    ${showExpenses ? `
    <div class="report-section">
      <p class="report-section-title">Deductible Business Expense — Platform / Billing Service Subscription</p>
      <table>
        <thead><tr><th>Paid Invoices This Period</th><th class="num">Total Paid</th></tr></thead>
        <tbody>
          <tr><td>${opts.expense.count} invoice(s) paid</td><td class="num">${fmtAmount(opts.expense.totalPaid, { negative: opts.expense.totalPaid > 0 })}</td></tr>
        </tbody>
      </table>
    </div>` : ''}
  `

  return reportPageHtml({
    title: 'Year-End Tax Summary',
    summaryLabel: `${periodLabel} ${filterLabel}`,
    footerName: 'Year-End Tax Summary',
    bodyHtml,
  })
}

export function reportPageHtml(opts: {
  title: string
  summaryLabel: string
  footerName: string
  bodyHtml: string
}): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>${REPORT_CSS}</style>
</head>
<body>
  ${reportHeaderHtml(opts.summaryLabel)}
  <p class="report-title">${opts.title}</p>
  ${opts.bodyHtml}
  ${reportFooterHtml(opts.footerName)}
</body>
</html>`
}
