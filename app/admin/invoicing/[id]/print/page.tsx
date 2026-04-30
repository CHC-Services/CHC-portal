'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { fmtPhone } from '../../../../../lib/formatPhone'
import { shortInvoiceNumber } from '../../../../../lib/formatInvoice'

type Entry = { workDate: string; invoiceFeePlan?: string; invoiceFeeAmt?: number }
type Payment = { id: string; receiptNumber: string; amount: number; method?: string; note?: string; s3Key?: string; appliedAt: string }
type Invoice = {
  invoiceNumber: string
  nurseName: string
  nurseEmail: string
  totalAmount: number
  paidAmount: number
  status: string
  dueTerm: string
  dueDate: string
  sentAt: string
  paidAt?: string
  notes?: string
  entries: Entry[]
  payments: Payment[]
  nurse?: { displayName: string; accountNumber?: string; firstName?: string; lastName?: string; address?: string; city?: string; state?: string; zip?: string; phone?: string; hasBusinessProvider?: boolean; bizEntityName?: string; bizServiceAddress?: string; bizPhone?: string; bizEmail?: string; user?: { email: string } }
}

const FEE_LABELS: Record<string, string> = {
  A1: 'Medicaid — Single Payer',
  A2: 'Commercial — Single Payer',
  B:  'Dual Payer',
  C:  '3+ Payer',
}

