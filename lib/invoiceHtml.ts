import { shortInvoiceNumber } from './formatInvoice'
import { fmtPhone } from './formatPhone'

// Canonical invoice HTML — this is the ONE template used for the emailed invoice,
// the generated PDF, and every print/reprint view. Do not fork this markup elsewhere;
// add a caller instead.

const PORTAL_URL = process.env.BASE_URL || 'https://cominghomecare.com'

const FEE_LABELS: Record<string, string> = {
  'ST-MED': 'Short-Term Medicaid', 'ST-COM': 'Short-Term Commercial', 'ST-DUAL': 'Short-Term Dual',
  'LT-MED': 'Long-Term Medicaid',  'LT-COM': 'Long-Term Commercial',  'LT-DUAL': 'Long-Term Dual',
  'VR-MED': 'Void & Resubmit — Medicaid', 'VR-COM': 'Void & Resubmit — Commercial',
  'CORR': 'Correction — Provider Error', 'SAMEDAY': 'Same-Day Service Fee',
  A1: 'Medicaid — Single Payer', A2: 'Commercial — Single Payer', B: 'Dual Payer', C: '3+ Payer',
}

const STATUS_COLOR: Record<string, string> = {
  Paid: '#16a34a', Partial: '#d97706', Sent: '#2563eb',
  Disputed: '#dc2626', WrittenOff: '#6b7280', Overdue: '#ea580c', Pending: '#2563eb',
}

export interface InvoiceHtmlEntry {
  workDate: Date | string
  invoiceFeePlan: string
  invoiceFeeAmt: number
}

export interface InvoiceHtmlPayment {
  receiptNumber: string
  amount: number
  method?: string | null
  note?: string | null
  appliedAt: Date | string
}

export interface InvoiceHtmlNurse {
  displayName?: string | null
  accountNumber?: string | null
  firstName?: string | null
  lastName?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  phone?: string | null
  hasBusinessProvider?: boolean | null
  bizEntityName?: string | null
  bizServiceAddress?: string | null
  bizPhone?: string | null
  bizEmail?: string | null
  user?: { email?: string | null } | null
}

export interface InvoiceHtmlData {
  invoiceNumber: string
  status: string
  nurseName: string
  nurseEmail: string
  nurse?: InvoiceHtmlNurse | null
  grossAmount?: number
  discountAmt?: number
  discountNote?: string | null
  totalAmount: number
  paidAmount?: number
  dueTerm: string
  dueDate: Date | string
  sentAt: Date | string
  paidAt?: Date | string | null
  entries: InvoiceHtmlEntry[]
  payments?: InvoiceHtmlPayment[]
  notes?: string | null
  lateFeePlan?: string | null
  lateFeeAmt?: number | null
  lateFeePercent?: number | null
  promptPayCredit?: number | null
  promptPayDays?: number | null
}

