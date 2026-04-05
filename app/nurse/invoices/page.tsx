'use client'

import { useEffect, useState } from 'react'
import PortalMessages from '../../components/PortalMessages'

const STATUS_COLORS: Record<string, string> = {
  Pending:   'bg-yellow-100 text-yellow-800',
  Paid:      'bg-green-100 text-green-800',
  Overdue:   'bg-red-100 text-red-800',
  Cancelled: 'bg-gray-100 text-gray-500',
}

const FEE_PLAN_LABELS: Record<string, string> = {
  A1: 'Medicaid — Single Payer',
  A2: 'Commercial — Single Payer',
  B:  'Dual Payer',
  C:  '3+ Payer',
}

type Entry = {
  workDate: string
  hours: number
  invoiceFeePlan: string
  invoiceFeeAmt: number
}

type Invoice = {
  id: string
  invoiceNumber: string
  totalAmount: number
  dueTerm: string
  dueDate: string
  status: string
  notes?: string
  sentAt: string
  paidAt?: string
  entries: Entry[]
}

// Deep-link builders — amount in dollars, note is the invoice number
function venmoLink(amount: number, note: string) {
  return `https://venmo.com/AlexMcGann?txn=pay&amount=${amount.toFixed(2)}&note=${encodeURIComponent(note)}`
}
function cashAppLink(amount: number, note: string) {
  return `https://cash.app/$myInvoiceCHC/${amount.toFixed(2)}?note=${encodeURIComponent(note)}`
}
function applePayLink() {
  // Apple Cash personal link — opens Wallet on iPhone
  return `https://applepay.apple.com/person/support@cominghomecare.com`
}