function fmt(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
function currency(n: number) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/admin/invoices/${id}`, { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null }
        if (!r.ok) throw new Error('Not found')
        return r.json()
      })
      .then(data => {
        if (data) {
          setInvoice(data)
          setTimeout(() => window.print(), 400)
        }
      })
      .catch(() => setError('Invoice not found'))
      .finally(() => setLoading(false))
  }, [id, router])

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>
  if (error || !invoice) return <div className="p-8 text-red-500">{error || 'Invoice not found'}</div>

  const balance = invoice.totalAmount - (invoice.paidAmount || 0)
  const displayName = invoice.nurse?.displayName || invoice.nurseName
  const email = invoice.nurse?.user?.email || invoice.nurseEmail
  const accountNumber = invoice.nurse?.accountNumber
  const shortNum = shortInvoiceNumber(invoice.invoiceNumber)

  const STATUS_COLOR: Record<string, string> = {
    Paid: '#16a34a', Partial: '#d97706', Sent: '#2563eb',
    Disputed: '#dc2626', WrittenOff: '#6b7280', Overdue: '#ea580c', Pending: '#2563eb',
  }
  const statusColor = STATUS_COLOR[invoice.status] || '#6b7280'

  const venmoUrl   = `https://venmo.com/AlexMcGann?txn=pay&amount=${balance.toFixed(2)}&note=${encodeURIComponent(shortNum)}`
  const cashappUrl = `https://cash.app/$myInvoiceCHC/${balance.toFixed(2)}?note=${encodeURIComponent(shortNum)}`
  const appleUrl   = 'https://applepay.apple.com/person/support@cominghomecare.com'

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
        <span className="text-sm font-semibold text-[#D9E1E8]">{shortNum}</span>
        <div className="flex-1" />
        <button onClick={() => window.print()} className="bg-[#7A8F79] hover:bg-[#657a64] text-white text-sm font-semibold px-5 py-2 rounded-lg transition">
          🖨 Print / Save as PDF
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
                <p className="text-[10px] text-[#D9E1E8] mt-0.5">support@cominghomecare.com · cominghomecare.com</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[9px] text-[#7A8F79] font-semibold">Invoice #</p>
              <p className="text-base font-black text-white font-mono">{shortNum}</p>
              <span className="inline-block mt-0.5 text-[9px] font-black px-2 py-0.5 rounded-full"
                style={{ background: `${statusColor}22`, color: statusColor }}>
                {invoice.status}
              </span>
            </div>
          </div>

          <div className="px-6 py-4 space-y-3">

            {/* Bill To / Invoice Info — flat row */}
            <div className="flex justify-between items-start pb-3 border-b border-[#D9E1E8]">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-widest text-[#7A8F79] mb-1">Bill To</p>
                {invoice.nurse?.hasBusinessProvider ? (
                  <>
                    <p className="font-bold text-sm text-[#2F3E4E]">{invoice.nurse.bizEntityName || displayName}</p>
                    {invoice.nurse.bizServiceAddress && <p className="text-xs text-[#7A8F79]">{invoice.nurse.bizServiceAddress}</p>}
                    {invoice.nurse.bizPhone && <p className="text-xs text-[#7A8F79]">{fmtPhone(invoice.nurse.bizPhone)}</p>}
                    {invoice.nurse.bizEmail && <p className="text-xs text-[#7A8F79]">{invoice.nurse.bizEmail}</p>}
                  </>
                ) : (
                  <>
                    <p className="font-bold text-sm text-[#2F3E4E]">
                      {invoice.nurse?.firstName && invoice.nurse?.lastName
                        ? `${invoice.nurse.firstName} ${invoice.nurse.lastName}`
                        : displayName}
                    </p>
                    {invoice.nurse?.address && <p className="text-xs text-[#7A8F79]">{invoice.nurse.address}</p>}
                    {(invoice.nurse?.city || invoice.nurse?.state || invoice.nurse?.zip) && (
                      <p className="text-xs text-[#7A8F79]">
                        {[invoice.nurse.city, invoice.nurse.state].filter(Boolean).join(', ')}{invoice.nurse.zip ? ` ${invoice.nurse.zip}` : ''}
                      </p>
                    )}
                    {invoice.nurse?.phone && <p className="text-xs text-[#7A8F79]">{fmtPhone(invoice.nurse.phone)}</p>}
                    <p className="text-xs text-[#7A8F79]">{email}</p>
                  </>
                )}
                {accountNumber && <p className="text-[10px] font-mono text-[#7A8F79] mt-0.5">Acct: {accountNumber}</p>}
              </div>
              <div className="text-right space-y-1">
                <div className="text-xs">
                  <span className="text-[#7A8F79]">Issued </span>
                  <span className="font-semibold text-[#2F3E4E]">{fmt(invoice.sentAt)}</span>
                </div>
                <div className="text-xs">
                  <span className="text-[#7A8F79]">Due </span>
                  <span className={`font-semibold ${balance > 0 && new Date(invoice.dueDate) < new Date() ? 'text-red-500' : 'text-[#2F3E4E]'}`}>
                    {fmt(invoice.dueDate)}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-[#7A8F79]">Terms </span>
                  <span className="font-semibold text-[#2F3E4E]">Net {invoice.dueTerm}</span>
                </div>
                {invoice.paidAt && (
                  <div className="text-xs">
                    <span className="text-[#7A8F79]">Paid </span>
                    <span className="font-semibold text-green-600">{fmt(invoice.paidAt)}</span>
                  </div>
                )}
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
                  {invoice.entries.map((e, i) => (
                    <tr key={i} className={`border-t border-[#D9E1E8] ${i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}`}>
                      <td className="px-3 py-1.5 font-semibold text-[#2F3E4E]">{fmt(e.workDate)}</td>
                      <td className="px-3 py-1.5">
                        <span className="bg-[#2F3E4E] text-white text-[9px] font-bold px-2 py-0.5 rounded">
                          {e.invoiceFeePlan || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-[#7A8F79] hidden sm:table-cell">
                        {e.invoiceFeePlan ? (FEE_LABELS[e.invoiceFeePlan] || e.invoiceFeePlan) : ''}
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold text-[#2F3E4E]">
                        {currency(e.invoiceFeeAmt || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#2F3E4E] bg-[#f4f6f8]">
                    <td colSpan={3} className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-[#7A8F79]">Invoice Total</td>
                    <td className="px-3 py-2 text-right text-base font-black text-[#2F3E4E]">{currency(invoice.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Payment history */}
            {invoice.payments && invoice.payments.length > 0 && (
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
                    {invoice.payments.map((p, i) => (
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
                      <td colSpan={4} className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-green-700">
                        {balance <= 0 ? 'Paid in Full' : 'Balance Due'}
                      </td>
                      <td className={`px-3 py-2 text-right text-base font-black ${balance <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {currency(balance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg px-4 py-2">
                <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wide mb-0.5">Note</p>
                <p className="text-xs text-amber-900">{invoice.notes}</p>
              </div>
            )}

            {/* Payment methods */}
            {balance > 0 && (
              <div className="border border-[#D9E1E8] rounded-lg px-4 py-2.5">
                <p className="text-[8px] font-bold uppercase tracking-widest text-[#7A8F79] mb-2">How to Pay</p>

                {/* Screen: small inline buttons */}
                <div className="no-print flex flex-wrap gap-2 mb-2">
                  <a href={venmoUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold bg-[#3D95CE] text-white px-3 py-1.5 rounded-lg hover:bg-[#2d7fb8] transition">
                    Venmo · @AlexMcGann
                  </a>
                  <a href={cashappUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold bg-[#00D632] text-white px-3 py-1.5 rounded-lg hover:bg-[#00b82b] transition">
                    Cash App · $myInvoiceCHC
                  </a>
                  <a href="mailto:support@cominghomecare.com" target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold bg-[#6D1ED4] text-white px-3 py-1.5 rounded-lg hover:bg-[#5a19b0] transition">
                    Zelle · support@cominghomecare.com
                  </a>
                  <a href={appleUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold bg-black text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                    Apple Pay · support@cominghomecare.com
                  </a>
                </div>

                {/* Print: compact 2-col text */}
                <div className="hidden print:grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-[#2F3E4E] mb-2">
                  <p><strong>Venmo</strong> @AlexMcGann</p>
                  <p><strong>Zelle</strong> Alex McGann<br/> support@cominghomecare.com</p>
                  <p><strong>Cash App</strong> $myInvoiceCHC</p>
                  <p><strong>Apple Pay</strong> support@cominghomecare.com</p>
                </div>

                <p className="text-[9px] text-[#7A8F79]">
                  Please include <strong>{shortNum}</strong> as your payment note.
                </p>
              </div>
            )}

            <p className="text-[9px] text-center text-[#7A8F79] pt-2 border-t border-[#D9E1E8]">
              Coming Home Care Services, LLC · Questions? support@cominghomecare.com
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
