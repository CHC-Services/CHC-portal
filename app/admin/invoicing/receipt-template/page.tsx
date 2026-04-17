'use client'

import { useState } from 'react'

// ── Sample data ───────────────────────────────────────────────────────────────
const SAMPLE = {
  receiptNumber:  'RCT-2026-0007',
  invoiceNumber:  'CHC-2026-0042',
  nurseName:      'Jane R. Sample, RN',
  firstName:      'Jane',
  lastName:       'Sample, RN',
  email:          'jane.sample@example.com',
  accountNumber:  'CHC-00099',
  paymentAmount:  270.00,
  paymentMethod:  'Venmo',
  paymentNote:    'INV-CHC-2026-0042',
  appliedAt:      'Apr 16, 2026',
  invoiceTotal:   765.00,
  previouslyPaid: 0,
  newTotalPaid:   270.00,
  balance:        495.00,
  newStatus:      'Partial' as 'Paid' | 'Partial',
}

function currency(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ReceiptTemplatePage() {
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<'idle' | 'ok' | 'err'>('idle')

  async function sendPreview() {
    setSending(true)
    setSendStatus('idle')
    try {
      const res = await fetch('/api/admin/invoices/send-receipt-preview', {
        method: 'POST',
        credentials: 'include',
      })
      setSendStatus(res.ok ? 'ok' : 'err')
    } catch {
      setSendStatus('err')
    } finally {
      setSending(false)
      setTimeout(() => setSendStatus('idle'), 4000)
    }
  }

  const isPaidInFull = SAMPLE.newStatus === 'Paid' || SAMPLE.balance <= 0
  const stripeColor = isPaidInFull ? '#16a34a' : '#2563eb'

  return (
    <>
      <style>{`
        @media print {
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          .fixed { display: none !important; }
          footer { display: none !important; }
          .page-wrap { padding: 0 !important; }
          .no-print { display: none !important; }
          .print-outer { padding-top: 0 !important; background: white !important; }
          .receipt-wrap { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; max-width: 100% !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print fixed top-0 left-0 right-0 bg-[#2F3E4E] text-white px-6 py-3 flex items-center gap-4 z-50 shadow-lg">
        <span className="text-sm font-semibold text-[#D9E1E8]">Receipt Template Preview</span>
        <span className="text-xs text-[#7A8F79] bg-[#7A8F79]/20 px-2 py-0.5 rounded-full font-semibold">SAMPLE DATA</span>
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
          {sending              ? '⏳ Sending…'          :
           sendStatus === 'ok'  ? '✓ Sent to support@'   :
           sendStatus === 'err' ? '✕ Send failed'        :
           '📧 Email Preview'}
        </button>
        <button
          onClick={() => window.print()}
          className="bg-[#7A8F79] hover:bg-[#657a64] text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
        >
          🖨 Print Preview
        </button>
        <button onClick={() => window.close()} className="text-[#D9E1E8] hover:text-white text-sm transition">
          ✕ Close
        </button>
      </div>

      <div className="print-outer pt-14 min-h-screen bg-gray-100">
        <div className="receipt-wrap max-w-[680px] mx-auto my-8 bg-white shadow-xl rounded-xl overflow-hidden">

          {/* Header */}
          <div className="bg-[#2F3E4E] px-8 py-6 flex justify-between items-center">
            <div className="bg-white rounded-lg px-3 py-2 flex-shrink-0">
              <img src="/chc_logo.png" alt="Coming Home Care" className="h-12 w-auto block" />
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-[#7A8F79] font-semibold uppercase tracking-widest">Receipt</p>
              <p className="text-xl font-black text-white font-mono mt-1">{SAMPLE.receiptNumber}</p>
              <p className="text-[11px] text-[#7A8F79] mt-1">Invoice {SAMPLE.invoiceNumber}</p>
            </div>
          </div>

          {/* Payment stripe */}
          <div className="flex items-center justify-between px-8 py-4" style={{ background: stripeColor }}>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <span className="text-white text-sm font-bold uppercase tracking-wide">
                {isPaidInFull ? 'Paid in Full' : 'Payment Received'}
              </span>
            </div>
            <span className="text-white text-2xl font-black">{currency(SAMPLE.paymentAmount)}</span>
          </div>

          <div className="px-8 py-6 space-y-6">

            {/* Provider + Payment Details */}
            <div className="grid grid-cols-2 gap-6 border-b border-[#D9E1E8] pb-6">
              <div className="bg-[#F4F6F5] rounded-xl p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#7A8F79] mb-2">Provider</p>
                <p className="font-bold text-[#2F3E4E]">{SAMPLE.firstName} {SAMPLE.lastName}</p>
                <p className="text-sm text-[#7A8F79]">{SAMPLE.email}</p>
                <p className="text-xs font-mono text-[#7A8F79] mt-0.5">Acct: {SAMPLE.accountNumber}</p>
              </div>
              <div className="bg-[#F4F6F5] rounded-xl p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#7A8F79] mb-2">Payment Info</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#7A8F79]">Applied</span>
                    <span className="font-semibold text-[#2F3E4E]">{SAMPLE.appliedAt}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7A8F79]">Method</span>
                    <span className="font-semibold text-[#2F3E4E]">{SAMPLE.paymentMethod}</span>
                  </div>
                  {SAMPLE.paymentNote && (
                    <div className="flex justify-between">
                      <span className="text-[#7A8F79]">Note</span>
                      <span className="font-semibold text-[#2F3E4E] italic">{SAMPLE.paymentNote}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Invoice Summary */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#7A8F79] mb-3">Invoice Summary</p>
              <div className="rounded-xl border border-[#D9E1E8] overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-[#D9E1E8]">
                      <td className="px-4 py-3 text-[#7A8F79]">Invoice Total</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#2F3E4E]">{currency(SAMPLE.invoiceTotal)}</td>
                    </tr>
                    {SAMPLE.previouslyPaid > 0 && (
                      <tr className="border-b border-[#D9E1E8]">
                        <td className="px-4 py-3 text-[#7A8F79]">Previously Paid</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600">−{currency(SAMPLE.previouslyPaid)}</td>
                      </tr>
                    )}
                    <tr className="border-b-2 border-[#2F3E4E] bg-[#fafbfc]">
                      <td className="px-4 py-3 font-bold text-[#2F3E4E]">This Payment</td>
                      <td className="px-4 py-3 text-right text-base font-black text-[#2F3E4E]">−{currency(SAMPLE.paymentAmount)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-[#7A8F79]">Remaining Balance</td>
                      <td className={`px-4 py-4 text-right text-2xl font-black ${isPaidInFull ? 'text-green-600' : 'text-red-500'}`}>
                        {currency(SAMPLE.balance)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Status banner */}
            {isPaidInFull ? (
              <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-center">
                <p className="text-green-700 font-bold text-sm">✓ Invoice Paid in Full — Thank You!</p>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3">
                <p className="text-blue-700 text-sm">
                  Remaining balance of <strong>{currency(SAMPLE.balance)}</strong> is due on the original invoice terms.
                </p>
              </div>
            )}

            <p className="text-[10px] text-center text-[#7A8F79] pt-2 border-t border-[#D9E1E8]">
              Coming Home Care Services, LLC · This receipt is your proof of payment. Questions? Email support@cominghomecare.com
            </p>
          </div>

        </div>
      </div>
    </>
  )
}