export function buildInvoiceHtml({
  invoiceNumber,
  status,
  nurseName,
  nurseEmail,
  nurse,
  grossAmount,
  discountAmt = 0,
  discountNote,
  totalAmount,
  paidAmount = 0,
  dueTerm,
  dueDate,
  sentAt,
  paidAt,
  entries,
  payments = [],
  notes,
  lateFeePlan,
  lateFeeAmt,
  lateFeePercent,
  promptPayCredit,
  promptPayDays = 14,
}: InvoiceHtmlData): string {
  const fmt = (d: Date | string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  const fmtMoney = (n: number) => `$${n.toFixed(2)}`
  const dueDateFmt = dueTerm === 'ASAP' ? 'Due Immediately' : fmt(dueDate)
  const balance = totalAmount - (paidAmount || 0)
  const color = STATUS_COLOR[status] || '#6b7280'

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

  // Bill-to — business-provider branching
  const useBiz = !!nurse?.hasBusinessProvider
  const billToName = useBiz
    ? (nurse?.bizEntityName || nurse?.displayName || nurseName)
    : ((nurse?.firstName && nurse?.lastName) ? `${nurse.firstName} ${nurse.lastName}` : (nurse?.displayName || nurseName))
  const billToAddress = useBiz
    ? (nurse?.bizServiceAddress || '')
    : [nurse?.address, [nurse?.city, nurse?.state].filter(Boolean).join(', ') + (nurse?.zip ? ` ${nurse.zip}` : '')].filter(Boolean).join('<br>')
  const billToPhone = fmtPhone(useBiz ? (nurse?.bizPhone || '') : (nurse?.phone || ''))
  const billToEmail = useBiz ? (nurse?.bizEmail || nurse?.user?.email || nurseEmail) : (nurse?.user?.email || nurseEmail)

  // Payment deep links (prefilled with the outstanding balance)
  const shortNum   = shortInvoiceNumber(invoiceNumber)
  const venmoUrl   = `https://venmo.com/AlexMcGann?txn=pay&amount=${balance.toFixed(2)}&note=${encodeURIComponent(shortNum)}`
  const cashappUrl = `https://cash.app/$myInvoiceCHC/${balance.toFixed(2)}`
  const zelleUrl   = `mailto:billing@cominghomecare.com?subject=${encodeURIComponent(`Zelle Payment – ${shortNum}`)}`
  const appleUrl   = `mailto:billing@cominghomecare.com?subject=${encodeURIComponent(`Apple Pay – ${shortNum}`)}`

  const svgImg = (svg: string) =>
    `<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="18" height="18" alt="" style="display:block;margin:0 auto 3px"/>`
  const venmoIcon   = svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M19.04 2c.76 1.27 1.1 2.58 1.1 4.23 0 5.27-4.5 12.11-8.16 16.92H4.22L1 4.01l6.77-.65 1.73 13.92c1.6-2.68 3.58-6.9 3.58-9.77 0-1.57-.27-2.64-.68-3.51H19.04z"/></svg>`)
  const cashappIcon = svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M13.567 7.9c.84.23 1.62.69 2.19 1.35l1.67-1.67a6.42 6.42 0 00-3.86-1.88V4h-2v1.72c-2.3.4-3.97 2.06-3.97 4.13 0 2.37 1.85 3.38 3.97 3.93v3.37c-.9-.18-1.74-.64-2.36-1.32L7.4 17.5a6.5 6.5 0 004.16 1.78V21h2v-1.73c2.34-.37 4.03-2.05 4.03-4.2 0-2.44-1.91-3.47-4.03-4v-3.17zm-2 0V5.77c-.88.26-1.47 1-1.47 1.85 0 .8.5 1.35 1.47 1.65v-3.37zm2 8.27c.92-.27 1.53-1.03 1.53-1.9 0-.83-.52-1.4-1.53-1.72v3.62z"/></svg>`)
  const zelleIcon   = svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="white" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" font-size="11" font-weight="900" font-family="Arial,Helvetica,sans-serif" fill="white">Z</text></svg>`)
  const appleIcon   = svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`)

  const payBtn = (href: string, bg: string, icon: string, label: string, handle: string) => `
    <td style="padding:2px;width:25%">
      <a href="${href}" style="display:block;background:${bg};border-radius:3px;padding:6px 3px 5px;text-decoration:none;text-align:center">
        ${icon}
        <p style="margin:0 0 2px;font-size:9px;font-weight:800;color:#ffffff;line-height:1.2">${label}</p>
        <p style="margin:0;font-size:7px;font-weight:700;color:#ffffff;line-height:1.3;word-break:break-all">${handle}</p>
      </a>
    </td>`

  const entryRows = entries.map(e => `
    <tr style="border-top:1px solid #e2e8f0">
      <td style="padding:8px 16px;font-size:10px;color:#2F3E4E">${fmt(e.workDate)}</td>
      <td style="padding:8px 16px;font-size:10px">
        <span style="background:#2F3E4E;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px">${e.invoiceFeePlan || ''}</span>
      </td>
      <td style="padding:8px 16px;font-size:10px;color:#64748b">${FEE_LABELS[e.invoiceFeePlan] || e.invoiceFeePlan || ''}</td>
      <td style="padding:8px 16px;font-size:10px;text-align:right;font-weight:700;color:#2F3E4E">$${(e.invoiceFeeAmt || 0).toFixed(2)}</td>
    </tr>`).join('')

  const paymentRows = payments.map(p => `
    <tr style="border-top:1px solid #e2e8f0;background:#f0fdf4">
      <td colspan="3" style="padding:6px 16px;font-size:12px;color:#16a34a">
        Payment · ${p.receiptNumber} · ${p.method || 'Other'}${p.note ? ` · ${p.note}` : ''} (${fmt(p.appliedAt)})
      </td>
      <td style="padding:6px 16px;font-size:12px;color:#16a34a;text-align:right;font-weight:700">&minus;$${p.amount.toFixed(2)}</td>
    </tr>`).join('')

  // 30/60/90 late-fee payment schedule
  const addDays = (d: Date | string, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
  const d30 = addDays(dueDate, 30)
  const d60 = addDays(dueDate, 60)
  const d90 = addDays(dueDate, 90)
  const hasLateFeePlan = !!lateFeePlan && lateFeePlan !== 'none'
  const lateLabel = (months: number): string => {
    if (!hasLateFeePlan) return 'No penalty'
    if (lateFeePlan === 'flat' && lateFeeAmt)       return `+${fmtMoney(lateFeeAmt * months)}`
    if (lateFeePlan === 'percent' && lateFeePercent) return `+${(lateFeePercent * months).toFixed(1)}%`
    return 'TBD'
  }
  const schedGrid = hasLateFeePlan ? `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #D9E1E8">
      <p style="margin:0 0 6px;font-size:8px;color:#7A8F79;text-transform:uppercase;letter-spacing:1.5px;font-weight:700">Late Payment Schedule</p>
      <p style="margin:0 0 8px;font-size:10px;color:#4a5a6a;line-height:1.5">
        Please return payment by the due date shown to avoid late payment fees from accruing. Any fees assessed will be reflected as part of the total account balance on the next invoice generated.
      </p>
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
    </div>` : ''

  // Prompt-pay bonus note — a discount for paying early
  const promptPayNote = (promptPayCredit && promptPayCredit > 0)
    ? (() => {
        const deadline = addDays(sentAt, promptPayDays ?? 14)
        return `<div style="margin-top:8px;padding:6px 10px;background:#fffbe6;border-left:3px solid #e6b800;border-radius:0 3px 3px 0">
          <p style="margin:0;font-size:9px;color:#7a6000"><strong>&#9889; Prompt Pay Credit:</strong> Pay the balance in full by ${fmt(deadline)} and receive a <strong>${fmtMoney(promptPayCredit)}</strong> credit toward your next invoice.</p>
        </div>`
      })()
    : ''

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice ${invoiceNumber}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="padding:10px 8px">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #2F3E4E">

  <!-- ── Header banner: navy, logo + status ── -->
  <div style="background:#2F3E4E;padding:14px 20px">
    <table style="width:100%;border-collapse:collapse"><tr>
      <td style="vertical-align:middle">
        <table style="border-collapse:collapse"><tr>
          <td style="vertical-align:middle;padding-right:12px">
            <div style="background:white;border-radius:6px;padding:6px 8px;display:inline-block;line-height:0">
              <img src="${PORTAL_URL}/chc_logo.png" alt="Coming Home Care" style="height:40px;width:auto;display:block"/>
            </div>
          </td>
          <td style="vertical-align:middle">
            <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:1.5px;color:#7A8F79;text-transform:uppercase">Invoice</p>
            <p style="margin:2px 0 0;font-size:14px;font-weight:800;color:#ffffff">Coming Home Care Services, LLC</p>
            <p style="margin:2px 0 0;font-size:9px;color:#D9E1E8">billing@cominghomecare.com · cominghomecare.com</p>
          </td>
        </tr></table>
      </td>
      <td style="text-align:right;vertical-align:middle">
        <p style="margin:0;font-family:monospace;font-size:14px;font-weight:700;color:#ffffff">${shortNum}</p>
        <span style="font-size:9px;font-weight:700;color:${color};background:${color}28;padding:2px 9px;border-radius:99px;display:inline-block;margin-top:3px">${status}</span>
        <p style="margin:5px 0 0;font-size:9px;color:#D9E1E8">Issued ${fmt(sentAt)}</p>
        <p style="margin:1px 0 0;font-size:9px;color:#D9E1E8">Due ${dueDateFmt}</p>
      </td>
    </tr></table>
  </div>

  <!-- ── Quote banner: sage green ── -->
  <div style="background:#7A8F79;padding:5px 20px">
    <p style="margin:0;color:#ffffff;font-size:9px;font-style:italic;text-align:center;line-height:1.4">${quoteHtml}</p>
  </div>

  <!-- ── Bill To ── -->
  <div style="padding:10px 20px;border-bottom:1px solid #D9E1E8;background:#f8fafc">
    <p style="margin:0 0 3px;font-size:8px;color:#7A8F79;text-transform:uppercase;letter-spacing:2px;font-weight:700">Billed To</p>
    <p style="margin:0;font-size:14px;font-weight:800;color:#2F3E4E">${billToName}</p>
    ${billToAddress ? `<p style="margin:2px 0 0;font-size:11px;color:#4a5a6a">${billToAddress}</p>` : ''}
    ${billToPhone ? `<p style="margin:1px 0 0;font-size:11px;color:#4a5a6a">${billToPhone}</p>` : ''}
    <p style="margin:1px 0 0;font-size:11px;color:#4a5a6a">${billToEmail}</p>
    ${nurse?.accountNumber ? `<p style="margin:3px 0 0;font-size:10px;font-family:monospace;color:#7A8F79">Account: ${nurse.accountNumber}</p>` : ''}
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
      <tbody>
        ${entryRows}
        ${paymentRows}
      </tbody>
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
        <tr style="border-top:2px solid #1e293b">
          <td colspan="3" style="padding:8px 0 0;text-align:right;padding-right:10px;font-size:9px;font-weight:700;color:#7A8F79;text-transform:uppercase;letter-spacing:1.5px;vertical-align:bottom">${balance > 0 ? 'Balance Due' : 'Paid in Full'}</td>
          <td style="padding:8px 0 0;text-align:right;font-size:20px;font-weight:800;color:${balance > 0 ? '#dc2626' : '#16a34a'};vertical-align:bottom">${fmtMoney(balance)}</td>
        </tr>
      </tfoot>
    </table>
    ${notes ? `<div style="margin-top:8px;padding:7px 10px;background:#f4f6f8;border-left:3px solid #7A8F79;border-radius:0 3px 3px 0"><p style="margin:0;font-size:10px;color:#4a5a6a"><strong>Note:</strong> ${notes}</p></div>` : ''}
  </div>

  <!-- ── Payment Options ── -->
  ${balance > 0 ? `
  <div style="margin:0 20px 12px;background:#f4f6f8;border-radius:4px;padding:12px 14px">
    <p style="margin:0 0 8px;font-size:8px;color:#7A8F79;text-transform:uppercase;letter-spacing:2px;font-weight:700">Ways to Pay</p>
    <table style="width:100%;border-collapse:collapse;margin:-2px">
      <tr>
        ${payBtn(venmoUrl,   '#3D95CE', venmoIcon,   'Venmo',     '@AlexMcGann')}
        ${payBtn(cashappUrl, '#00C244', cashappIcon, 'Cash App',  '$myInvoiceCHC')}
        ${payBtn(zelleUrl,   '#6D1ED4', zelleIcon,   'Zelle',     'mypay-chcs')}
        ${payBtn(appleUrl,   '#1c1c1e', appleIcon,   'Apple Pay', 'billing@cominghomecare.com')}
      </tr>
    </table>
    <p style="margin:7px 0 0;font-size:8px;color:#7A8F79;font-style:italic">*Cash and check accepted as well — contact us for details.</p>

    ${schedGrid}
    ${promptPayNote}

    <table style="width:100%;border-collapse:collapse;margin-top:10px"><tr>
      <td style="vertical-align:middle"><p style="margin:0;font-size:11px;color:#2F3E4E">Please include <strong>#${shortNum}</strong> as your payment note.</p></td>
      <td style="text-align:right;vertical-align:middle;padding-left:10px">
        <a href="${PORTAL_URL}/nurse/invoices" style="display:inline-block;background:#2F3E4E;color:#ffffff;text-decoration:none;padding:5px 11px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:0.5px;white-space:nowrap">View in Portal &rarr;</a>
      </td>
    </tr></table>
    ${totalAmount >= 50 ? '<p style="margin:5px 0 0;font-size:9px;color:#7A8F79;border-top:1px solid #D9E1E8;padding-top:6px">Credit card payments accepted for invoices of $50.00 or more — contact us for details.</p>' : ''}
  </div>` : `
  <div style="margin:0 20px 12px;background:#f0fdf4;border-radius:4px;padding:12px 14px;text-align:center">
    <p style="margin:0;font-size:11px;font-weight:700;color:#16a34a">✓ This invoice has been paid in full.</p>
    ${paidAt ? `<p style="margin:2px 0 0;font-size:9px;color:#7A8F79">Paid ${fmt(paidAt)}</p>` : ''}
  </div>`}

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
