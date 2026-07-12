import { shortInvoiceNumber } from './formatInvoice'

// Canonical invoice HTML — this is the ONE template used for the emailed invoice,
// the generated PDF, and every print/reprint view. Do not fork this markup elsewhere;
// add a caller instead.

const PORTAL_URL = process.env.BASE_URL || 'https://portal.cominghomecare.com'

const FEE_PLAN_LABELS: Record<string, string> = {
  A1: 'Medicaid — Single Payer',
  A2: 'Commercial — Single Payer',
  B:  'Dual Payer',
  C:  '3+ Payer',
}

export interface InvoiceHtmlEntry {
  workDate: Date | string
  invoiceFeePlan: string
  invoiceFeeAmt: number
}

export interface InvoiceHtmlData {
  nurseName: string
  nurseFirstName?: string
  nurseLastName?: string
  nurseAddress?: string
  nurseCity?: string
  nurseState?: string
  nurseZip?: string
  invoiceNumber: string
  grossAmount?: number
  discountAmt?: number
  discountNote?: string
  totalAmount: number
  dueTerm: string
  dueDate: Date | string
  entries: InvoiceHtmlEntry[]
  notes?: string
  lateFeePlan?: string | null
  lateFeeAmt?: number | null
  lateFeePercent?: number | null
  promptPayCredit?: number | null
  promptPayDays?: number | null
}

