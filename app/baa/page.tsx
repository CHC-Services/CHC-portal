export default function BaaPage() {
  return (
    <div className="min-h-screen bg-[#D9E1E8]">

      {/* Hero header */}
      <div className="bg-[#2F3E4E] px-6 py-14">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-2">Legal · HIPAA Compliance</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            Business Associate Agreement
          </h1>
          <p className="text-[#D9E1E8] mt-3 text-sm">
            Coming Home Care Services LLC &nbsp;·&nbsp; Last Updated: April 21, 2026
          </p>
        </div>
      </div>

      {/* Document body */}
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">

        {/* Parties callout */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-[#7A8F79]">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-4">Parties to this Agreement</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Business Associate</p>
              <p className="text-sm font-semibold text-[#2F3E4E]">Coming Home Care Services LLC</p>
              <p className="text-xs text-[#7A8F79] mt-0.5">d/b/a Coming Homecare</p>
            </div>
            <div className="bg-[#F4F6F5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A8F79] mb-1">Covered Entity</p>
              <p className="text-sm font-semibold text-[#2F3E4E]">User</p>
              <p className="text-xs text-[#7A8F79] mt-0.5">Licensed healthcare professional accessing the Platform</p>
            </div>
          </div>
        </div>

        <BaaSection number="1" title="Parties">
          <p>
            This Business Associate Agreement (&ldquo;BAA&rdquo;) is entered into between{' '}
            <strong>COMING HOME CARE SERVICES LLC d/b/a Coming Homecare</strong> (&ldquo;Business Associate&rdquo;)
            and the User (&ldquo;Covered Entity&rdquo;) accessing the Platform.
          </p>
        </BaaSection>

        <BaaSection number="2" title="Purpose">
          <p>
            This Agreement governs the use and disclosure of Protected Health Information (&ldquo;PHI&rdquo;)
            in compliance with the Health Insurance Portability and Accountability Act of 1996 (&ldquo;HIPAA&rdquo;)
            and its implementing regulations, as amended from time to time.
          </p>
        </BaaSection>

        <BaaSection number="3" title="Permitted Uses">
          <p>The Business Associate may use PHI solely to:</p>
          <ul>
            <li>Provide billing and administrative services on behalf of the Covered Entity;</li>
            <li>Perform functions expressly authorized by the Covered Entity.</li>
          </ul>
          <p>
            Any use or disclosure of PHI not described herein requires prior written authorization
            from the Covered Entity.
          </p>
        </BaaSection>

        <BaaSection number="4" title="Obligations of Business Associate">
          <p>The Business Associate agrees to:</p>
          <ul>
            <li>Implement reasonable administrative, technical, and physical safeguards to protect PHI;</li>
            <li>Limit use of PHI to the minimum necessary to accomplish the intended purpose;</li>
            <li>Report any known breach or unauthorized disclosure of PHI to the Covered Entity;</li>
            <li>Ensure any subcontractors or agents who receive PHI agree to the same restrictions and conditions.</li>
          </ul>
        </BaaSection>

        <BaaSection number="5" title="Obligations of Covered Entity (User)">
          <p>The User (Covered Entity) agrees to:</p>
          <ul>
            <li>Provide accurate and lawfully obtained PHI to the Business Associate;</li>
            <li>Obtain all necessary patient authorizations prior to disclosing PHI to the Platform;</li>
            <li>Use the Platform in full compliance with HIPAA and all applicable laws.</li>
          </ul>
        </BaaSection>

        <BaaSection number="6" title="Breach Notification">
          <p>
            The Business Associate will notify the Covered Entity of any breach of unsecured PHI
            as required by the HIPAA Breach Notification Rule (45 C.F.R. §§ 164.400–414) without
            unreasonable delay and in no event later than sixty (60) calendar days after discovery
            of the breach.
          </p>
        </BaaSection>

        <BaaSection number="7" title="Termination">
          <p>
            This BAA may be terminated by either party if the other party materially violates its
            terms and fails to cure such violation within a reasonable time after written notice.
            Termination of this BAA shall not affect any obligations already accrued prior to termination.
          </p>
        </BaaSection>

        <BaaSection number="8" title="Return or Destruction of PHI">
          <p>
            Upon termination of this Agreement, the Business Associate shall, where feasible, return
            or securely destroy all PHI received from or created on behalf of the Covered Entity.
            Where return or destruction is not feasible, the protections of this BAA shall survive
            termination and remain in effect for as long as the Business Associate retains such PHI.
          </p>
        </BaaSection>

        <BaaSection number="9" title="Governing Law">
          <p>
            This Agreement shall be governed by applicable federal law, including HIPAA and its
            implementing regulations, and the laws of the State of New York to the extent not
            preempted by federal law.
          </p>
        </BaaSection>

        {/* Contact */}
        <div className="bg-[#2F3E4E] rounded-2xl p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-2">Questions About This Agreement?</p>
          <p className="text-[#D9E1E8] text-sm">
            Contact us at{' '}
            <a href="mailto:support@cominghomecare.com" className="text-[#7A8F79] underline underline-offset-2 hover:text-white transition">
              support@cominghomecare.com
            </a>
          </p>
        </div>

      </div>
    </div>
  )
}

// ── Layout helper ─────────────────────────────────────────────────────────────

function BaaSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="bg-[#F4F6F5] border-b border-[#D9E1E8] px-6 py-4 flex items-center gap-3">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#7A8F79] text-white text-xs font-bold flex items-center justify-center">
          {number}
        </span>
        <h2 className="text-base font-bold text-[#2F3E4E] uppercase tracking-wide">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-3 text-sm text-[#2F3E4E] leading-relaxed [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:marker:text-[#7A8F79]">
        {children}
      </div>
    </div>
  )
}
