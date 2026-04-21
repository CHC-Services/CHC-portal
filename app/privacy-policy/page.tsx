export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#D9E1E8]">

      {/* Hero header */}
      <div className="bg-[#2F3E4E] px-6 py-14">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-2">Legal</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">Privacy Policy</h1>
          <p className="text-[#D9E1E8] mt-3 text-sm">
            Coming Home Care Services LLC &nbsp;·&nbsp; Last Updated: April 21, 2026
          </p>
        </div>
      </div>

      {/* Document body */}
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">

        {/* Intro callout */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-[#7A8F79]">
          <p className="text-sm text-[#2F3E4E] leading-relaxed">
            This Privacy Policy describes how <strong>COMING HOME CARE SERVICES LLC</strong> d/b/a Coming Homecare
            (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, and protects information provided by users
            of our platform. By using the Platform, you consent to the practices described in this Policy.
          </p>
        </div>

        <PolicySection number="1" title="Overview">
          <p>
            This Privacy Policy describes how COMING HOME CARE SERVICES LLC d/b/a Coming Homecare collects,
            uses, and protects user information in connection with the Platform located at{' '}
            <a href="https://www.cominghomecare.com" className="text-[#7A8F79] underline underline-offset-2 hover:text-[#2F3E4E] transition">
              https://www.cominghomecare.com
            </a>.
          </p>
        </PolicySection>

        <PolicySection number="2" title="Information We Collect">
          <p>
            We collect information necessary to operate the Platform, including:
          </p>
          <ul>
            <li>Account details and professional credentials;</li>
            <li>Uploaded documents and Protected Health Information (&ldquo;PHI&rdquo;);</li>
            <li>Limited technical and usage data to maintain system performance and security.</li>
          </ul>
        </PolicySection>

        <PolicySection number="3" title="Use of Information">
          <p>Information is used to:</p>
          <ul>
            <li>Provide and maintain services;</li>
            <li>Perform billing-related functions;</li>
            <li>Communicate with users;</li>
            <li>Improve platform functionality.</li>
          </ul>
        </PolicySection>

        <PolicySection number="4" title="PHI and Sensitive Data">
          <p>
            PHI is handled with strict access controls and stored in secure infrastructure.
            Access is limited to authorized users and only when necessary to perform the services
            you have requested.
          </p>
        </PolicySection>

        <PolicySection number="5" title="Data Sharing">
          <p>We do not sell user data. Information is disclosed only:</p>
          <ul>
            <li>With user authorization;</li>
            <li>To perform services on your behalf;</li>
            <li>When required by law.</li>
          </ul>
        </PolicySection>

        <PolicySection number="6" title="Data Security">
          <p>
            We implement commercially reasonable administrative, technical, and physical safeguards
            to protect your information. However, no method of transmission over the internet or
            electronic storage is completely secure, and we cannot guarantee absolute security.
          </p>
        </PolicySection>

        <PolicySection number="7" title="User Rights">
          <p>
            Users may access, download, or request deletion of their data at any time, subject to
            applicable legal obligations and retention requirements.
          </p>
        </PolicySection>

        <PolicySection number="8" title="Data Retention">
          <p>
            Data is retained only as long as necessary for business and legal purposes. When
            data is no longer needed, it is securely deleted or anonymized in accordance with
            applicable law.
          </p>
        </PolicySection>

        <PolicySection number="9" title="Policy Updates">
          <p>
            We may update this Privacy Policy periodically. Continued use of the Platform
            following any update constitutes your acceptance of the revised Policy. The &ldquo;Last
            Updated&rdquo; date at the top of this page reflects the most recent revision.
          </p>
        </PolicySection>

        {/* Contact */}
        <div className="bg-[#2F3E4E] rounded-2xl p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-2">Questions About This Policy?</p>
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

function PolicySection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
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