export function buildInvoiceHtml({
  nurseName,
  nurseFirstName,
  nurseLastName,
  nurseAddress,
  nurseCity,
  nurseState,
  nurseZip,
  invoiceNumber,
  grossAmount,
  discountAmt = 0,
  discountNote,
  totalAmount,
  dueTerm,
  dueDate,
  entries,
  notes,
  lateFeePlan,
  lateFeeAmt,
  lateFeePercent,
  promptPayCredit,
  promptPayDays = 14,
}: InvoiceHtmlData): string {
  const fmt = (d: Date | string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  const fmtMoney = (n: number) => `$${n.toFixed(2)}`
  const issueDate = fmt(new Date())
  const dueDateFmt = dueTerm === 'ASAP' ? 'Due Immediately' : fmt(dueDate)

  // Rotating quotes — one per invoice, no fixed order
  const QUOTES = [
    { text: 'How very little can be done under the spirit of fear.', author: 'Florence Nightingale' },
    { text: "I didn't want just any career, so I'm not going to be just any nurse.", author: 'Unknown' },
    { text: 'The best way to find yourself is to lose yourself in the service of others.', author: 'Mahatma Gandhi' },
    { text: 'Kindness is a language every patient understands.', author: '' },
  ]
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)]
  const quoteHtml = q.author
    ? `&ldquo;${q.text}&rdquo; &mdash; ${q.author}`
    : `&ldquo;${q.text}&rdquo;`

  // SVG icons — centered for stacked button layout
  const svgImg = (svg: string) =>
    `<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="20" height="20" alt="" style="display:block;margin:0 auto 4px"/>`
  const venmoIcon   = svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M19.04 2c.76 1.27 1.1 2.58 1.1 4.23 0 5.27-4.5 12.11-8.16 16.92H4.22L1 4.01l6.77-.65 1.73 13.92c1.6-2.68 3.58-6.9 3.58-9.77 0-1.57-.27-2.64-.68-3.51H19.04z"/></svg>`)
  const cashappIcon = svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M13.567 7.9c.84.23 1.62.69 2.19 1.35l1.67-1.67a6.42 6.42 0 00-3.86-1.88V4h-2v1.72c-2.3.4-3.97 2.06-3.97 4.13 0 2.37 1.85 3.38 3.97 3.93v3.37c-.9-.18-1.74-.64-2.36-1.32L7.4 17.5a6.5 6.5 0 004.16 1.78V21h2v-1.73c2.34-.37 4.03-2.05 4.03-4.2 0-2.44-1.91-3.47-4.03-4v-3.17zm-2 0V5.77c-.88.26-1.47 1-1.47 1.85 0 .8.5 1.35 1.47 1.65v-3.37zm2 8.27c.92-.27 1.53-1.03 1.53-1.9 0-.83-.52-1.4-1.53-1.72v3.62z"/></svg>`)
  const zelleIcon   = svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="white" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" font-size="11" font-weight="900" font-family="Arial,Helvetica,sans-serif" fill="white">Z</text></svg>`)
  const appleIcon   = svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`)

  // Billed-to info
  const billName = (nurseFirstName && nurseLastName) ? `${nurseFirstName} ${nurseLastName}` : nurseName
  const cityLine = [nurseCity, nurseState, nurseZip].filter(Boolean).join(nurseState ? ', ' : ' ')
  const addressBlock = [
    nurseAddress ? `<p style="margin:1px 0 0;font-size:10px;color:#7A8F79">${nurseAddress}</p>` : '',
    cityLine     ? `<p style="margin:1px 0 0;font-size:10px;color:#7A8F79">${cityLine}</p>`    : '',
  ].join('')

  // Payment deep links
  const shortNum   = shortInvoiceNumber(invoiceNumber)
  const venmoUrl   = `https://venmo.com/AlexMcGann?txn=pay&amount=${totalAmount.toFixed(2)}&note=${encodeURIComponent(shortNum)}`
  const cashappUrl = `https://cash.app/$myInvoiceCHC/${totalAmount.toFixed(2)}`
  const zelleUrl   = `mailto:billing@cominghomecare.com?subject=${encodeURIComponent(`Zelle Payment – ${shortNum}`)}`
  const appleUrl   = `mailto:billing@cominghomecare.com?subject=${encodeURIComponent(`Apple Pay – ${shortNum}`)}`

  // Stacked payment button — icon on top, name, bold contact below
  const payBtn = (href: string, bg: string, icon: string, label: string, handle: string) => `
    <td style="padding:2px;width:25%">
      <a href="${href}" style="display:block;background:${bg};border-radius:3px;padding:6px 3px 5px;text-decoration:none;text-align:center">
        ${icon}
        <p style="margin:0 0 2px;font-size:9px;font-weight:800;color:#ffffff;line-height:1.2">${label}</p>
        <p style="margin:0;font-size:7px;font-weight:700;color:#ffffff;line-height:1.3;word-break:break-all">${handle}</p>
      </a>
    </td>`

  // Tighter line item rows
  const lineItems = entries.map(e => `
    <tr>
      <td style="padding:3px 0;font-size:11px;color:#2F3E4E;border-bottom:1px solid #f0f4f0">${fmt(e.workDate)}</td>
      <td style="padding:3px 8px;font-size:11px;color:#2F3E4E;border-bottom:1px solid #f0f4f0">
        <span style="background:#2F3E4E;color:#fff;font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;letter-spacing:0.5px">${e.invoiceFeePlan}</span>
      </td>
      <td style="padding:3px 0;font-size:11px;color:#4a5a6a;border-bottom:1px solid #f0f4f0">${FEE_PLAN_LABELS[e.invoiceFeePlan] || e.invoiceFeePlan}</td>
      <td style="padding:3px 0;font-size:11px;color:#2F3E4E;font-weight:600;text-align:right;border-bottom:1px solid #f0f4f0">${fmtMoney(e.invoiceFeeAmt)}</td>
    </tr>
  `).join('')

  // 30/60/90 payment schedule grid
  const addDays = (d: Date | string, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
  const d30 = addDays(dueDate, 30)
  const d60 = addDays(dueDate, 60)
  const d90 = addDays(dueDate, 90)
  const lateLabel = (months: number): string => {
    if (!lateFeePlan || lateFeePlan === 'none') return 'No penalty'
    if (lateFeePlan === 'flat' && lateFeeAmt)       return `+${fmtMoney(lateFeeAmt * months)}`
    if (lateFeePlan === 'percent' && lateFeePercent) return `+${(lateFeePercent * months).toFixed(1)}%`
    return 'TBD'
  }
  const schedGrid = `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #D9E1E8">
      <p style="margin:0 0 6px;font-size:8px;color:#7A8F79;text-transform:uppercase;letter-spacing:1.5px;font-weight:700">Payment Schedule</p>
      <table style="width:100%;border-collapse:collapse;font-size:9px;text-align:center">
        <tr>
          <td style="padding:3px 2px;text-align:left;font-size:8px;color:#7A8F79;font-weight:700;text-transform:uppercase;width:20%">Date</td>
          <td style="padding:3px 2px;background:#eaf4ea;border-radius:3px;font-weight:700;color:#2F3E4E">${dueTerm === 'ASAP' ? 'Today' : fmt(dueDate)}</td>
          <td style="padding:3px 2px;color:#7A8F79">${fmt(d30)}</td>
          <td style="padding:3px 2px;color:#7A8F79">${fmt(d60)}</td>
          <td style="padding:3px 2px;color:#b03030">${fmt(d90)}</td>
        </tr>
        <tr>
          <td style="padding:2px;text-align:left;font-size:8px;color:#7A8F79;font-weight:700;text-transform:uppercase">Status</td>
          <td style="padding:2px;font-size:8px;color:#22863a;font-weight:700">On Time</td>
          <td style="padding:2px;font-size:8px;color:#7A8F79">30 Days Late</td>
          <td style="padding:2px;font-size:8px;color:#7A8F79">60 Days Late</td>
          <td style="padding:2px;font-size:8px;color:#b03030;font-weight:700">90 Days Late</td>
        </tr>
        <tr>
          <td style="padding:2px;text-align:left;font-size:8px;color:#7A8F79;font-weight:700;text-transform:uppercase">Fee</td>
          <td style="padding:2px;font-size:8px;color:#22863a">—</td>
          <td style="padding:2px;font-size:8px;color:#7A8F79">${lateLabel(1)}</td>
          <td style="padding:2px;font-size:8px;color:#7A8F79">${lateLabel(2)}</td>
          <td style="padding:2px;font-size:8px;color:#b03030">${lateLabel(3)}</td>
        </tr>
      </table>
    </div>`

  // Prompt-pay bonus note
  const promptPayNote = (promptPayCredit && promptPayCredit > 0)
    ? (() => {
        const deadline = addDays(new Date(), promptPayDays ?? 14)
        return `<div style="margin-top:8px;padding:6px 10px;background:#fffbe6;border-left:3px solid #e6b800;border-radius:0 3px 3px 0">
          <p style="margin:0;font-size:9px;color:#7a6000"><strong>&#9889; Prompt Pay Bonus:</strong> Pay by ${fmt(deadline)} and receive a <strong>${fmtMoney(promptPayCredit)}</strong> credit toward your next invoice.</p>
        </div>`
      })()
    : ''

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#D9E1E8;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="padding:10px 8px">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 2px 10px rgba(47,62,78,0.10)">

  <!-- ── Nav bar: navy ── -->
  <div style="background:#2F3E4E;padding:6px 20px;text-align:right">
    <p style="margin:0;font-size:12px;font-weight:800;color:#ffffff;letter-spacing:0.5px">Invoice #${shortNum}</p>
  </div>

  <!-- ── Header: white ── -->
  <div style="background:#ffffff;padding:14px 20px;border-bottom:1px solid #D9E1E8">
    <table style="width:100%;border-collapse:collapse"><tr>

      <!-- Logo -->
      <td style="vertical-align:middle;width:130px">
        <div style="line-height:0">
          <img src="${PORTAL_URL}/chc_logo.png" alt="Coming Home Care" style="height:58px;width:auto;display:block"/>
        </div>
      </td>

      <!-- Right: company contact info -->
      <td style="vertical-align:middle;text-align:right">
        <p style="margin:0;font-size:9px;color:#3A5068;line-height:1.5">1661 Main St Apt 507</p>
        <p style="margin:0;font-size:9px;color:#3A5068;line-height:1.5">Buffalo, NY 14209</p>
        <p style="margin:1px 0 0;font-size:9px;color:#4A7A60;line-height:1.5">billing@cominghomecare.com</p>
        <p style="margin:0;font-size:9px;color:#3A5068;line-height:1.5"><strong>P:</strong>&nbsp;(504)&nbsp;202-7117&nbsp;&nbsp;<strong>|</strong>&nbsp;&nbsp;<strong>F:</strong>&nbsp;(716)&nbsp;219-2311</p>
      </td>

    </tr></table>
  </div>

  <!-- ── Quote banner: sage green ── -->
  <div style="background:#7A8F79;padding:5px 20px">
    <p style="margin:0;color:#ffffff;font-size:9px;font-style:italic;text-align:center;line-height:1.4">${quoteHtml}</p>
  </div>

  <!-- ── Bill To + Dates ── -->
  <div style="padding:10px 20px;border-bottom:1px solid #D9E1E8">
    <table style="width:100%;border-collapse:collapse"><tr>
      <td style="vertical-align:top">
        <p style="margin:0 0 3px;font-size:8px;color:#7A8F79;text-transform:uppercase;letter-spacing:2px;font-weight:700">Billed To</p>
        <p style="margin:0;font-size:13px;font-weight:800;color:#2F3E4E">${billName}</p>
        ${addressBlock}
      </td>
      <td style="text-align:right;vertical-align:top">
        <p style="margin:0;font-size:8px;color:#7A8F79;text-transform:uppercase;letter-spacing:2px;font-weight:700">Issued</p>
        <p style="margin:1px 0 6px;font-size:11px;color:#2F3E4E;font-weight:600">${issueDate}</p>
        <p style="margin:0;font-size:8px;color:#7A8F79;text-transform:uppercase;letter-spacing:2px;font-weight:700">Due</p>
        <p style="margin:1px 0 0;font-size:11px;color:#2F3E4E;font-weight:800">${dueDateFmt}</p>
      </td>
    </tr></table>
  </div>

  <!-- ── Line Items ── -->
  <div style="padding:10px 20px">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="border-bottom:2px solid #2F3E4E">
          <th style="text-align:left;padding:3px 0 6px;font-size:8px;color:#7A8F79;text-transform:uppercase;letter-spacing:1.5px;font-weight:700">Service Date</th>
          <th style="text-align:left;padding:3px 8px 6px;font-size:8px;color:#7A8F79;text-transform:uppercase;letter-spacing:1.5px;font-weight:700">Plan</th>
          <th style="text-align:left;padding:3px 0 6px;font-size:8px;color:#7A8F79;text-transform:uppercase;letter-spacing:1.5px;font-weight:700">Description</th>
          <th style="text-align:right;padding:3px 0 6px;font-size:8px;color:#7A8F79;text-transform:uppercase;letter-spacing:1.5px;font-weight:700">Fee</th>
        </tr>
      </thead>
      <tbody>${lineItems}</tbody>
      <tfoot>
        ${discountAmt > 0 ? `
        <tr>
          <td colspan="3" style="padding:6px 0 0;font-size:9px;font-weight:700;color:#7A8F79;text-transform:uppercase;letter-spacing:1.5px">Subtotal</td>
          <td style="padding:6px 0 0;text-align:right;font-size:13px;font-weight:600;color:#7A8F79">${fmtMoney(grossAmount ?? totalAmount + discountAmt)}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:3px 0 0;font-size:9px;font-weight:700;color:#22863a;text-transform:uppercase;letter-spacing:1.5px">Discount${discountNote ? ` — ${discountNote}` : ''}</td>
          <td style="padding:3px 0 0;text-align:right;font-size:13px;font-weight:700;color:#22863a">&#8722;${fmtMoney(discountAmt)}</td>
        </tr>
        <tr><td colspan="4" style="padding:2px 0"><hr style="border:none;border-top:1px solid #D9E1E8;margin:0"/></td></tr>
        ` : ''}
        <!-- Total Due row -->
        <tr>
          <td colspan="3" style="padding:8px 0 0;text-align:right;padding-right:10px;font-size:9px;font-weight:700;color:#7A8F79;text-transform:uppercase;letter-spacing:1.5px;vertical-align:bottom">Total Due</td>
          <td style="padding:8px 0 0;text-align:right;font-size:20px;font-weight:800;color:#2F3E4E;vertical-align:bottom">${fmtMoney(totalAmount)}</td>
        </tr>
      </tfoot>
    </table>
    ${notes ? `<div style="margin-top:8px;padding:7px 10px;background:#f4f6f8;border-left:3px solid #7A8F79;border-radius:0 3px 3px 0"><p style="margin:0;font-size:10px;color:#4a5a6a"><strong>Note:</strong> ${notes}</p></div>` : ''}
  </div>

  <!-- ── Payment Options ── -->
  <div style="margin:0 20px 12px;background:#f4f6f8;border-radius:4px;padding:12px 14px">
    <p style="margin:0 0 8px;font-size:8px;color:#7A8F79;text-transform:uppercase;letter-spacing:2px;font-weight:700">Ways to Pay</p>
    <table style="width:100%;border-collapse:collapse;margin:-2px">
      <tr>
        ${payBtn(venmoUrl,   '#3D95CE', venmoIcon,   'Venmo',     '@AlexMcGann')}
        ${payBtn(cashappUrl, '#00C244', cashappIcon, 'Cash App',  '$myInvoiceCHC')}
        ${payBtn(zelleUrl,   '#6D1ED4', zelleIcon,   'Zelle',     'billing@')}
        ${payBtn(appleUrl,   '#1c1c1e', appleIcon,   'Apple Pay', 'billing@')}
      </tr>
    </table>
    <p style="margin:7px 0 0;font-size:8px;color:#7A8F79;font-style:italic">*Cash and check accepted as well — contact us for details.</p>

    <!-- 30/60/90 payment schedule (replaces Zelle QR) -->
    ${schedGrid}

    ${promptPayNote}

    <table style="width:100%;border-collapse:collapse;margin-top:10px"><tr>
      <td style="vertical-align:middle"><p style="margin:0;font-size:11px;color:#2F3E4E">Please include <strong>#${shortNum}</strong> as your payment note.</p></td>
      <td style="text-align:right;vertical-align:middle;padding-left:10px">
        <a href="${PORTAL_URL}/nurse/invoices" style="display:inline-block;background:#2F3E4E;color:#ffffff;text-decoration:none;padding:5px 11px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:0.5px;white-space:nowrap">View in Portal &rarr;</a>
      </td>
    </tr></table>
    ${totalAmount >= 50 ? '<p style="margin:5px 0 0;font-size:9px;color:#7A8F79;border-top:1px solid #D9E1E8;padding-top:6px">Credit card payments accepted for invoices of $50.00 or more — contact us for details.</p>' : ''}
  </div>

  <!-- ── Footer ── -->
  <div style="background:#2F3E4E;padding:10px 20px">
    <table style="width:100%;border-collapse:collapse"><tr>
      <td><p style="margin:0;font-size:10px;color:#ffffff;font-weight:600">Coming Home Care Services, LLC</p></td>
      <td style="text-align:right"><p style="margin:0;font-size:10px;font-weight:600;color:#9fbf9d">cominghomecare.com</p></td>
    </tr></table>
  </div>

</div>
</div>
</body>
</html>
      `
}
