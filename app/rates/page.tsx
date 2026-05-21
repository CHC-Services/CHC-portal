import Link from 'next/link'

export const metadata = {
  title: 'Billing Rate Schedule — Coming Home Care Services',
  description: 'Billing service pricing, weekly maximums, early payment credits, and payment terms for Coming Home Care providers.',
}

export default function RatesPage() {
  return (
    <div className="min-h-screen bg-[#D9E1E8]">

      {/* Header */}
      <div className="bg-[#2F3E4E] px-6 py-8 text-white text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-2">Coming Home Care Services, LLC</p>
        <h1 className="text-3xl font-bold">Billing Rate Schedule</h1>
        <p className="text-sm text-white/60 mt-2">Effective pricing for independent provider billing services</p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* Rate Table */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D9E1E8]">
            <h2 className="text-base font-bold text-[#2F3E4E]">Per-Claim Fee Schedule</h2>
            <p className="text-xs text-[#7A8F79] mt-0.5">Fees are charged per date of service (DOS) submitted for billing</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#2F3E4E] text-white text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Plan Type</th>
                  <th className="text-center px-5 py-3">Commercial</th>
                  <th className="text-center px-5 py-3">Medicaid</th>
                  <th className="text-center px-5 py-3">Dual (Both)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E1E8]">
                <tr className="bg-white">
                  <td className="px-5 py-4">
                    <p className="font-bold text-[#2F3E4E]">Short-Term</p>
                    <p className="text-xs text-[#7A8F79] mt-0.5">≤ 30 days of service</p>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <p className="font-bold text-[#2F3E4E]">$4</p>
                    <p className="text-xs text-[#7A8F79]">per DOS</p>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <p className="font-bold text-[#2F3E4E]">$3</p>
                    <p className="text-xs text-[#7A8F79]">per DOS</p>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <p className="font-bold text-[#2F3E4E]">$5</p>
                    <p className="text-xs text-[#7A8F79]">per DOS</p>
                  </td>
                </tr>
                <tr className="bg-[#F4F6F5]">
                  <td className="px-5 py-4">
                    <p className="font-bold text-[#2F3E4E]">Long-Term</p>
                    <p className="text-xs text-[#7A8F79] mt-0.5">Ongoing / recurring</p>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <p className="font-bold text-[#2F3E4E]">$3</p>
                    <p className="text-xs text-[#7A8F79]">per DOS</p>
                    <p className="text-[11px] text-[#7A8F79] italic mt-0.5">max $10 / week</p>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <p className="font-bold text-[#2F3E4E]">$2</p>
                    <p className="text-xs text-[#7A8F79]">per DOS</p>
                    <p className="text-[11px] text-[#7A8F79] italic mt-0.5">max $10 / week</p>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <p className="font-bold text-[#2F3E4E]">$4</p>
                    <p className="text-xs text-[#7A8F79]">per DOS</p>
                    <p className="text-[11px] text-[#7A8F79] italic mt-0.5">max $15 / week</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-[#f8faf8] border-t border-[#D9E1E8]">
            <p className="text-[11px] text-[#7A8F79]">
              <strong className="text-[#2F3E4E]">Dual payer note:</strong> Once the primary commercial insurance benefit maximum is met, the rate drops to the $2 Medicaid rate for remaining DOS.
              Claims are grouped by the NY State Medicaid billing cycle (Thursday–Wednesday). Plans are flexible — email{' '}
              <a href="mailto:billing@cominghomecare.com" className="underline hover:text-[#2F3E4E]">billing@cominghomecare.com</a> if your needs change.
            </p>
          </div>
        </section>

        {/* Payment Terms */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D9E1E8]">
            <h2 className="text-base font-bold text-[#2F3E4E]">Payment Terms</h2>
          </div>
          <div className="p-6 space-y-5">

            {/* Standard terms */}
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-[#D9E1E8] flex items-center justify-center shrink-0 text-lg">📄</div>
              <div>
                <p className="font-semibold text-[#2F3E4E] text-sm">Invoice Cycle</p>
                <p className="text-xs text-[#7A8F79] mt-0.5 leading-relaxed">
                  Invoices are issued biweekly to monthly depending on claim volume, sent to the email address on file.
                  Payment is due within <strong className="text-[#2F3E4E]">30 days</strong> of the invoice date.
                </p>
              </div>
            </div>

            {/* Early pay credit */}
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0 text-lg">💚</div>
              <div>
                <p className="font-bold text-green-800 text-sm">Early Payment Credit</p>
                <p className="text-xs text-green-700 mt-0.5 leading-relaxed">
                  Pay your invoice in full within <strong>7 days</strong> of the invoice date and receive a{' '}
                  <strong>$4 credit</strong> applied to your next month&apos;s invoice.{' '}
                  <span className="text-green-600">Applies to invoices of <strong>$20.00 or more</strong>.</span>
                </p>
              </div>
            </div>

            {/* Late fee schedule */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3">Late Fee Schedule</p>
              <div className="divide-y divide-[#D9E1E8] border border-[#D9E1E8] rounded-xl overflow-hidden text-sm">
                <div className="grid grid-cols-2 bg-[#F4F6F5] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#7A8F79]">
                  <span>Overdue Period</span>
                  <span className="text-right">Fee</span>
                </div>
                <div className="grid grid-cols-2 px-4 py-3 bg-white">
                  <span className="text-[#2F3E4E]">31 – 60 days</span>
                  <span className="text-right font-bold text-orange-600">15%</span>
                </div>
                <div className="grid grid-cols-2 px-4 py-3 bg-[#F4F6F5]">
                  <span className="text-[#2F3E4E]">61 – 90 days</span>
                  <span className="text-right font-bold text-orange-700">20%</span>
                </div>
                <div className="grid grid-cols-2 px-4 py-3 bg-white">
                  <span className="text-[#2F3E4E]">90+ days</span>
                  <span className="text-right font-bold text-red-600">22% / month</span>
                </div>
              </div>
              <p className="text-[11px] text-[#7A8F79] mt-2">Services may be paused at any time for overdue balances.</p>
            </div>

          </div>
        </section>

        {/* Submission Deadlines */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D9E1E8]">
            <h2 className="text-base font-bold text-[#2F3E4E]">Submission Deadlines</h2>
          </div>
          <div className="p-6 space-y-3">
            <div className="flex gap-3 items-start">
              <span className="text-[#7A8F79] mt-0.5">•</span>
              <p className="text-sm text-[#4a5568] leading-relaxed">
                DOS submitted by <strong className="text-[#2F3E4E]">Monday at 11:59 PM</strong> will be included in the current billing cycle when possible.
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-[#7A8F79] mt-0.5">•</span>
              <p className="text-sm text-[#4a5568] leading-relaxed">
                Urgent after-deadline requests may incur a <strong className="text-[#2F3E4E]">$10 same-day service fee</strong> and must be confirmed by phone or text.
              </p>
            </div>
          </div>
        </section>

        {/* Corrections */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D9E1E8]">
            <h2 className="text-base font-bold text-[#2F3E4E]">Corrections &amp; Adjustments</h2>
          </div>
          <div className="divide-y divide-[#D9E1E8] text-sm">
            <div className="grid grid-cols-[1fr_auto] items-center px-6 py-4 gap-4">
              <div>
                <p className="font-semibold text-[#2F3E4E]">Billing errors (our fault)</p>
                <p className="text-xs text-[#7A8F79] mt-0.5">Voids, resubmissions, and corrections due to CHC errors</p>
              </div>
              <span className="font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full text-xs whitespace-nowrap">No charge</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center px-6 py-4 gap-4">
              <div>
                <p className="font-semibold text-[#2F3E4E]">Provider-supplied inaccurate info</p>
                <p className="text-xs text-[#7A8F79] mt-0.5">Void &amp; reprocessing due to incorrect information from the provider</p>
              </div>
              <span className="font-bold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full text-xs whitespace-nowrap">$3 / occurrence</span>
            </div>
            <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="font-semibold text-[#2F3E4E]">Provider-submitted claim — void &amp; resubmit</p>
                <p className="text-xs text-[#7A8F79] mt-0.5">Claim already submitted by the provider that requires CHC to void, correct, and resubmit on their behalf</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full text-xs whitespace-nowrap">Medicaid — $4 / claim</span>
                <span className="font-bold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full text-xs whitespace-nowrap">Commercial — $5 / claim</span>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#2F3E4E] rounded-2xl p-6 text-center text-white space-y-3">
          <p className="font-bold text-lg">Ready to enroll in billing services?</p>
          <p className="text-sm text-white/60">
            Questions? Email us at{' '}
            <a href="mailto:billing@cominghomecare.com" className="underline text-[#7A8F79] hover:text-white transition">
              billing@cominghomecare.com
            </a>
          </p>
          <Link
            href="/signup"
            className="inline-block mt-2 bg-[#7A8F79] text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-white hover:text-[#2F3E4E] transition"
          >
            Get Started →
          </Link>
        </section>

        <p className="text-center text-[11px] text-[#7A8F79] pb-4">
          Coming Home Care Services, LLC · Buffalo, NY · cominghomecare.com
        </p>

      </div>
    </div>
  )
}
