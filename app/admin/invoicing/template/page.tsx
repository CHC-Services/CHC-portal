'use client'

import { fmtPhone } from '../../../../lib/formatPhone'

const FEE_LABELS: Record<string, string> = {
  A1: 'Medicaid — Single Payer',
  A2: 'Commercial — Single Payer',
  B:  'Dual Payer',
  C:  '3+ Payer',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
function currency(n: number) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// ── Sample data ──────────────────────────────────────────────────────────────
const SAMPLE = {
  invoiceNumber: 'CHC-2025-0042',
  displayName:   'Jane R. Sample, RN',
  firstName:     'Jane',
  lastName:      'Sample',
  address:       '123 Provider Lane',
  city:          'Albany',
  state:         'NY',
  zip:           '12207',
  phone:         '(518) 555-0199',
  email:         'jane.sample@example.com',
  accountNumber: 'CHC-00099',
  status:        'Partial',
  sentAt:        '2025-03-01',
  dueDate:       '2025-03-15',
  dueTerm:       '14',
  paidAt:        undefined as string | undefined,
  notes:         'This is a sample note that might appear on an invoice — e.g. reimbursement details or special instructions.',
  entries: [
    { workDate: '2025-02-03', invoiceFeePlan: 'A1', invoiceFeeAmt: 120.00 },
    { workDate: '2025-02-07', invoiceFeePlan: 'B',  invoiceFeeAmt: 175.00 },
    { workDate: '2025-02-10', invoiceFeePlan: 'A2', invoiceFeeAmt: 150.00 },
    { workDate: '2025-02-14', invoiceFeePlan: 'C',  invoiceFeeAmt: 200.00 },
    { workDate: '2025-02-21', invoiceFeePlan: 'A1', invoiceFeeAmt: 120.00 },
  ],
  payments: [
    { id: '1', receiptNumber: 'RCT-2025-0011', amount: 270.00, method: 'Venmo',    note: 'INV-2025-0042', appliedAt: '2025-03-10' },
  ],
}

const totalAmount = SAMPLE.entries.reduce((s, e) => s + e.invoiceFeeAmt, 0)
const paidAmount  = SAMPLE.payments.reduce((s, p) => s + p.amount, 0)
const balance     = totalAmount - paidAmount

const STATUS_COLOR: Record<string, string> = {
  Paid: '#16a34a', Partial: '#d97706', Sent: '#2563eb',
  Disputed: '#dc2626', WrittenOff: '#6b7280', Overdue: '#ea580c', Pending: '#2563eb',
}
const statusColor = STATUS_COLOR[SAMPLE.status] || '#6b7280'

export default function InvoiceTemplatePage() {
  return (
    <>
      <style>{`
        @page {
          size: letter portrait;
          margin: 0.55in;
        }
        @media print {
          /* Force background colors and images to print */
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          /* Strip all screen chrome */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          /* Hide toolbar */
          .no-print { display: none !important; }
          /* Remove screen-only outer wrapper styling */
          .print-outer {
            padding-top: 0 !important;
            background: white !important;
            min-height: unset !important;
          }
          /* Make invoice fill the page, no screen decorations */
          .invoice-wrap {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          /* Tighten spacing so a typical invoice fits one page */
          .print-body { padding: 20px 28px !important; }
          .print-gap  { gap: 16px !important; }
          .print-section { margin-bottom: 14px !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print fixed top-0 left-0 right-0 bg-[#2F3E4E] text-white px-6 py-3 flex items-center gap-4 z-50 shadow-lg">
        <span className="text-sm font-semibold text-[#D9E1E8]">Invoice Template Preview</span>
        <span className="text-xs text-[#7A8F79] bg-[#7A8F79]/20 px-2 py-0.5 rounded-full font-semibold">SAMPLE DATA</span>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="bg-[#7A8F79] hover:bg-[#657a64] text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
        >
          🖨 Print Preview
        </button>
        <button
          onClick={() => window.close()}
          className="text-[#D9E1E8] hover:text-white text-sm transition"
        >
          ✕ Close
        </button>
      </div>

      <div className="print-outer pt-14 min-h-screen bg-gray-100">
        <div className="invoice-wrap max-w-[720px] mx-auto my-8 bg-white shadow-xl rounded-xl overflow-hidden p-0">

          {/* Header */}
          <div className="bg-[#2F3E4E] px-8 py-5 flex justify-between items-center">
            <div className="flex items-center gap-5">
              <div className="bg-white rounded-lg px-3 py-2 flex-shrink-0">
                <img src="/chc_logo.png" alt="Coming Home Care" className="h-12 w-auto block" />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#7A8F79]">Invoice</p>
                <h1 className="text-xl font-black text-white leading-tight">Coming Home Care Services, LLC</h1>
                <p className="text-[11px] text-[#D9E1E8] mt-0.5">support@cominghomecare.com · cominghomecare.com</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-[#7A8F79] font-semibold">Invoice #</p>
              <p className="text-lg font-black text-white font-mono">{SAMPLE.invoiceNumber}</p>
              <span
                className="inline-block mt-1 text-[10px] font-black px-3 py-0.5 rounded-full"
                style={{ background: `${statusColor}22`, color: statusColor }}
              >
                {SAMPLE.status}
              </span>
            </div>
          </div>

          <div className="print-body px-8 py-6 space-y-6">

            {/* Bill To / Invoice Info */}
            <div className="print-gap print-section grid grid-cols-2 gap-6">
              <div className="bg-[#F4F6F5] rounded-xl p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#7A8F79] mb-2">Bill To</p>
                <p className="font-bold text-[#2F3E4E]">{SAMPLE.firstName} {SAMPLE.lastName}</p>
                <p className="text-sm text-[#2F3E4E]">{SAMPLE.address}</p>
                <p className="text-sm text-[#2F3E4E]">{SAMPLE.city}, {SAMPLE.state} {SAMPLE.zip}</p>
                <p className="text-sm text-[#7A8F79] mt-0.5">{fmtPhone(SAMPLE.phone)}</p>
                <p className="text-sm text-[#7A8F79]">{SAMPLE.email}</p>
                <p className="text-xs font-mono text-[#7A8F79] mt-0.5">Acct: {SAMPLE.accountNumber}</p>
              </div>
              <div className="bg-[#F4F6F5] rounded-xl p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#7A8F79] mb-2">Invoice Details</p>
                <div className="space-y-0.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#7A8F79]">Issued</span>
                    <span className="font-semibold text-[#2F3E4E]">{fmt(SAMPLE.sentAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7A8F79]">Due</span>
                    <span className="font-semibold text-[#2F3E4E]">{fmt(SAMPLE.dueDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7A8F79]">Terms</span>
                    <span className="font-semibold text-[#2F3E4E]">Net {SAMPLE.dueTerm}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="rounded-xl border border-[#D9E1E8] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f4f6f8]">
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">Date Worked</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">Plan</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] hidden sm:table-cell">Description</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE.entries.map((e, i) => (
                    <tr key={i} className={`border-t border-[#D9E1E8] ${i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}`}>
                      <td className="px-4 py-2.5 font-semibold text-[#2F3E4E]">{fmt(e.workDate)}</td>
                      <td className="px-4 py-2.5">
                        <span className="bg-[#2F3E4E] text-white text-[10px] font-bold px-2 py-0.5 rounded">
                          {e.invoiceFeePlan}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[#7A8F79] hidden sm:table-cell">
                        {FEE_LABELS[e.invoiceFeePlan] || e.invoiceFeePlan}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#2F3E4E]">
                        {currency(e.invoiceFeeAmt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#2F3E4E] bg-[#f4f6f8]">
                    <td colSpan={3} className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#7A8F79]">Invoice Total</td>
                    <td className="px-4 py-3 text-right text-xl font-black text-[#2F3E4E]">{currency(totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Payment history */}
            <div className="rounded-xl border border-[#D9E1E8] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-green-50">
                    <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-green-700">Receipt #</th>
                    <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-green-700">Date</th>
                    <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-green-700">Method</th>
                    <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-green-700">Note</th>
                    <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-green-700">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE.payments.map((p, i) => (
                    <tr key={p.id} className={`border-t border-[#D9E1E8] ${i % 2 === 0 ? 'bg-white' : 'bg-green-50/30'}`}>
                      <td className="px-4 py-2 font-mono text-xs text-[#7A8F79]">{p.receiptNumber}</td>
                      <td className="px-4 py-2 text-[#2F3E4E]">{fmt(p.appliedAt)}</td>
                      <td className="px-4 py-2 text-[#7A8F79]">{p.method || '—'}</td>
                      <td className="px-4 py-2 text-[#7A8F79] italic">{p.note || '—'}</td>
                      <td className="px-4 py-2 text-right font-bold text-green-600">-{currency(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-green-600 bg-green-50">
                    <td colSpan={4} className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-green-700">
                      Balance Due
                    </td>
                    <td className="px-4 py-2.5 text-right text-xl font-black text-red-500">
                      {currency(balance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Notes */}
            <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-xl px-5 py-3">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-0.5">Note</p>
              <p className="text-sm text-amber-900">{SAMPLE.notes}</p>
            </div>

            {/* Payment methods */}
            <div className="bg-[#F4F6F5] rounded-xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] mb-3">Tap to Pay</p>
              <div className="flex flex-wrap gap-3 mb-3">

                {/* Venmo */}
                <a
                  href={`https://venmo.com/AlexMcGann?txn=pay&amount=${balance.toFixed(2)}&note=${encodeURIComponent(SAMPLE.invoiceNumber)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-print flex items-center gap-2 bg-[#3D95CE] hover:bg-[#2d7fb8] text-white font-bold text-sm px-4 py-2.5 rounded-xl transition shadow-sm"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19.04 2c.76 1.27 1.1 2.58 1.1 4.23 0 5.27-4.5 12.11-8.16 16.92H4.22L1 4.01l6.77-.65 1.73 13.92c1.6-2.68 3.58-6.9 3.58-9.77 0-1.57-.27-2.64-.68-3.51H19.04z"/>
                  </svg>
                  Venmo
                </a>

                {/* Cash App */}
                <a
                  href={`https://cash.app/$myInvoiceCHC/${balance.toFixed(2)}?note=${encodeURIComponent(SAMPLE.invoiceNumber)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-print flex items-center gap-2 bg-[#00D632] hover:bg-[#00b82b] text-white font-bold text-sm px-4 py-2.5 rounded-xl transition shadow-sm"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.567 7.9c.84.23 1.62.69 2.19 1.35l1.67-1.67a6.42 6.42 0 00-3.86-1.88V4h-2v1.72c-2.3.4-3.97 2.06-3.97 4.13 0 2.37 1.85 3.38 3.97 3.93v3.37c-.9-.18-1.74-.64-2.36-1.32L7.4 17.5a6.5 6.5 0 004.16 1.78V21h2v-1.73c2.34-.37 4.03-2.05 4.03-4.2 0-2.44-1.91-3.47-4.03-4v-3.17zm-2 0V5.77c-.88.26-1.47 1-1.47 1.85 0 .8.5 1.35 1.47 1.65v-3.37zm2 8.27c.92-.27 1.53-1.03 1.53-1.9 0-.83-.52-1.4-1.53-1.72v3.62z"/>
                  </svg>
                  Cash App
                </a>

                {/* Apple Pay */}
                <a
                  href="https://applepay.apple.com/person/support@cominghomecare.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-print flex items-center gap-2 bg-black hover:bg-gray-800 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition shadow-sm"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  Apple Pay
                </a>

              </div>

              {/* Print fallback */}
              <div className="hidden print:block space-y-1 text-xs text-[#7A8F79]">
                <p><strong>Venmo:</strong> @AlexMcGann</p>
                <p><strong>Cash App:</strong> $myInvoiceCHC</p>
                <p><strong>Apple Pay:</strong> support@cominghomecare.com</p>
              </div>

              <p className="text-[10px] text-[#7A8F79] mt-2">
                Please include <strong>{SAMPLE.invoiceNumber}</strong> as your payment note.
              </p>
            </div>

            <p className="text-[10px] text-center text-[#7A8F79] pt-2 border-t border-[#D9E1E8]">
              Coming Home Care Services, LLC · This invoice is confidential.
              Questions? Email support@cominghomecare.com
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
