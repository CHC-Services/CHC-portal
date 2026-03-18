'use client'

import { useEffect, useState } from 'react'

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

const PAYMENT_METHODS = [
  { label: '💚 Venmo',     value: '@AlexMcGann' },
  { label: '💚 Zelle',     value: 'support@cominghomecare.com' },
  { label: '💚 CashApp',   value: '$myInvoiceCHC' },
  { label: '🍎 Apple Pay', value: 'support@cominghomecare.com' },
]

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

      {/* Hero */}
      <div className="bg-[#2F3E4E] rounded-2xl px-6 py-8 mb-8 max-w-3xl">
        <p className="text-[#7A8F79] text-xs font-semibold uppercase tracking-widest mb-1">Billing</p>
        <h1 className="text-2xl font-bold text-white">myInvoices</h1>
        <p className="text-sm text-[#D9E1E8] mt-1">Your billing statements from Coming Home Care Services, LLC.</p>
      </div>

      <div className="max-w-3xl space-y-4">
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
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-3">How to Pay</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_METHODS.map(m => (
                        <div key={m.label} className="bg-white rounded-lg px-3 py-2.5 border border-[#D9E1E8]">
                          <p className="text-xs font-bold text-[#2F3E4E]">{m.label}</p>
                          <p className="text-xs text-[#7A8F79] mt-0.5">{m.value}</p>
                        </div>
                      ))}
                    </div>
                    {inv.totalAmount >= 50 && (
                      <p className="text-xs text-[#7A8F79] mt-3">
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
  )
}
