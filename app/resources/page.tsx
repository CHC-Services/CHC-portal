
// ─── Types ───────────────────────────────────────────────────────────────────

type Step = {
  title: string
  description: string
  link?: { label: string; href: string }
  links?: { label: string; href: string }[]
  note?: string
}

type ProcessGuide = {
  id: string
  icon: string
  title: string
  subtitle: string
  estimatedTime?: string
  steps: Step[]
  packetHref?: string   // link to a compiled "print everything" PDF
  packetLabel?: string
}

// ─── Content — update links/hrefs as real documents become available ─────────
// NY-specific processes. NPI and BCBS are federal/national and apply everywhere.

const guides: ProcessGuide[] = [
  {
    id: 'npi: individual',
    icon: '🪪',
    title: 'Obtain Your NPI Number — Individual Provider (Type 1)',
    subtitle:
      'A Type 1 NPI is for individual healthcare providers — nurses, therapists, and other clinicians applying in their own name. This is the NPI most home care nurses need. It is a federal process that applies in all states.',
    estimatedTime: '1 – 5 business days',
    steps: [
      {
        title: 'Gather What You Will Need',
        description:
          'Before starting your application, have the following ready: your Social Security Number, your current NY professional license number, your practice or home address, and your taxonomy code.',
        note: 'For most home care nurses the taxonomy code is 163W00000X (Registered Nurse). LPNs use 164W00000X. If you have a specialty, look up your code at nucc.org before starting.',
      },
      {
        title: 'Create an Account on the NPPES Registry',
        description:
          'The NPI is issued through the National Plan and Provider Enumeration System (NPPES), run by CMS. Create a free account to begin your Type 1 application.',
        link: {
          label: 'Go to NPPES Registry →',
          href: 'https://nppes.cms.hhs.gov',
        },
      },
      {
        title: 'Complete the Individual Provider Application',
        description:
          'Select "Individual" as the provider type (this is Type 1). Enter your personal information, practice location, and taxonomy code. Double-check that your name matches your license exactly — discrepancies are a common reason for delays.',
      },
      {
        title: 'Submit and Receive Your NPI',
        description:
          'After submitting, your NPI is typically issued within 1 – 5 business days. You will receive an email confirmation with your 10-digit NPI number.',
        note: 'Save your NPI confirmation — you will need it for NY Medicaid enrollment, BCBS credentialing, and any other payer applications.',
      },
      {
        title: 'Share Your NPI with Coming Home Care',
        description:
          'Once you have your NPI, add it to your profile in the portal or email it to us so we can attach it to your billing account.',
        link: {
          label: 'Update Your Profile →',
          href: '/nurse/profile',
        },
      },
    ],
  },
  {
    id: 'npi: organization',
    icon: '🏢',
    title: 'Obtain Your NPI Number — Organization / Business Entity (Type 2)',
    subtitle:
      'A Type 2 NPI is for organizations — LLCs, corporations, group practices, and agencies that bill under a business name rather than an individual. If you are billing as a business entity or practice, you need this in addition to your personal Type 1 NPI.',
    estimatedTime: '1 – 5 business days',
    steps: [
      {
        title: 'Gather What You Will Need',
        description:
          'Before starting, have the following ready: your business Employer Identification Number (EIN) from the IRS — not your SSN — your legal business name exactly as it appears on your IRS documents, your business service address, and the information of the Authorized Official who will sign on behalf of the organization.',
        note: 'The Authorized Official must be a person with legal authority to commit the organization — typically an owner, officer, or director. Their name, title, and phone number are required on the application.',
      },
      {
        title: 'Create an Account on the NPPES Registry',
        description:
          'Log in or create an account on NPPES. You will start a new application and select "Organization" as the entity type to begin a Type 2 application.',
        link: {
          label: 'Go to NPPES Registry →',
          href: 'https://nppes.cms.hhs.gov',
        },
      },
      {
        title: 'Complete the Organization (Type 2) Application',
        description:
          'Select "Organization" as the provider type. Enter your legal business name, EIN, service address, and contact information. You will also add your Authorized Official and any individual providers (Type 1 NPI holders) who are part of the organization.',
        note: 'Your business name must match your IRS EIN registration exactly. Even minor differences (LLC vs. L.L.C.) can cause processing issues.',
      },
      {
        title: 'Select the Correct Taxonomy Code for Your Organization',
        description:
          'Organization taxonomy codes are different from individual provider codes. For home health and home care agencies, the standard taxonomy is 251E00000X (Home Health). Do not use an individual nurse taxonomy code (163W00000X) for your organization.',
        note: 'If your organization provides multiple service types, you can add multiple taxonomy codes. Select the one that best represents your primary service as your primary taxonomy.',
      },
      {
        title: 'Submit and Receive Your Organization NPI',
        description:
          'Submit the completed application. Organization NPIs are typically issued within 1 – 5 business days, the same as individual NPIs. You will receive email confirmation with your 10-digit Type 2 NPI.',
        note: 'Keep this NPI on file — it is what Coming Home Care will use when submitting claims on behalf of your organization, and it will appear on remittance advice from payers.',
      },
      {
        title: 'Share Your Organization NPI with Coming Home Care',
        description:
          'Send your Type 2 NPI and your legal business name to Coming Home Care so we can update your billing profile and route organization claims correctly.',
        link: {
          label: 'Email Support →',
          href: 'mailto:support@cominghomecare.com?subject=BILLING%3A%20Organization%20NPI%20Update&body=Hi%20CHC%20Team%2C%0A%0AOur%20organization%20has%20received%20its%20Type%202%20NPI.%20Here%20are%20our%20details%3A%0A%0ALegal%20Business%20Name%3A%20%0AOrganization%20NPI%20(Type%202)%3A%20%0AEIN%3A%20%0A%0AThank%20you%2C%0A',
        },
      },
    ],
  },
  {
    id: 'ny-medicaid-enrollment',
    icon: '🏥',
    title: 'Enrolling as a NY Medicaid Provider',
    subtitle:
      'A step-by-step breakdown of what it takes to enroll as an individual Medicaid provider in New York State through the eMedNY system.',
    estimatedTime: '4 – 8 weeks after a complete submission',
    steps: [
      {
        title: 'Register on the eMedNY Provider Portal',
        description:
          'New York State Medicaid is administered through eMedNY. Start by creating an account or logging in to begin your Individual Provider Enrollment application.',
        link: {
          label: 'Go to eMedNY Provider Enrollment →',
          href: 'https://www.emedny.org/info/ProviderEnrollment/index.aspx',
        },
        note: 'Have your NPI, Social Security Number, NY professional license number, and practice address ready before you begin.',
      },
      {
        title: 'Complete the Provider ETIN Application or Renewal (Notarized)',
        description:
          'The Electronic Transmitter Identification Number (ETIN) form must be completed, signed, and notarized before submission. This authorizes electronic claim submission through eMedNY on your behalf. Download the form that applies to you:',
        links: [
          {
            label: 'New Providers — Download ETIN Application →',
            href: 'https://www.emedny.org/info/providerenrollment/ProviderMaintForms/401101_ETIN_aPPL_Provider_Electronic_Paper_ETIN_application.pdf',
          },
        ],
        note: 'This form must be physically notarized — most banks, UPS Stores, and public libraries offer notary services. There is typically no charge at a bank branch.',
      },
      {
        title: 'Gather Required Supporting Documents',
        description:
          'Collect all supporting materials before submitting. Incomplete packets are the most common cause of processing delays.',
        note:
          'Required documents typically include: NPI confirmation letter, copy of your current NY professional license, voided check or bank letter for Electronic Funds Transfer (EFT) setup, completed W-9, and a copy of your government-issued photo ID.',
      },
      {
        title: 'Submit Your Complete Packet to NYS DOH',
        description:
          'Mail or upload your completed enrollment application, notarized ETIN attestation, and all supporting documents to the New York State Department of Health Provider Enrollment unit.',
        link: {
          label: 'NYS DOH Provider Enrollment Info →',
          href: 'https://www.health.ny.gov/health_care/medicaid/providers/enrollment/',
        },
        note: 'Allow 4 – 8 weeks for processing after a complete application is received. You will be assigned a Medicaid Provider ID (MMIS ID) upon approval.',
      },
      {
        title: 'Confirm Enrollment & Share with Coming Home Care',
        description:
          'Once you receive your NY Medicaid Provider ID and approval letter, send a copy to Coming Home Care so we can update your profile and begin submitting claims on your behalf.',
        link: {
          label: 'Email Support →',
          href: 'mailto:support@cominghomecare.com?subject=ENROLLMENT%3A%20NY%20Medicaid%20Provider%20Enrollment%20Update&body=Hi%20CHC%20Team%2C%0A%0AI%20have%20completed%20my%20NY%20Medicaid%20enrollment%20and%20wanted%20to%20share%20my%20provider%20ID%2F%20approval%20letter.%0A%0AMy%20Medicaid%20Provider%20ID%20(MMIS%20ID)%3A%20%0A%0AThank%20you%2C%0A',
        },
      },
    ],
    packetHref: '#', // update with hosted compiled PDF once available
    packetLabel: 'Download Complete NY Medicaid Enrollment Packet (All Forms)',
  },
  {
    id: 'bcbs-credentialing',
    icon: '🔵',
    title: 'Empire BlueCross BlueShield Credentialing',
    subtitle:
      'How to get credentialed with BCBS in New York so claims can be submitted and paid. Empire BlueCross BlueShield is the primary BCBS plan in New York. This process applies nationally.',
    estimatedTime: '60 – 90 days after submission',
    steps: [
      {
        title: 'Verify Your NPI is Active',
        description:
          'You must have an active NPI before applying for credentialing. Confirm your NPI is in good standing and your information is current in the NPPES registry.',
        link: {
          label: 'Look Up Your NPI on NPPES →',
          href: 'https://npiregistry.cms.hhs.gov',
        },
      },
      {
        title: 'Create or Update Your CAQH ProView Profile',
        description:
          'Empire BCBS — like most major insurers — pulls credentialing data directly from CAQH ProView. Create a free account and complete your provider profile before applying.',
        link: {
          label: 'CAQH ProView →',
          href: 'https://proview.caqh.org',
        },
        note: 'Keep your CAQH profile current and re-attest quarterly — an outdated or expired profile can stall your credentialing review.',
      },
      {
        title: 'Submit a Credentialing Application to Empire BCBS',
        description:
          'Once your CAQH profile is complete, submit a provider credentialing application through the Empire BlueCross BlueShield provider portal or by contacting their Provider Relations team.',
        link: {
          label: 'Empire BCBS Provider Portal →',
          href: 'https://www.empireblue.com/provider/',
        },
      },
      {
        title: 'Sign the Provider Participation Agreement',
        description:
          'After credentialing is approved, you will receive a Provider Participation Agreement to sign. Signing this makes you an in-network provider and enables in-network claim rates.',
        link: {
          label: 'Download Participation Agreement →',
          href: '#', // update with direct form link
        },
      },
      {
        title: 'Notify Coming Home Care',
        description:
          'Share your BCBS Provider ID and effective date with us so we can begin routing claims correctly through our billing system.',
        link: {
          label: 'Email Support →',
          href: 'mailto:support@cominghomecare.com?subject=BILLING%3A%20BCBS%20Credentialing%20Approved%20%E2%80%93%20Provider%20ID%20Update&body=Hi%20CHC%20Team%2C%0A%0AMy%20Empire%20BCBS%20credentialing%20has%20been%20approved.%20Here%20are%20my%20details%3A%0A%0ABCBS%20Provider%20ID%3A%20%0AEffective%20Date%3A%20%0A%0APlease%20update%20my%20profile%20and%20let%20me%20know%20if%20anything%20else%20is%20needed.%0A%0AThank%20you%2C%0A',
        },
      },
    ],
    packetHref: '#',
    packetLabel: 'Download BCBS Credentialing Checklist',
  },
]

