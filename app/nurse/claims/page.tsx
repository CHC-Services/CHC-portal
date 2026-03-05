'use client'

const STATUS_COLORS: Record<string, string> = {
  drafted:   'bg-gray-100 text-gray-500',
  submitted: 'bg-blue-50 text-blue-600',
  pending:   'bg-amber-50 text-amber-600',
  paid:      'bg-green-50 text-green-700',
  denied:    'bg-red-50 text-red-600',
  appealed:  'bg-purple-50 text-purple-600',
  voided:    'bg-gray-100 text-gray-400',
}

export default function ClaimsPage() {
  return (
    <div className="min-h-screen bg-[#D9E1E8] p-6 md:p-8">

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#2F3E4E]">
          <span className="text-[#7A8F79] italic">my</span>Claims
        </h1>
        <p className="text-sm text-[#7A8F79] mt-1">Track the status of your submitted billing claims.</p>
      </div>

      {/* Status legend */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 max-w-2xl">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7A8F79] mb-4">Claim Status Guide</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_COLORS).map(([status, classes]) => (
            <span key={status} className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${classes}`}>
              {status}
            </span>
          ))}
        </div>
        <div className="mt-4 space-y-1 text-xs text-[#7A8F79]">
          <p><strong className="text-[#2F3E4E]">Drafted</strong> — Created but not yet submitted.</p>
          <p><strong className="text-[#2F3E4E]">Submitted</strong> — Sent to the payer, awaiting response.</p>
          <p><strong className="text-[#2F3E4E]">Pending</strong> — Under review by payer.</p>
          <p><strong className="text-[#2F3E4E]">Paid</strong> — Payment received.</p>
          <p><strong className="text-[#2F3E4E]">Denied</strong> — Payer rejected the claim.</p>
          <p><strong className="text-[#2F3E4E]">Appealed</strong> — Denial under appeal.</p>
          <p><strong className="text-[#2F3E4E]">Voided</strong> — Claim cancelled.</p>
        </div>
      </div>

      {/* Coming soon placeholder */}
      <div className="bg-white rounded-xl shadow-sm p-10 max-w-2xl flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-[#D9E1E8] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[#7A8F79]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-[#2F3E4E] font-semibold text-lg">Claims Coming Soon</p>
        <p className="text-[#7A8F79] text-sm mt-2 max-w-xs">
          Your claims will appear here once billing is set up. Contact your administrator if you have questions about a specific claim.
        </p>
      </div>

    </div>
  )
}
