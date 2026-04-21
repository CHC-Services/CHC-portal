export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#D9E1E8]">

      {/* Hero header */}
      <div className="bg-[#2F3E4E] px-6 py-14">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-2">Legal · User Agreement</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            Terms of Service
          </h1>
          <p className="text-[#D9E1E8] mt-3 text-sm">
            Coming Home Care Services LLC &nbsp;·&nbsp; Last Updated: April 21, 2026
          </p>
        </div>
      </div>

      {/* Document body */}
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">

        {/* Preamble */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-[#7A8F79]">
          <p className="text-sm text-[#2F3E4E] leading-relaxed">
            These Terms of Service (&ldquo;Terms&rdquo; or &ldquo;Agreement&rdquo;) constitute a legally binding agreement between
            you (&ldquo;User,&rdquo; &ldquo;you,&rdquo; or &ldquo;Provider&rdquo;) and <strong>COMING HOME CARE SERVICES LLC</strong>, doing
            business as Coming Homecare (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), a limited liability company
            organized under the laws of the State of New York.
          </p>
          <p className="text-sm text-[#2F3E4E] leading-relaxed mt-3">
            These Terms govern your access to and use of the Company&apos;s online platform located at{' '}
            <a href="https://www.cominghomecare.com" className="text-[#7A8F79] underline underline-offset-2 hover:text-[#2F3E4E] transition">
              https://www.cominghomecare.com
            </a>{' '}
            (the &ldquo;Platform&rdquo;), including all related services, features, and content.
          </p>
          <p className="text-sm text-[#2F3E4E] leading-relaxed mt-3">
            By registering for an account, accessing, or using the Platform in any manner, you acknowledge that you have
            read, understood, and agree to be bound by these Terms. If you do not agree, you must immediately
            discontinue use of the Platform.
          </p>
        </div>

        <Section number="1" title="Eligibility and Authorized Use">
          <p>The Platform is intended solely for use by licensed healthcare professionals. By using the Platform, you represent and warrant that:</p>
          <ul>
            <li>You are at least eighteen (18) years of age;</li>
            <li>You are a licensed Registered Nurse (RN), Licensed Practical Nurse (LPN), or similarly qualified healthcare professional in good standing;</li>
            <li>You are authorized under applicable law to access, use, and disclose Protected Health Information (&ldquo;PHI&rdquo;);</li>
            <li>Your use of the Platform complies with all applicable federal, state, and local laws, including but not limited to HIPAA.</li>
          </ul>
          <p>The Company currently provides services to users operating within the State of New York. You are responsible for ensuring that your use of the Platform is lawful in your jurisdiction.</p>
        </Section>

        <Section number="2" title="Description of Services">
          <p>The Platform provides administrative and operational support tools designed for home care professionals. These services may include, but are not limited to:</p>
          <ul>
            <li>Preparation and submission of billing claims;</li>
            <li>Secure storage of documentation;</li>
            <li>Upload and organization of Explanation of Benefits (EOBs);</li>
            <li>Workflow tools related to billing and administrative tasks.</li>
          </ul>
          <p>The Company does not provide medical services, clinical care, or medical advice. The Platform is strictly an administrative support tool, and no provider-patient relationship is created between the Company and any patient.</p>
        </Section>

        <Section number="3" title="User Accounts and Security">
          <p>To access certain features, you must create an account. You agree to:</p>
          <ul>
            <li>Provide accurate, current, and complete information;</li>
            <li>Maintain the confidentiality of your login credentials;</li>
            <li>Notify the Company immediately of any unauthorized use of your account.</li>
          </ul>
          <p>You are solely responsible for all activity conducted under your account.</p>
        </Section>

        <Section number="4" title="Billing Services and Fees">
          <Subsection title="4.1  Voluntary Enrollment">
            The Platform is generally available for free use. However, billing services are offered only to users who voluntarily enroll through a structured onboarding and assignment process.
          </Subsection>
          <Subsection title="4.2  Fee Structure">
            Users who enroll in billing services agree to pay fees based on a per-date-of-service model. Fees vary depending on the type of insurance and service tier applicable to the User&apos;s billing needs.
          </Subsection>
          <Subsection title="4.3  Payment Process">
            Payments are collected outside the Platform through approved methods, which may include electronic transfers, payment applications, or other agreed-upon methods. Payment instructions will be communicated directly to the User.
          </Subsection>
          <Subsection title="4.4  No Automatic Charges">
            The Company does not impose automatic or unexpected charges. Fees apply only after explicit enrollment and agreement to the billing service terms.
          </Subsection>
        </Section>

        <Section number="5" title="Claim Submission Authorization">
          <p>By enrolling in billing services, you expressly authorize the Company to prepare and submit claims on your behalf. You acknowledge and agree that:</p>
          <ul>
            <li>All information provided by you must be accurate and complete;</li>
            <li>You remain solely responsible for the validity and legality of all submitted claims;</li>
            <li>The Company does not guarantee claim approval or reimbursement outcomes.</li>
          </ul>
        </Section>

        <Section number="6" title="Data Ownership and User Content">
          <p>You retain full ownership of all data, documents, and PHI you upload to the Platform.</p>
          <p>The Company does not claim ownership of your content. However, you grant the Company a limited, revocable authorization to access and use your data solely for:</p>
          <ul>
            <li>Providing the requested services;</li>
            <li>Performing billing-related tasks when authorized;</li>
            <li>Maintaining and improving the Platform.</li>
          </ul>
          <p>You control whether documents are shared with Company administrators through Platform permissions.</p>
        </Section>

        <Section number="7" title="Data Access and Export">
          <p>Users may download or export their data at any time. Once data is exported:</p>
          <ul>
            <li>The Company has no control over its use or storage;</li>
            <li>The User assumes full responsibility for safeguarding that information.</li>
          </ul>
        </Section>

        <Section number="8" title="HIPAA and Data Security">
          <p>The Company implements reasonable administrative, technical, and physical safeguards, including secure cloud storage, to protect user data.</p>
          <p>However:</p>
          <ul>
            <li>The Company operates as a service provider and not as a healthcare provider;</li>
            <li>Users are responsible for their own compliance with HIPAA and related laws;</li>
            <li>The Company is not responsible for misuse of PHI once it leaves the Platform.</li>
          </ul>
        </Section>

        <Section number="9" title="Communications">
          <p>The Company may send operational communications, including:</p>
          <ul>
            <li>Account notifications;</li>
            <li>Workflow updates;</li>
            <li>Billing reminders.</li>
          </ul>
          <p>Users may manage notification preferences within their account settings.</p>
        </Section>

        <Section number="10" title="Prohibited Conduct">
          <p>You agree not to:</p>
          <ul>
            <li>Upload false, misleading, or unauthorized information;</li>
            <li>Violate any applicable healthcare or privacy laws;</li>
            <li>Attempt to access another user&apos;s data;</li>
            <li>Use the Platform for unlawful purposes.</li>
          </ul>
        </Section>

        <Section number="11" title="Limitation of Liability">
          <p>To the maximum extent permitted by law, the Company shall not be liable for:</p>
          <ul>
            <li>Denied or delayed claims;</li>
            <li>Financial losses related to billing outcomes;</li>
            <li>Unauthorized access caused by user negligence;</li>
            <li>Events beyond the Company&apos;s reasonable control.</li>
          </ul>
          <p>The Platform is provided &ldquo;as is&rdquo; without warranties of any kind.</p>
        </Section>

        <Section number="12" title="Indemnification">
          <p>You agree to indemnify and hold harmless the Company from any claims, damages, or liabilities arising from:</p>
          <ul>
            <li>Your use of the Platform;</li>
            <li>Your handling of PHI;</li>
            <li>Any inaccuracies in submitted data.</li>
          </ul>
        </Section>

        <Section number="13" title="Termination">
          <p>The Company reserves the right to suspend or terminate access if:</p>
          <ul>
            <li>These Terms are violated;</li>
            <li>Fees remain unpaid;</li>
            <li>Continued use presents legal or operational risk.</li>
          </ul>
        </Section>

        <Section number="14" title="Governing Law">
          <p>This Agreement shall be governed by the laws of the State of New York.</p>
        </Section>

        {/* Contact */}
        <div className="bg-[#2F3E4E] rounded-2xl p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7A8F79] mb-2">Questions?</p>
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

// ── Layout helpers ────────────────────────────────────────────────────────────

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
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

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-[#D9E1E8] pl-4 py-0.5">
      <p className="text-xs font-bold uppercase tracking-widest text-[#7A8F79] mb-1">{title}</p>
      <p className="text-sm text-[#2F3E4E] leading-relaxed">{children}</p>
    </div>
  )
}