// ─── Resource Directory Sections ─────────────────────────────────────────────

type ResourceLink = {
  label: string
  description: string
  href: string
  badge?: string
}

type ResourceDirectory = {
  id: string
  icon: string
  title: string
  subtitle: string
  note?: string
  resources: ResourceLink[]
}

const resourceDirectories: ResourceDirectory[] = [
  {
    id: 'etin-renewal',
    icon: '📋',
    title: 'Annual ETIN Renewal',
    subtitle: 'Once enrolled in NY Medicaid, your Electronic Transmitter Identification Number (ETIN) certification must be renewed each year to stay active as a billing provider.',
    note: 'Download the renewal form, complete and notarize it, then mail or upload it to the NYS DOH Provider Enrollment unit. Most banks, UPS Stores, and public libraries offer free notary services. Failure to renew can suspend your ability to submit Medicaid claims.',
    resources: [
      {
        label: 'ETIN Renewal Certification Form',
        description: 'For existing Medicaid providers — download, complete, have it notarized, and submit to NYS DOH annually.',
        href: 'https://www.emedny.org/info/providerenrollment/ProviderMaintForms/490501_ETIN_CERT_Certification_Statement_Cert_Instructions_for_Existing_ETINs.pdf',
        badge: 'Annual',
      },
      {
        label: 'eMedNY Provider Enrollment',
        description: 'Log in to your eMedNY account to check your enrollment status, update contact information, or track your renewal submission.',
        href: 'https://www.emedny.org/info/ProviderEnrollment/index.aspx',
        badge: 'eMedNY Portal',
      },
    ],
  },
  {
    id: 'license-renewal',
    icon: '📄',
    title: 'Professional License Renewal — New York State',
    subtitle: 'New York State requires nurses and other licensed healthcare professionals to renew their registration every three years through the Office of the Professions. Letting your license lapse can interrupt your ability to practice and submit claims.',
    note: 'This guide is specific to New York State. If you are licensed in another state, visit your state\'s licensing board website for renewal instructions — requirements and timelines vary. Do not use the NY link below if you are renewing an out-of-state license.',
    resources: [
      {
        label: 'NY Online License Renewal — Office of the Professions',
        description: 'Renew your NY professional license (RN, LPN, or other healthcare license) online through the NYS Education Department Office of the Professions portal.',
        href: 'https://www.op.nysed.gov/registration-renewal/online-registration-renewal',
        badge: 'NY Only',
      },
      {
        label: 'NYS License Verification & Status Lookup',
        description: 'Confirm your current license is active and check your registration expiration date before renewing.',
        href: 'https://www.nysed.gov/professions/verification-search',
        badge: 'Verify License',
      },
    ],
  },
  {
    id: 'emedny-listserv',
    icon: '📬',
    title: 'Stay Current with eMedNY Updates',
    subtitle: 'eMedNY sends out policy changes, system updates, and billing alerts that directly affect NY Medicaid providers. Subscribing to their mailing list is one of the easiest ways to stay informed and avoid surprises on claims.',
    note: 'These lists are free to join and managed directly by NYS DOH / eMedNY. You can subscribe to only the topics relevant to your practice type — you do not need to join every list.',
    resources: [
      {
        label: 'eMedNY Email Alert System — Subscribe',
        description: 'Sign up for one or more eMedNY LISTSERV mailing lists to receive direct email notifications about NY Medicaid policy updates, billing changes, and system outages.',
        href: 'https://www.emedny.org/Listserv/eMedNY_Email_Alert_System.aspx',
        badge: 'Free · NY Medicaid',
      },
    ],
  },
  {
    id: 'mental-wellness',
    icon: '🧘',
    title: 'Mental Wellness & Decompression',
    subtitle: 'Caregiving is demanding work. These tools are here to help you decompress, reset, and protect your mental health — because you can\'t pour from an empty cup.',
    note: 'Compassion fatigue is real. Even 10 minutes of intentional rest can shift your entire day. You deserve care too.',
    resources: [
      {
        label: 'Insight Timer',
        description: 'Free app with thousands of guided meditations, sleep music, and breathing exercises. No subscription required.',
        href: 'https://insighttimer.com',
        badge: 'Free',
      },
      {
        label: 'Calm',
        description: 'Guided meditations, sleep stories, and stress-reduction programs. Includes a dedicated section for healthcare workers.',
        href: 'https://www.calm.com',
        badge: 'Subscription',
      },
      {
        label: 'Headspace',
        description: 'Structured mindfulness courses with sessions as short as 3 minutes. Great for building a daily habit around a busy schedule.',
        href: 'https://www.headspace.com',
        badge: 'Subscription',
      },
      {
        label: 'Ten Percent Happier',
        description: 'Meditation for skeptics — practical, no-fluff approach built around real science. Popular with healthcare professionals.',
        href: 'https://www.tenpercent.com',
        badge: 'Subscription',
      },
      {
        label: 'SAMHSA National Helpline',
        description: 'Free, confidential 24/7 treatment referral service for mental health and substance use. Call or text 1-800-662-4357.',
        href: 'https://www.samhsa.gov/find-help/national-helpline',
        badge: 'Free · 24/7',
      },
    ],
  },
  {
    id: 'cpr-firstaid',
    icon: '❤️‍🩹',
    title: 'CPR & First Aid Recertification',
    subtitle: 'Most certifications require renewal every 2 years. Use these resources to find in-person or online courses near you.',
    note: 'Always confirm with your employer or licensing board which certification provider is accepted. AHA and Red Cross are the most universally recognized.',
    resources: [
      {
        label: 'American Red Cross — Course Finder',
        description: 'Find in-person CPR, AED, and First Aid certification and recertification courses by zip code. Online/blended options also available.',
        href: 'https://www.redcross.org/take-a-class',
        badge: 'In-person & Online',
      },
      {
        label: 'American Heart Association — Course Locator',
        description: 'Find AHA-certified BLS (Basic Life Support) and Heartsaver courses. BLS is the standard for most nursing roles.',
        href: 'https://www.heart.org/en/cpr/find-a-course',
        badge: 'In-person & Online',
      },
      {
        label: 'ProTrainings',
        description: 'OSHA-compliant online CPR and First Aid courses with same-day certification. Accepted by many employers and insurers.',
        href: 'https://www.protrainings.com',
        badge: 'Online',
      },
      {
        label: 'National CPR Foundation',
        description: 'Affordable online certification with instant card delivery. Includes CPR/AED, First Aid, and combined courses.',
        href: 'https://www.nationalcprfoundation.com',
        badge: 'Online · Fast',
      },
    ],
  },
  {
    id: 'malpractice-insurance',
    icon: '🛡️',
    title: 'Nursing Malpractice Insurance',
    subtitle: 'Professional liability insurance protects you personally if a patient or employer ever files a claim against you — separate from any coverage your employer carries. Home care nurses are especially encouraged to carry individual coverage.',
    note: 'Your employer\'s policy protects the employer, not necessarily you individually. Individual coverage is typically $100–$200/year and is strongly recommended for any nurse providing direct patient care.',
    resources: [
      {
        label: 'NSO — Nurses Service Organization',
        description: 'The most widely used individual malpractice insurer for nurses. Coverage starts around $100/year for RNs. Easy online application.',
        href: 'https://www.nso.com',
        badge: 'Most Popular',
      },
      {
        label: 'HPSO — Healthcare Providers Service Organization',
        description: 'Comprehensive professional liability coverage for nurses and other healthcare providers. Endorsed by many nursing associations.',
        href: 'https://www.hpso.com',
        badge: 'Highly Rated',
      },
      {
        label: 'CM&F Group',
        description: 'Specializes in healthcare malpractice insurance with options tailored to home care and private duty nurses.',
        href: 'https://www.cmfgroup.com',
        badge: 'Home Care Specialty',
      },
      {
        label: 'Proliability by Mercer',
        description: 'Endorsed by the American Nurses Association. Offers flexible coverage levels with online quotes and instant coverage.',
        href: 'https://www.proliability.com',
        badge: 'ANA Endorsed',
      },
    ],
  },
]

