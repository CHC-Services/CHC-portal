'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

type Entry = { workDate: string; invoiceFeePlan?: string; invoiceFeeAmt?: number }
type Payment = { id: string; amount: number; method?: string; note?: string; appliedAt: string }
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
  nurse?: { displayName: string; accountNumber?: string; user?: { email: string } }
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
      .then(data => { if (data) setInvoice(data) })
      .catch(() => setError('Invoice not found'))
      .finally(() => setLoading(false))
  }, [id, router])

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>
  if (error || !invoice) return <div className="p-8 text-red-500">{error || 'Invoice not found'}</div>

  const balance = invoice.totalAmount - (invoice.paidAmount || 0)
  const displayName = invoice.nurse?.displayName || invoice.nurseName
  const email = invoice.nurse?.user?.email || invoice.nurseEmail
  const accountNumber = invoice.nurse?.accountNumber

  const STATUS_COLOR: Record<string, string> = {
    Paid: '#16a34a', Partial: '#d97706', Sent: '#2563eb',
    Disputed: '#dc2626', WrittenOff: '#6b7280', Overdue: '#ea580c', Pending: '#2563eb',
  }
  const statusColor = STATUS_COLOR[invoice.status] || '#6b7280'

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          .invoice-wrap { box-shadow: none !important; }
        }
        @page { margin: 1.5cm; }
      `}</style>

      {/* Print/email controls */}
      <div className="no-print fixed top-0 left-0 right-0 bg-[#2F3E4E] text-white px-6 py-3 flex items-center gap-4 z-50 shadow-lg">
        <span className="text-sm font-semibold text-[#D9E1E8]">{invoice.invoiceNumber}</span>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="bg-[#7A8F79] hover:bg-[#657a64] text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
        >
          🖨 Print / Save as PDF
        </button>
        <button
          onClick={() => {
            fetch(`/api/admin/invoices/${id}/s3`, { method: 'POST', credentials: 'include' })
              .then(r => r.json())
              .then(d => { if (d.url) alert('Saved to S3. Download link copied.') })
          }}
          className="bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
        >
          ☁️ Save to S3
        </button>
        <button
          onClick={() => window.close()}
          className="text-[#D9E1E8] hover:text-white text-sm transition"
        >
          ✕ Close
        </button>
      </div>

      <div className="pt-14 min-h-screen bg-gray-100">
        <div className="invoice-wrap max-w-[720px] mx-auto my-8 bg-white shadow-xl rounded-xl overflow-hidden p-0">

          {/* Header */}
          <div className="bg-[#2F3E4E] px-8 py-6 flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79]">Invoice</p>
              <h1 className="text-2xl font-black text-white mt-0.5">Coming Home Care Services, LLC</h1>
              <p className="text-xs text-[#D9E1E8] mt-1">support@cominghomecare.com · cominghomecare.com</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#7A8F79] font-semibold">Invoice #</p>
              <p className="text-lg font-black text-white font-mono">{invoice.invoiceNumber}</p>
              <span
                className="inline-block mt-1 text-[10px] font-black px-3 py-0.5 rounded-full"
                style={{ background: `${statusColor}22`, color: statusColor }}
              >
                {invoice.status}
              </span>
            </div>
          </div>

          <div className="px-8 py-6 space-y-6">

            {/* Bill To / Invoice Info */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-[#F4F6F5] rounded-xl p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#7A8F79] mb-2">Bill To</p>
                <p className="font-bold text-[#2F3E4E]">{displayName}</p>
                <p className="text-sm text-[#7A8F79]">{email}</p>
                {accountNumber && <p className="text-xs font-mono text-[#7A8F79] mt-0.5">Acct: {accountNumber}</p>}
              </div>
              <div className="bg-[#F4F6F5] rounded-xl p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#7A8F79] mb-2">Invoice Details</p>
                <div className="space-y-0.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#7A8F79]">Issued</span>
                    <span className="font-semibold text-[#2F3E4E]">{fmt(invoice.sentAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7A8F79]">Due</span>
                    <span className={`font-semibold ${balance > 0 && new Date(invoice.dueDate) < new Date() ? 'text-red-500' : 'text-[#2F3E4E]'}`}>
                      {fmt(invoice.dueDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7A8F79]">Terms</span>
                    <span className="font-semibold text-[#2F3E4E]">Net {invoice.dueTerm}</span>
                  </div>
                  {invoice.paidAt && (
                    <div className="flex justify-between">
                      <span className="text-[#7A8F79]">Paid</span>
                      <span className="font-semibold text-green-600">{fmt(invoice.paidAt)}</span>
                    </div>
                  )}
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
                  {invoice.entries.map((e, i) => (
                    <tr key={i} className={`border-t border-[#D9E1E8] ${i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}`}>
                      <td className="px-4 py-2.5 font-semibold text-[#2F3E4E]">{fmt(e.workDate)}</td>
                      <td className="px-4 py-2.5">
                        <span className="bg-[#2F3E4E] text-white text-[10px] font-bold px-2 py-0.5 rounded">
                          {e.invoiceFeePlan || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[#7A8F79] hidden sm:table-cell">
                        {e.invoiceFeePlan ? (FEE_LABELS[e.invoiceFeePlan] || e.invoiceFeePlan) : ''}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#2F3E4E]">
                        {currency(e.invoiceFeeAmt || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#2F3E4E] bg-[#f4f6f8]">
                    <td colSpan={3} className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#7A8F79]">Invoice Total</td>
                    <td className="px-4 py-3 text-right text-xl font-black text-[#2F3E4E]">{currency(invoice.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Payment history */}
            {invoice.payments && invoice.payments.length > 0 && (
              <div className="rounded-xl border border-[#D9E1E8] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-green-50">
                      <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-green-700">Payment Date</th>
                      <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-green-700">Method</th>
                      <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-green-700">Note</th>
                      <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-green-700">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((p, i) => (
                      <tr key={p.id} className={`border-t border-[#D9E1E8] ${i % 2 === 0 ? 'bg-white' : 'bg-green-50/30'}`}>
                        <td className="px-4 py-2 text-[#2F3E4E]">{fmt(p.appliedAt)}</td>
                        <td className="px-4 py-2 text-[#7A8F79]">{p.method || '—'}</td>
                        <td className="px-4 py-2 text-[#7A8F79] italic">{p.note || '—'}</td>
                        <td className="px-4 py-2 text-right font-bold text-green-600">-{currency(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-green-600 bg-green-50">
                      <td colSpan={3} className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-green-700">
                        {balance <= 0 ? 'Paid in Full' : 'Balance Due'}
                      </td>
                      <td className={`px-4 py-2.5 text-right text-xl font-black ${balance <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {currency(balance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-xl px-5 py-3">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-0.5">Note</p>
                <p className="text-sm text-amber-900">{invoice.notes}</p>
              </div>
            )}

            {/* Payment methods */}
            {balance > 0 && (
              <div className="bg-[#F4F6F5] rounded-xl p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8F79] mb-3">Payment Options</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '💚 Venmo',    value: '@AlexMcGann' },
                    { label: '💚 Zelle',    value: 'support@cominghomecare.com' },
                    { label: '💚 CashApp',  value: '$myInvoiceCHC' },
                    { label: '🍎 Apple Pay', value: 'support@cominghomecare.com' },
                  ].map(m => (
                    <div key={m.label} className="bg-white rounded-lg px-3 py-2 border border-[#D9E1E8]">
                      <p className="text-xs font-bold text-[#2F3E4E]">{m.label}</p>
                      <p className="text-xs text-[#7A8F79] mt-0.5">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
