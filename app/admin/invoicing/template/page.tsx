'use client'

import { useState } from 'react'
import { fmtPhone } from '../../../../lib/formatPhone'
import { shortInvoiceNumber } from '../../../../lib/formatInvoice'

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
  notes:         'This is a sample note — e.g. reimbursement details or special instructions.',
  entries: [
    { workDate: '2025-02-03', invoiceFeePlan: 'A1', invoiceFeeAmt: 120.00 },
    { workDate: '2025-02-07', invoiceFeePlan: 'B',  invoiceFeeAmt: 175.00 },
    { workDate: '2025-02-10', invoiceFeePlan: 'A2', invoiceFeeAmt: 150.00 },
    { workDate: '2025-02-14', invoiceFeePlan: 'C',  invoiceFeeAmt: 200.00 },
    { workDate: '2025-02-21', invoiceFeePlan: 'A1', invoiceFeeAmt: 120.00 },
  ],
  payments: [
    { id: '1', receiptNumber: 'RCT-2025-0011', amount: 270.00, method: 'Venmo', note: 'INV-2025-0042', appliedAt: '2025-03-10' },
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
const shortNum = shortInvoiceNumber(SAMPLE.invoiceNumber)

export default function InvoiceTemplatePage() {
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<'idle' | 'ok' | 'err'>('idle')

  async function sendPreview() {
    setSending(true)
    setSendStatus('idle')
    try {
      const res = await fetch('/api/admin/invoices/send-preview', { method: 'POST', credentials: 'include' })
      setSendStatus(res.ok ? 'ok' : 'err')
    } catch {
      setSendStatus('err')
    } finally {
      setSending(false)
      setTimeout(() => setSendStatus('idle'), 4000)
    }
  }

  return (
    <>
      <style>{`
        @page { size: letter portrait; margin: 0.4in; }
        @media print {
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          .fixed { display: none !important; }
          footer { display: none !important; }
          .no-print { display: none !important; }
          .print-outer { padding-top: 0 !important; background: white !important; min-height: unset !important; }
          .invoice-wrap { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; max-width: 100% !important; width: 100% !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print fixed top-0 left-0 right-0 bg-[#2F3E4E] text-white px-6 py-3 flex items-center gap-4 z-50 shadow-lg">
        <span className="text-sm font-semibold text-[#D9E1E8]">Invoice Template Preview</span>
        <span className="text-xs text-[#7A8F79] bg-[#7A8F79]/20 px-2 py-0.5 rounded-full font-semibold">SAMPLE DATA</span>
        <a href="/admin/invoicing/receipt-template" target="_blank" className="text-xs text-[#7A8F79] hover:text-white transition underline underline-offset-2">
          View Receipt Template →
        </a>
        <div className="flex-1" />
        <button
          onClick={sendPreview}
          disabled={sending}
          className={`text-sm font-semibold px-5 py-2 rounded-lg transition disabled:opacity-60 ${
            sendStatus === 'ok'  ? 'bg-green-600 text-white' :
            sendStatus === 'err' ? 'bg-red-600 text-white' :
            'bg-[#4a6fa5] hover:bg-[#3a5f95] text-white'
          }`}
        >
          {sending ? '⏳ Sending…' : sendStatus === 'ok' ? '✓ Sent to support@' : sendStatus === 'err' ? '✕ Send failed' : '📧 Email Preview'}
        </button>
        <button onClick={() => window.print()} className="bg-[#7A8F79] hover:bg-[#657a64] text-white text-sm font-semibold px-5 py-2 rounded-lg transition">
          🖨 Print Preview
        </button>
        <button onClick={() => window.close()} className="text-[#D9E1E8] hover:text-white text-sm transition">✕ Close</button>
      </div>

      <div className="print-outer pt-14 min-h-screen bg-gray-100">
        <div className="invoice-wrap max-w-[640px] mx-auto my-6 bg-white shadow-xl rounded-xl overflow-hidden">

          {/* Header */}
          <div className="bg-[#2F3E4E] px-6 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg px-2 py-1 flex-shrink-0">
                <img src="/chc_logo.png" alt="Coming Home Care" className="h-8 w-auto block" />
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-widest text-[#7A8F79]">Invoice</p>
                <h1 className="text-sm font-black text-white leading-tight">Coming Home Care Services, LLC</h1>
                <p className="text-[10px] text-[#D9E1E8] mt-0.5">billing@cominghomecare.com · cominghomecare.com</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[9px] text-[#7A8F79] font-semibold">Invoice #</p>
              <p className="text-base font-black text-white font-mono">{shortNum}</p>
              <span className="inline-block mt-0.5 text-[9px] font-black px-2 py-0.5 rounded-full"
                style={{ background: `${statusColor}22`, color: statusColor }}>
                {SAMPLE.status}
              </span>
            </div>
          </div>

          <div className="px-6 py-4 space-y-3">

            {/* Bill To / Invoice Info — flat row */}
            <div className="flex justify-between items-start pb-3 border-b border-[#D9E1E8]">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-widest text-[#7A8F79] mb-1">Bill To</p>
                <p className="font-bold text-sm text-[#2F3E4E]">{SAMPLE.firstName} {SAMPLE.lastName}</p>
                <p className="text-xs text-[#7A8F79]">{SAMPLE.address}</p>
                <p className="text-xs text-[#7A8F79]">{SAMPLE.city}, {SAMPLE.state} {SAMPLE.zip}</p>
                <p className="text-xs text-[#7A8F79]">{fmtPhone(SAMPLE.phone)}</p>
                <p className="text-xs text-[#7A8F79]">{SAMPLE.email}</p>
                <p className="text-[10px] font-mono text-[#7A8F79] mt-0.5">Acct: {SAMPLE.accountNumber}</p>
              </div>
              <div className="text-right space-y-1">
                <div className="text-xs"><span className="text-[#7A8F79]">Issued </span><span className="font-semibold text-[#2F3E4E]">{fmt(SAMPLE.sentAt)}</span></div>
                <div className="text-xs"><span className="text-[#7A8F79]">Due </span><span className="font-semibold text-[#2F3E4E]">{fmt(SAMPLE.dueDate)}</span></div>
                <div className="text-xs"><span className="text-[#7A8F79]">Terms </span><span className="font-semibold text-[#2F3E4E]">Net {SAMPLE.dueTerm}</span></div>
              </div>
            </div>

            {/* Line items */}
            <div className="rounded-lg border border-[#D9E1E8] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#f4f6f8]">
                    <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-[#7A8F79]">Date Worked</th>
                    <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-[#7A8F79]">Plan</th>
                    <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-[#7A8F79] hidden sm:table-cell">Description</th>
                    <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-[#7A8F79]">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE.entries.map((e, i) => (
                    <tr key={i} className={`border-t border-[#D9E1E8] ${i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}`}>
                      <td className="px-3 py-1.5 font-semibold text-[#2F3E4E]">{fmt(e.workDate)}</td>
                      <td className="px-3 py-1.5">
                        <span className="bg-[#2F3E4E] text-white text-[9px] font-bold px-2 py-0.5 rounded">{e.invoiceFeePlan}</span>
                      </td>
                      <td className="px-3 py-1.5 text-[#7A8F79] hidden sm:table-cell">{FEE_LABELS[e.invoiceFeePlan] || e.invoiceFeePlan}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-[#2F3E4E]">{currency(e.invoiceFeeAmt)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#2F3E4E] bg-[#f4f6f8]">
                    <td colSpan={3} className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-[#7A8F79]">Invoice Total</td>
                    <td className="px-3 py-2 text-right text-base font-black text-[#2F3E4E]">{currency(totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Payment history */}
            <div className="rounded-lg border border-[#D9E1E8] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-green-50">
                    <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-green-700">Receipt #</th>
                    <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-green-700">Date</th>
                    <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-green-700">Method</th>
                    <th className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-green-700">Note</th>
                    <th className="text-right px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-green-700">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE.payments.map((p, i) => (
                    <tr key={p.id} className={`border-t border-[#D9E1E8] ${i % 2 === 0 ? 'bg-white' : 'bg-green-50/30'}`}>
                      <td className="px-3 py-1.5 font-mono text-[#7A8F79]">{p.receiptNumber}</td>
                      <td className="px-3 py-1.5 text-[#2F3E4E]">{fmt(p.appliedAt)}</td>
                      <td className="px-3 py-1.5 text-[#7A8F79]">{p.method || '—'}</td>
                      <td className="px-3 py-1.5 text-[#7A8F79] italic">{p.note || '—'}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-green-600">-{currency(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-green-600 bg-green-50">
                    <td colSpan={4} className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-green-700">Balance Due</td>
                    <td className="px-3 py-2 text-right text-base font-black text-red-500">{currency(balance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Notes */}
            <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg px-4 py-2">
              <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wide mb-0.5">Note</p>
              <p className="text-xs text-amber-900">{SAMPLE.notes}</p>
            </div>

            {/* Payment methods */}
            <div className="border border-[#D9E1E8] rounded-lg px-4 py-2.5">
              <p className="text-[8px] font-bold uppercase tracking-widest text-[#7A8F79] mb-2">How to Pay</p>

              {/* Screen: small inline buttons */}
              <div className="no-print flex flex-wrap gap-2 mb-2">
                <a href="#" className="text-xs font-bold bg-[#3D95CE] text-white px-3 py-1.5 rounded-lg">Venmo · @AlexMcGann</a>
                <a href="#" className="text-xs font-bold bg-[#00D632] text-white px-3 py-1.5 rounded-lg">Cash App · $myInvoiceCHC</a>
                <a href="#" className="text-xs font-bold bg-[#6D1ED4] text-white px-3 py-1.5 rounded-lg">Zelle · billing@cominghomecare.com</a>
                <a href="#" className="text-xs font-bold bg-black text-white px-3 py-1.5 rounded-lg">Apple Pay · billing@cominghomecare.com</a>
              </div>

              {/* Print: 3-col — text | Zelle QR | text */}
              <div className="hidden print:flex items-start gap-6 mb-2">
                <div className="text-xs text-[#2F3E4E] space-y-0.5 pt-1">
                  <p><strong>Venmo</strong> @AlexMcGann</p>
                  <p><strong>Cash App</strong> $myInvoiceCHC</p>
                  <p><strong>Apple Pay</strong> billing@cominghomecare.com</p>
                </div>
                <div className="flex flex-col items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/zelle_qr.png" alt="Zelle QR" className="w-20 h-20 rounded" />
                  <p className="text-[8px] text-[#6D1ED4] font-bold mt-0.5">Scan · Zelle</p>
                  <p className="text-[7px] text-[#7A8F79]">billing@cominghomecare.com</p>
                </div>
              </div>

              <p className="text-[9px] text-[#7A8F79]">
                Please include <strong>{shortNum}</strong> as your payment note.
              </p>
            </div>

            <p className="text-[9px] text-center text-[#7A8F79] pt-2 border-t border-[#D9E1E8]">
              Coming Home Care Services, LLC · Questions? billing@cominghomecare.com
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