// ─── Components ──────────────────────────────────────────────────────────────

function StepCard({ step, index }: { step: Step; index: number }) {
  return (
    <div className="flex gap-4">
      {/* Step number bubble */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2F3E4E] text-white text-sm font-bold flex items-center justify-center mt-0.5">
        {index + 1}
      </div>

      <div className="flex-1 pb-6 border-b border-[#D9E1E8] last:border-0 last:pb-0">
        <p className="font-semibold text-[#2F3E4E] text-base mb-1">{step.title}</p>
        <p className="text-sm text-[#4a5a6a] leading-relaxed mb-2">{step.description}</p>

        {step.link && (
          <a
            href={step.link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] underline underline-offset-2 transition"
          >
            {step.link.label}
          </a>
        )}
        {step.links && (
          <div className="flex flex-col gap-1.5 mb-2">
            {step.links.map((l, i) => (
              <a
                key={i}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#7A8F79] hover:text-[#2F3E4E] underline underline-offset-2 transition"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}

        {step.note && (
          <div className="bg-[#f0f4f0] border-l-4 border-[#7A8F79] rounded-r-lg px-3 py-2 mt-2">
            <p className="text-xs text-[#4a5a6a] leading-relaxed">{step.note}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function GuideCard({ guide }: { guide: ProcessGuide }) {
  return (
    <section id={guide.id} className="bg-white rounded-2xl shadow-sm overflow-hidden scroll-mt-28 md:scroll-mt-56">
      {/* Header */}
      <div className="bg-[#2F3E4E] px-6 py-5">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{guide.icon}</span>
          <div>
            <h2 className="text-xl font-bold text-white">{guide.title}</h2>
            <p className="text-sm text-[#D9E1E8] mt-1">{guide.subtitle}</p>
            {guide.estimatedTime && (
              <p className="text-xs text-[#7A8F79] mt-2 font-semibold uppercase tracking-wide">
                Estimated processing time: {guide.estimatedTime}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="px-6 py-6 space-y-0">
        {guide.steps.map((step, i) => (
          <StepCard key={i} step={step} index={i} />
        ))}
      </div>

      {/* Compiled packet download */}
      {guide.packetHref && guide.packetLabel && (
        <div className="px-6 pb-6">
          <a
            href={guide.packetHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#7A8F79] hover:bg-[#657a64] text-white font-semibold py-3 px-4 rounded-xl transition text-sm"
          >
            📄 {guide.packetLabel}
          </a>
          <p className="text-xs text-center text-[#7A8F79] mt-2">
            Print this packet to have all required forms in one place.
          </p>
        </div>
      )}
    </section>
  )
}

function ResourceDirectoryCard({ dir }: { dir: ResourceDirectory }) {
  return (
    <section id={dir.id} className="bg-white rounded-2xl shadow-sm overflow-hidden scroll-mt-28 md:scroll-mt-56">
      <div className="bg-[#2F3E4E] px-6 py-5">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{dir.icon}</span>
          <div>
            <h2 className="text-xl font-bold text-white">{dir.title}</h2>
            <p className="text-sm text-[#D9E1E8] mt-1">{dir.subtitle}</p>
          </div>
        </div>
      </div>
      {dir.note && (
        <div className="mx-6 mt-5 bg-[#f0f4f0] border-l-4 border-[#7A8F79] rounded-r-lg px-4 py-3">
          <p className="text-xs text-[#4a5a6a] leading-relaxed">{dir.note}</p>
        </div>
      )}
      <div className="px-6 py-5 grid sm:grid-cols-2 gap-4">
        {dir.resources.map((r, i) => (
          <a
            key={i}
            href={r.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col gap-1.5 border border-[#D9E1E8] rounded-xl p-4 hover:border-[#7A8F79] hover:shadow-sm transition"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-[#2F3E4E] text-sm group-hover:text-[#7A8F79] transition">{r.label} →</p>
              {r.badge && (
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-[#D9E1E8] text-[#2F3E4E] px-2 py-0.5 rounded-full">
                  {r.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-[#7A8F79] leading-relaxed">{r.description}</p>
          </a>
        ))}
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-[#D9E1E8]">

      {/* Hero */}
      <div className="bg-[#2F3E4E] px-6 md:px-10 py-10 md:py-14">
        <div className="max-w-4xl mx-auto">
          <p className="text-[#7A8F79] text-sm font-semibold uppercase tracking-widest mb-2">
            Resources
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            Enrollments &amp; Renewals
          </h1>
          <p className="mt-3 text-[#D9E1E8] text-sm max-w-xl">
            Step-by-step guides for enrollment, credentialing, and staying active as a provider in New York State.
            Federal processes (NPI, BCBS) apply regardless of state.
          </p>
        </div>
      </div>

      <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto">

        {/* Jump links — 3 columns */}
        <div className="mb-10 bg-white rounded-2xl shadow-sm p-6">
          <p className="text-xs uppercase tracking-widest text-[#7A8F79] font-semibold mb-5">
            Jump to a guide
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Getting Started */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white bg-[#2F3E4E] px-2.5 py-1 rounded-full">
                Getting Started
              </span>
              <div className="mt-3 space-y-2">
                <a href="#npi-individual"          className="flex items-center gap-2 bg-[#F4F6F5] border border-[#D9E1E8] text-[#2F3E4E] text-sm font-semibold px-4 py-2.5 rounded-lg hover:border-[#7A8F79] hover:text-[#7A8F79] transition w-full">🪪 NPI — Individual (Type 1)</a>
                <a href="#npi-organization"         className="flex items-center gap-2 bg-[#F4F6F5] border border-[#D9E1E8] text-[#2F3E4E] text-sm font-semibold px-4 py-2.5 rounded-lg hover:border-[#7A8F79] hover:text-[#7A8F79] transition w-full">🏢 NPI — Organization (Type 2)</a>
                <a href="#ny-medicaid-enrollment"   className="flex items-center gap-2 bg-[#F4F6F5] border border-[#D9E1E8] text-[#2F3E4E] text-sm font-semibold px-4 py-2.5 rounded-lg hover:border-[#7A8F79] hover:text-[#7A8F79] transition w-full">🏥 NY Medicaid Enrollment</a>
                <a href="#bcbs-credentialing"       className="flex items-center gap-2 bg-[#F4F6F5] border border-[#D9E1E8] text-[#2F3E4E] text-sm font-semibold px-4 py-2.5 rounded-lg hover:border-[#7A8F79] hover:text-[#7A8F79] transition w-full">🔵 BCBS Credentialing</a>
              </div>
            </div>

            {/* Staying Active */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white bg-[#7A8F79] px-2.5 py-1 rounded-full">
                Staying Active
              </span>
              <div className="mt-3 space-y-2">
                <a href="#etin-renewal"            className="flex items-center gap-2 bg-[#F4F6F5] border border-[#D9E1E8] text-[#2F3E4E] text-sm font-semibold px-4 py-2.5 rounded-lg hover:border-[#7A8F79] hover:text-[#7A8F79] transition w-full">📋 Annual ETIN Renewal</a>
                <a href="#license-renewal"          className="flex items-center gap-2 bg-[#F4F6F5] border border-[#D9E1E8] text-[#2F3E4E] text-sm font-semibold px-4 py-2.5 rounded-lg hover:border-[#7A8F79] hover:text-[#7A8F79] transition w-full">📄 License Renewal (NY)</a>
                <a href="#emedny-listserv"          className="flex items-center gap-2 bg-[#F4F6F5] border border-[#D9E1E8] text-[#2F3E4E] text-sm font-semibold px-4 py-2.5 rounded-lg hover:border-[#7A8F79] hover:text-[#7A8F79] transition w-full">📬 eMedNY Updates</a>
                <a href="#cpr-firstaid"            className="flex items-center gap-2 bg-[#F4F6F5] border border-[#D9E1E8] text-[#2F3E4E] text-sm font-semibold px-4 py-2.5 rounded-lg hover:border-[#7A8F79] hover:text-[#7A8F79] transition w-full">❤️‍🩹 CPR & First Aid</a>
                <a href="#malpractice-insurance"   className="flex items-center gap-2 bg-[#F4F6F5] border border-[#D9E1E8] text-[#2F3E4E] text-sm font-semibold px-4 py-2.5 rounded-lg hover:border-[#7A8F79] hover:text-[#7A8F79] transition w-full">🛡️ Malpractice Insurance</a>
              </div>
            </div>

          </div>
        </div>

        {/* ── Getting Started ── */}
        <div className="max-w-3xl mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-[#D9E1E8]" />
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[#2F3E4E] text-white">Getting Started</span>
            <div className="h-px flex-1 bg-[#D9E1E8]" />
          </div>
          <div className="space-y-8">
            {guides.map(guide => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        </div>

        {/* ── Staying Active ── */}
        <div className="max-w-3xl mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-[#D9E1E8]" />
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[#7A8F79] text-white">Staying Active</span>
            <div className="h-px flex-1 bg-[#D9E1E8]" />
          </div>
          <div className="space-y-8">
            {resourceDirectories.filter(d => ['etin-renewal', 'license-renewal', 'emedny-listserv', 'cpr-firstaid', 'malpractice-insurance'].includes(d.id)).map(dir => (
              <ResourceDirectoryCard key={dir.id} dir={dir} />
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 max-w-3xl bg-white rounded-2xl shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="text-3xl">💬</div>
          <div className="flex-1">
            <p className="font-semibold text-[#2F3E4E]">Have a question not covered here?</p>
            <p className="text-sm text-[#7A8F79] mt-0.5">
              Reach out to the Coming Home Care support team and we will walk you through it.
            </p>
          </div>
          <a
            href="mailto:support@cominghomecare.com?subject=SUPPORT%3A%20Provider%20Portal%20Question&body=Hi%20CHC%20Team%2C%0A%0A(Please%20replace%20%22SUPPORT%22%20in%20the%20subject%20line%20with%20one%20of%20the%20following%20if%20it%20applies%3A%20ENROLLMENT%20%7C%20BILLING%20%7C%20CREDENTIALING%20%7C%20PROFILE)%0A%0AMy%20question%3A%0A%0AThank%20you%2C%0A"
            className="flex-shrink-0 bg-[#2F3E4E] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#7A8F79] transition"
          >
            Contact Support →
          </a>
        </div>

      </div>
    </div>
  )
}
