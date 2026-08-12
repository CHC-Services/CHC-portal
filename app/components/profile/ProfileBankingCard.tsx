'use client'

import { Row } from '../ReadOnlyField'
import { ProfileCardData } from './types'

// View-only, always — bank details are admin-managed (see NurseProfile's
// "Payment" fields in prisma/schema.prisma), and no self-service route
// accepts writes to them. This card lets an account holder confirm what's on
// file without exposing an edit path that doesn't otherwise exist yet.
export default function ProfileBankingCard({ data }: { data: Partial<ProfileCardData> }) {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-[#2F3E4E] mb-3 pb-1 border-b border-[#D9E1E8]">Banking</p>
      <div className="space-y-0.5">
        <Row label="Bank Name" value={data.bankName} />
        <Row label="Routing Number" value={data.bankRoutingOnFile ? 'On file' : null} />
        <Row label="Account Number" value={data.bankAccountOnFile ? 'On file' : null} />
      </div>
      <p className="text-xs text-[#7A8F79] mt-3">Managed by your administrator.</p>
    </div>
  )
}
