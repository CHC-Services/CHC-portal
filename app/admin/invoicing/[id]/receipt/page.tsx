'use client'

import { useState, useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { shortInvoiceNumber } from '../../../../../lib/formatInvoice'

type Payment = {
  id: string
  receiptNumber: string
  amount: number
  method?: string
  note?: string
  appliedAt: string
  invoiceId: string
}
type Invoice = {
  invoiceNumber: string
  totalAmount: number
  paidAmount: number
  nurseName: string
  nurseEmail: string
  nurse?: {
    displayName: string
    accountNumber?: string
    firstName?: string
    lastName?: string
    user?: { email: string }
  }
}

function currency(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmt(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

function ReceiptPrintInner({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentId = searchParams.get('paymentId')

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!paymentId) {
      setError('No payment specified.')
      setLoading(false)
      return
    }
    Promise.all([
      fetch(`/api/admin/invoices/${id}`, { credentials: 'include' }),
      fetch(`/api/admin/invoices/${id}/payment`, { credentials: 'include' }),
    ])
      .then(async ([invRes, payRes]) => {
        if (invRes.status === 401) { router.push('/login'); return }
        if (!invRes.ok || !payRes.ok) throw new Error('Not found')
        const [inv, payments] = await Promise.all([invRes.json(), payRes.json()])
        const found = (payments as Payment[]).find(p => p.id === paymentId)
        if (!found) throw new Error('Payment not found')
        setInvoice(inv)
        setPayment(found)
        setTimeout(() => window.print(), 400)
      })
      .catch(e => setError(e.message || 'Not found'))
      .finally(() => setLoading(false))
  }, [id, paymentId, router])

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>
  if (error || !invoice || !payment) return <div className="p-8 text-red-500">{error || 'Receipt not found'}</div>

  const displayName = invoice.nurse?.displayName || invoice.nurseName
  const nurseEmail = invoice.nurse?.user?.email || invoice.nurseEmail
  const accountNumber = invoice.nurse?.accountNumber

  // Reconstruct receipt context:
  // paidAmount now reflects the CURRENT total. We need previouslyPaid = paidAmount - this payment
  const newTotalPaid = invoice.paidAmount
  const previouslyPaid = Math.max(0, newTotalPaid - payment.amount)
  const balance = Math.max(0, invoice.totalAmount - newTotalPaid)
  const isPaidInFull = balance <= 0
  const stripeColor = isPaidInFull ? '#16a34a' : '#7A8F79'

  return (
    <>
      <style>{`
        @page { size: letter portrait; margin: 0.5in; }
        @media print {
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          .fixed { display: none !important; }
          footer { display: none !important; }
          .page-wrap { padding: 0 !important; }
          .no-print { display: none !important; }
          .print-outer { padding-top: 0 !important; background: white !important; min-height: unset !important; }
          .receipt-wrap { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; max-width: 100% !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print fixed top-0 left-0 right-0 bg-[#2F3E4E] text-white px-6 py-3 flex items-center gap-4 z-50 shadow-lg">
        <span className="text-sm font-semibold text-[#D9E1E8]">{payment.receiptNumber}</span>
        <span className="text-xs text-[#7A8F79]">for {shortInvoiceNumber(invoice.invoiceNumber)}</span>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="bg-[#7A8F79] hover:bg-[#657a64] text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
        >
          🖨 Print / Save as PDF
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
              <p className="text-xl font-black text-white font-mono mt-1">{payment.receiptNumber}</p>
              <p className="text-[11px] text-[#7A8F79] mt-1">Invoice {shortInvoiceNumber(invoice.invoiceNumber)}</p>
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
            <span className="text-white text-2xl font-black">{currency(payment.amount)}</span>
          </div>

          <div className="px-8 py-6 space-y-6">

            {/* Provider + Payment Details */}
            <div className="grid grid-cols-2 gap-6 border-b border-[#D9E1E8] pb-6">
              <div className="bg-[#F4F6F5] rounded-xl p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#7A8F79] mb-2">Provider</p>
                <p className="font-bold text-[#2F3E4E]">{displayName}</p>
                <p className="text-sm text-[#7A8F79]">{nurseEmail}</p>
                {accountNumber && (
                  <p className="text-xs font-mono text-[#7A8F79] mt-0.5">Acct: {accountNumber}</p>
                )}
              </div>
              <div className="bg-[#F4F6F5] rounded-xl p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#7A8F79] mb-2">Payment Info</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#7A8F79]">Applied</span>
                    <span className="font-semibold text-[#2F3E4E]">{fmt(payment.appliedAt)}</span>
                  </div>
                  {payment.method && (
                    <div className="flex justify-between">
                      <span className="text-[#7A8F79]">Method</span>
                      <span className="font-semibold text-[#2F3E4E]">{payment.method}</span>
                    </div>
                  )}
                  {payment.note && (
                    <div className="flex justify-between">
                      <span className="text-[#7A8F79]">Note</span>
                      <span className="font-semibold text-[#2F3E4E] italic">{payment.note}</span>
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
                      <td className="px-4 py-3 text-right font-semibold text-[#2F3E4E]">{currency(invoice.totalAmount)}</td>
                    </tr>
                    {previouslyPaid > 0 && (
                      <tr className="border-b border-[#D9E1E8]">
                        <td className="px-4 py-3 text-[#7A8F79]">Previously Paid</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600">−{currency(previouslyPaid)}</td>
                      </tr>
                    )}
                    <tr className="border-b-2 border-[#2F3E4E] bg-[#fafbfc]">
                      <td className="px-4 py-3 font-bold text-[#2F3E4E]">This Payment</td>
                      <td className="px-4 py-3 text-right text-base font-black text-[#2F3E4E]">−{currency(payment.amount)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-[#7A8F79]">Remaining Balance</td>
                      <td className={`px-4 py-4 text-right text-2xl font-black ${isPaidInFull ? 'text-green-600' : 'text-red-500'}`}>
                        {currency(balance)}
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
                  Remaining balance of <strong>{currency(balance)}</strong> is due on the original invoice terms.
                </p>
              </div>
            )}

            <p className="text-[10px] text-center text-[#7A8F79] pt-2 border-t border-[#D9E1E8]">
              Coming Home Care Services, LLC · This receipt is your proof of payment.
              Questions? Email support@cominghomecare.com
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default function ReceiptPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading…</div>}>
      <ReceiptPrintInner id={id} />
    </Suspense>
  )
}