export default function NurseInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/nurse/invoices', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setInvoices(d) })
      .finally(() => setLoading(false))
  }, [])

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  const fmtMoney = (n: number) => `$${n.toFixed(2)}`

  if (loading) return <div className="p-8 text-[#7A8F79]">Loading…</div>

  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">

      <div className="max-w-3xl mx-auto">

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#2F3E4E]">
            <span className="text-[#7A8F79] italic">my</span>Invoices
          </h1>
          <p className="text-sm text-[#7A8F79] mt-1">Your billing statements from Coming Home Care Services, LLC.</p>
        </div>

        <PortalMessages priority="Invoices" />

      <div className="space-y-4">
        {invoices.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-[#7A8F79] text-sm">No invoices yet.</p>
          </div>
        ) : invoices.map(inv => (
          <div key={inv.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">

            {/* Invoice header row */}
            <button
              className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-[#f9fafb] transition"
              onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}
            >
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#7A8F79] uppercase tracking-widest">Invoice</p>
                  <p className="text-lg font-bold text-[#2F3E4E]">{inv.invoiceNumber}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {inv.status}
                </span>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[#2F3E4E]">{fmtMoney(inv.totalAmount)}</p>
                <p className="text-xs text-[#7A8F79]">
                  {inv.dueTerm === 'ASAP' ? 'Due Immediately' : `Due ${fmt(inv.dueDate)}`}
                </p>
              </div>
            </button>

            {/* Expanded detail */}
            {expanded === inv.id && (
              <div className="border-t border-[#D9E1E8] px-6 pb-6 pt-4 space-y-5">

                {/* Dates */}
                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="text-xs text-[#7A8F79] uppercase tracking-widest font-semibold">Issued</p>
                    <p className="text-[#2F3E4E] font-semibold">{fmt(inv.sentAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7A8F79] uppercase tracking-widest font-semibold">Due</p>
                    <p className="text-[#2F3E4E] font-semibold">
                      {inv.dueTerm === 'ASAP' ? 'Immediately' : fmt(inv.dueDate)}
                    </p>
                  </div>
                  {inv.paidAt && (
                    <div>
                      <p className="text-xs text-[#7A8F79] uppercase tracking-widest font-semibold">Paid</p>
                      <p className="text-green-700 font-semibold">{fmt(inv.paidAt)}</p>
                    </div>
                  )}
                </div>

                {/* Line items */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-2">Services</p>
                  <div className="rounded-xl overflow-hidden border border-[#D9E1E8]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#f4f6f8]">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-[#7A8F79] uppercase tracking-wide">Date</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-[#7A8F79] uppercase tracking-wide">Plan</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-[#7A8F79] uppercase tracking-wide hidden sm:table-cell">Description</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[#7A8F79] uppercase tracking-wide">Fee</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inv.entries.map((e, i) => (
                          <tr key={i} className="border-t border-[#D9E1E8]">
                            <td className="px-4 py-2.5 text-[#2F3E4E] font-semibold">{fmt(e.workDate)}</td>
                            <td className="px-4 py-2.5">
                              <span className="bg-[#2F3E4E] text-white text-xs font-bold px-2 py-0.5 rounded">{e.invoiceFeePlan}</span>
                            </td>
                            <td className="px-4 py-2.5 text-[#4a5a6a] hidden sm:table-cell">{FEE_PLAN_LABELS[e.invoiceFeePlan] || e.invoiceFeePlan}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-[#2F3E4E]">{fmtMoney(e.invoiceFeeAmt)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-[#2F3E4E] bg-[#f4f6f8]">
                          <td colSpan={3} className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#7A8F79]">Total Due</td>
                          <td className="px-4 py-3 text-right text-xl font-black text-[#2F3E4E]">{fmtMoney(inv.totalAmount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {inv.notes && (
                  <div className="bg-[#f4f6f8] border-l-4 border-[#7A8F79] rounded-r-lg px-4 py-3">
                    <p className="text-xs text-[#4a5a6a]"><strong>Note:</strong> {inv.notes}</p>
                  </div>
                )}

                {/* Payment methods — only show if not paid */}
                {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                  <div className="bg-[#f4f6f8] rounded-xl p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-3">Tap to Pay</p>
                    <div className="flex flex-wrap gap-3">

                      {/* Venmo */}
                      <a
                        href={venmoLink(inv.totalAmount, inv.invoiceNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-[#3D95CE] hover:bg-[#2d7fb8] text-white font-bold text-sm px-4 py-2.5 rounded-xl transition shadow-sm"
                        title={`Pay via Venmo · @AlexMcGann`}
                      >
                        {/* Venmo logo */}
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                          <path d="M19.04 2c.76 1.27 1.1 2.58 1.1 4.23 0 5.27-4.5 12.11-8.16 16.92H4.22L1 4.01l6.77-.65 1.73 13.92c1.6-2.68 3.58-6.9 3.58-9.77 0-1.57-.27-2.64-.68-3.51H19.04z"/>
                        </svg>
                        Venmo
                      </a>

                      {/* Cash App */}
                      <a
                        href={cashAppLink(inv.totalAmount, inv.invoiceNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-[#00D632] hover:bg-[#00b82b] text-white font-bold text-sm px-4 py-2.5 rounded-xl transition shadow-sm"
                        title={`Pay via Cash App · $myInvoiceCHC`}
                      >
                        {/* Cash App logo */}
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                          <path d="M13.567 7.9c.84.23 1.62.69 2.19 1.35l1.67-1.67a6.42 6.42 0 00-3.86-1.88V4h-2v1.72c-2.3.4-3.97 2.06-3.97 4.13 0 2.37 1.85 3.38 3.97 3.93v3.37c-.9-.18-1.74-.64-2.36-1.32L7.4 17.5a6.5 6.5 0 004.16 1.78V21h2v-1.73c2.34-.37 4.03-2.05 4.03-4.2 0-2.44-1.91-3.47-4.03-4v-3.17zm-2 0V5.77c-.88.26-1.47 1-1.47 1.85 0 .8.5 1.35 1.47 1.65v-3.37zm2 8.27c.92-.27 1.53-1.03 1.53-1.9 0-.83-.52-1.4-1.53-1.72v3.62z"/>
                        </svg>
                        Cash App
                      </a>

                      {/* Apple Pay */}
                      <a
                        href={applePayLink()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition shadow-sm"
                        title="Pay via Apple Cash"
                      >
                        {/* Apple logo */}
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                        </svg>
                        Apple Pay
                      </a>

                    </div>
                    <p className="text-[10px] text-[#7A8F79] mt-3 leading-relaxed">
                      Include <strong>{inv.invoiceNumber}</strong> as your payment note. Amount: <strong>${inv.totalAmount.toFixed(2)}</strong>.
                      Questions? Email <a href="mailto:support@cominghomecare.com" className="underline">support@cominghomecare.com</a>
                    </p>
                    {inv.totalAmount >= 50 && (
                      <p className="text-xs text-[#7A8F79] mt-1">
                        Credit card payments accepted for invoices of $50.00 or more — contact us at support@cominghomecare.com.
                      </p>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}
