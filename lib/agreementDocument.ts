import fs from 'fs'
import path from 'path'

// ─── Shared logo loader ────────────────────────────────────────────────────
export function loadLogoBase64(): string {
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'chc_logo.png'))
    return buf.toString('base64')
  } catch {
    return ''
  }
}

// ─── Shared CSS injected into every business document ─────────────────────
const DOCUMENT_BASE_CSS = `
  @media print {
    body { margin: 0; }
    .no-print { display: none !important; }
  }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    background: #f4f6f8;
    margin: 0;
    padding: 32px 16px;
    color: #2F3E4E;
  }
  .card {
    background: #fff;
    max-width: 780px;
    margin: 0 auto;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.10);
    overflow: hidden;
  }
  /* ── Branded header ── */
  .doc-header {
    background: #1c2433;
    padding: 20px 32px;
  }
  .doc-header-inner {
    display: flex;
    align-items: center;
    gap: 24px;
  }
  .doc-logo-box {
    background: #ffffff;
    border-radius: 8px;
    padding: 10px 14px;
    flex-shrink: 0;
    line-height: 0;
  }
  .doc-logo {
    height: 58px;
    width: auto;
    display: block;
  }
  .doc-logo-fallback {
    font-family: sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #7A8F79;
    line-height: 1.3;
  }
  .doc-title-block {
    flex: 1;
    text-align: right;
    padding-right: 4px;
  }
  .doc-title-block h1 {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: 700;
    color: #9ca3af;
    letter-spacing: 0.4px;
    font-family: Georgia, serif;
  }
  .doc-title-block p {
    margin: 0;
    font-size: 11px;
    color: #6b7280;
    font-family: sans-serif;
    letter-spacing: 0.3px;
  }
  /* ── Body ── */
  .doc-body { padding: 32px 40px; }
  .doc-intro {
    font-size: 13px;
    color: #4a5568;
    line-height: 1.7;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid #e5eaf0;
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  .sig-block {
    background: #f4f6f8;
    border-radius: 8px;
    padding: 20px 24px;
    margin-bottom: 16px;
  }
  .sig-block p {
    margin: 0 0 6px;
    font-size: 12px;
    color: #7A8F79;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-family: sans-serif;
  }
  .sig-value {
    font-size: 28px;
    font-family: 'Brush Script MT', cursive;
    color: #2F3E4E;
    border-bottom: 2px solid #2F3E4E;
    display: inline-block;
    min-width: 120px;
    padding-bottom: 2px;
  }
  .doc-meta {
    font-size: 11px;
    color: #718096;
    margin-top: 16px;
    line-height: 1.8;
    font-family: sans-serif;
  }
  .doc-footer {
    background: #f4f6f8;
    border-top: 1px solid #e5eaf0;
    padding: 14px 40px;
    font-size: 11px;
    color: #a0aec0;
    text-align: center;
    font-family: sans-serif;
  }
`

// ─── Reusable branded header HTML ─────────────────────────────────────────
// Call this from any future document builder.
export function buildDocumentHeader(opts: {
  title: string
  subtitle?: string
  logoBase64?: string
}): string {
  const logoHtml = opts.logoBase64
    ? `<div class="doc-logo-box">
        <img src="data:image/png;base64,${opts.logoBase64}" alt="Coming Home Care" class="doc-logo">
       </div>`
    : `<div class="doc-logo-box">
        <div class="doc-logo-fallback">Coming Home<br>Care Services</div>
       </div>`

  return `
  <div class="doc-header">
    <div class="doc-header-inner">
      ${logoHtml}
      <div class="doc-title-block">
        <h1>${opts.title}</h1>
        ${opts.subtitle ? `<p>${opts.subtitle}</p>` : ''}
      </div>
    </div>
  </div>`
}

// ─── Agreement document ───────────────────────────────────────────────────
export function buildAgreementHtml(opts: {
  displayName: string
  accountNumber: string
  lastName: string
  initials: string
  signedAt: Date
  ip: string
  title: string
  isSample?: boolean
}) {
  const logoBase64 = loadLogoBase64()

  const dateStr = opts.signedAt.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const timeStr = opts.signedAt.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })

  const policies = [
    {
      heading: 'Account Security',
      body: 'My login credentials are personal and confidential. I will not share my username or password with anyone. I will notify Coming Home Care Services immediately if I believe my account has been accessed without my authorization.',
    },
    {
      heading: 'Data Encryption & PHI Responsibility',
      body: 'I understand that all data stored on this portal is protected under AWS S3 HIPAA-compliant encryption standards while at rest and in transit. If I choose to print, download, or save any Protected Health Information (PHI) outside of this portal, I accept full responsibility for continuing to manage and protect that information in accordance with applicable privacy laws.',
    },
    {
      heading: 'Confidentiality of Portal Data',
      body: 'Claim submissions, payment records, invoices, and any documents visible in this portal are confidential. I will not screenshot, copy, forward, or distribute this information to any unauthorized party.',
    },
    {
      heading: 'Electronic Communications',
      body: 'By using this portal, I grant Coming Home Care Services, LLC permission to contact me by email, text message, or phone for purposes including but not limited to: submission reminders, billing alerts, data clarification requests, and other business-related communications. I understand I may update my communication preferences at any time from my profile settings.',
    },
    {
      heading: 'Data Privacy — No Sale or Sharing',
      body: 'I understand that my personal information, claim data, and any files stored in this portal will never be sold, rented, or shared with any third party for any reason other than the direct fulfillment of services offered through this portal.',
    },
    {
      heading: 'Right to Delete',
      body: 'I understand that I may request the deletion of my user profile, personal information, and personal files from this portal at any time by contacting Coming Home Care Services at support@cominghomecare.com. Requests will be processed promptly and I will receive confirmation when completed.',
    },
    {
      heading: 'Billing Services — No Minimum Commitment',
      body: 'I understand that if I choose to enroll in billing services through this portal, I may cancel that enrollment at any time with no minimum length of service, no cancellation fees, and no penalty. Cancellation requests should be submitted in writing to support@cominghomecare.com. A notice of any increase to the cost of service will be given 30 days prior to the change taking effect. Any decrease to a cost of service will take effect immediately.',
    },
    {
      heading: 'Accuracy of Submitted Information',
      body: 'I am responsible for the accuracy of all hours, dates of service, and other information I submit through this portal. I understand that intentional misrepresentation of submitted data may result in immediate termination of services.',
    },
    {
      heading: 'Scope of Services',
      body: 'Coming Home Care Services, LLC provides billing facilitation and administrative support only. Nothing in this portal constitutes medical advice, legal counsel, or a guarantee of insurance reimbursement. All reimbursement determinations are made solely by the relevant payers.',
    },
    {
      heading: 'Acceptable Use',
      body: 'This portal is for professional use exclusively in connection with my relationship with Coming Home Care Services, LLC. I will not attempt to access data belonging to other providers or use the portal for any purpose outside of its intended billing and administrative functions.',
    },
    {
      heading: 'Policy Updates',
      body: 'Coming Home Care Services, LLC reserves the right to update these terms at any time. I will be notified of material changes with reasonable advance notice. My continued use of the portal following such notification constitutes my acceptance of the updated terms.',
    },
  ]

  const policyRows = policies.map((p, i) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e5eaf0;vertical-align:top;width:28px;text-align:center;">
        <span style="display:inline-block;width:16px;height:16px;border:2px solid #2F3E4E;border-radius:3px;background:#2F3E4E;">
          <span style="color:white;font-size:11px;line-height:16px;display:block;text-align:center;">✓</span>
        </span>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5eaf0;vertical-align:top;">
        <strong style="color:#2F3E4E;font-size:13px;font-family:sans-serif;">${i + 1}. ${p.heading}</strong><br>
        <span style="color:#4a5568;font-size:12px;line-height:1.6;">${p.body}</span>
      </td>
    </tr>`).join('')

  const sampleBanner = opts.isSample ? `
    <div style="background:#f59e0b;color:#fff;text-align:center;padding:10px 16px;font-family:sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;">
      SAMPLE DOCUMENT — For Admin Preview Only — Not a Signed Agreement
    </div>` : ''

  const header = buildDocumentHeader({
    title: 'myPortal User Agreement',
    subtitle: 'Coming Home Care Services, LLC &nbsp;·&nbsp; Provider Portal',
    logoBase64,
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${opts.title}</title>
<style>${DOCUMENT_BASE_CSS}</style>
</head>
<body>
${sampleBanner}
<div class="card">
  ${header}
  <div class="doc-body">
    <div class="doc-intro">
      The following agreement governs your use of the Coming Home Care Services provider portal (<strong>myPortal</strong>).
      Each item below was individually reviewed and acknowledged by the signing party.
      This document serves as a binding record of that acknowledgment.
    </div>

    <table>
      <tbody>
        ${policyRows}
      </tbody>
    </table>

    <div style="background:#2F3E4E;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#7A8F79;font-family:sans-serif;">A Note From Us</p>
      <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.9);line-height:1.7;">This portal was built with you in mind — with the genuine goal of streamlining your workflow and reducing the time you spend tracking income, submitting hours, and managing documents. If there's a feature you'd like to see added, something that would make your day easier, or anything we can do better, please don't hesitate to reach out. We're always listening.</p>
      <p style="margin:0;font-size:11px;color:#7A8F79;font-family:sans-serif;">— The Coming Home Care Services Team</p>
    </div>

    <div class="sig-block">
      <p>Initials</p>
      <span class="sig-value">${opts.initials}</span>
    </div>
    <div class="sig-block">
      <p>Full Name on Account</p>
      <span style="font-size:15px;font-weight:600;color:#2F3E4E;font-family:sans-serif;">${opts.displayName}</span>
    </div>

    <div class="doc-meta">
      <strong>Account Number:</strong> ${opts.accountNumber || '—'}<br>
      <strong>Signed:</strong> ${dateStr} at ${timeStr}<br>
      <strong>IP Address:</strong> ${opts.ip}<br>
      <strong>Document ID:</strong> ${opts.title}
    </div>
  </div>
  <div class="doc-footer">
    This document is auto-generated and tamper-evident. &nbsp;Coming Home Care Services, LLC &nbsp;·&nbsp; support@cominghomecare.com
  </div>
</div>
</body>
</html>`
}

// ─── Billing Service Agreement document ───────────────────────────────────────
export function buildBillingAgreementHtml(opts: {
  displayName: string
  accountNumber: string
  lastName: string
  initials: string
  signedAt: Date
  ip: string
  title: string
  isSample?: boolean
  billingPlan?: string
}) {
  const logoBase64 = loadLogoBase64()

  const dateStr = opts.signedAt.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const timeStr = opts.signedAt.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })

  const PLAN_DISPLAY: Record<string, string> = {
    'ST-COM':  '$4/DOS — Short-Term · Commercial',
    'ST-MED':  '$3/DOS — Short-Term · Medicaid',
    'ST-DUAL': '$5/DOS — Short-Term · Dual',
    'LT-COM':  '$3/DOS (max $10/wk) — Long-Term · Commercial',
    'LT-MED':  '$2/DOS (max $10/wk) — Long-Term · Medicaid',
    'LT-DUAL': '$4/DOS (max $15/wk) — Long-Term · Dual',
  }
  const enrolledPlanLabel = opts.billingPlan ? (PLAN_DISPLAY[opts.billingPlan] ?? opts.billingPlan) : ''

  const sampleBanner = opts.isSample ? `
    <div style="background:#f59e0b;color:#fff;text-align:center;padding:10px 16px;font-family:sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;">
      SAMPLE DOCUMENT — For Admin Preview Only — Not a Signed Agreement
    </div>` : ''

  const header = buildDocumentHeader({
    title: 'Medical Claim Billing Service Agreement',
    subtitle: 'Coming Home Care Services, LLC &nbsp;·&nbsp; Provider Portal',
    logoBase64,
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${opts.title}</title>
<style>${DOCUMENT_BASE_CSS}
  .section-heading {
    font-size: 13px;
    font-weight: 700;
    color: #2F3E4E;
    font-family: sans-serif;
    margin: 0 0 6px;
  }
  .section-body {
    font-size: 12px;
    color: #4a5568;
    line-height: 1.7;
    margin: 0 0 20px;
  }
  .section-body ul {
    margin: 6px 0 0 18px;
    padding: 0;
  }
  .section-body li {
    margin-bottom: 4px;
  }
  .plan-table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 20px;
    font-size: 12px;
  }
  .plan-table th {
    background: #2F3E4E;
    color: #fff;
    padding: 8px 14px;
    text-align: left;
    font-family: sans-serif;
    font-size: 11px;
    letter-spacing: 0.5px;
  }
  .plan-table td {
    padding: 8px 14px;
    border-bottom: 1px solid #e5eaf0;
    color: #4a5568;
    vertical-align: top;
  }
  .plan-table tr:last-child td { border-bottom: none; }
  .plan-note {
    font-size: 11px;
    color: #718096;
    font-style: italic;
    margin: -12px 0 20px;
    font-family: sans-serif;
  }
  .intro-box {
    background: #f4f6f8;
    border-radius: 8px;
    padding: 14px 18px;
    font-size: 12px;
    color: #4a5568;
    line-height: 1.7;
    margin-bottom: 24px;
    font-family: sans-serif;
  }
</style>
</head>
<body>
${sampleBanner}
<div class="card">
  ${header}
  <div class="doc-body">

    <div class="doc-intro">
      This agreement governs the medical claim billing services provided by Coming Home Care Services, LLC.
      Fees are based on the selected billing plan and the volume of claims submitted per billing cycle.
    </div>

    <!-- Rate Schedule -->
    <p class="section-heading">Billing Rate Schedule — Per Date of Service (DOS)</p>
    <div class="intro-box">
      Rates are billed per date of service submitted within each billing cycle.
      Claims are grouped by the New York State Medicaid billing cycle <strong>(Thursday–Wednesday)</strong>.
      Plans are flexible — if your needs change, email <strong>billing@cominghomecare.com</strong> and we will update your plan accordingly.
    </div>

    <table class="plan-table">
      <thead>
        <tr>
          <th style="width:28%">Term</th>
          <th style="text-align:center${opts.billingPlan === 'ST-COM' || opts.billingPlan === 'LT-COM' ? ';background:#4a6741' : ''}">Commercial</th>
          <th style="text-align:center${opts.billingPlan === 'ST-MED' || opts.billingPlan === 'LT-MED' ? ';background:#4a6741' : ''}">Medicaid</th>
          <th style="text-align:center${opts.billingPlan === 'ST-DUAL' || opts.billingPlan === 'LT-DUAL' ? ';background:#4a6741' : ''}">Dual (Both)</th>
        </tr>
      </thead>
      <tbody>
        <tr${opts.billingPlan?.startsWith('ST') ? ' style="background:#f0f4f0"' : ''}>
          <td>
            <strong>Short-Term</strong><br>
            <span style="font-size:10px;color:#718096;">≤ 30 days / one-time event</span>
          </td>
          <td style="text-align:center;${opts.billingPlan === 'ST-COM' ? 'background:#e2ece2;font-weight:700;' : ''}">
            <strong>$4</strong> <span style="font-size:10px;color:#718096;">/DOS</span>
          </td>
          <td style="text-align:center;${opts.billingPlan === 'ST-MED' ? 'background:#e2ece2;font-weight:700;' : ''}">
            <strong>$3</strong> <span style="font-size:10px;color:#718096;">/DOS</span>
          </td>
          <td style="text-align:center;${opts.billingPlan === 'ST-DUAL' ? 'background:#e2ece2;font-weight:700;' : ''}">
            <strong>$5</strong> <span style="font-size:10px;color:#718096;">/DOS</span>
          </td>
        </tr>
        <tr${opts.billingPlan?.startsWith('LT') ? ' style="background:#f0f4f0"' : ''}>
          <td>
            <strong>Long-Term</strong><br>
            <span style="font-size:10px;color:#718096;">Ongoing / &gt; 30 days</span>
          </td>
          <td style="text-align:center;${opts.billingPlan === 'LT-COM' ? 'background:#e2ece2;font-weight:700;' : ''}">
            <strong>$3</strong> <span style="font-size:10px;color:#718096;">/DOS</span><br>
            <span style="font-size:10px;color:#718096;font-style:italic;">max $10/week</span>
          </td>
          <td style="text-align:center;${opts.billingPlan === 'LT-MED' ? 'background:#e2ece2;font-weight:700;' : ''}">
            <strong>$2</strong> <span style="font-size:10px;color:#718096;">/DOS</span><br>
            <span style="font-size:10px;color:#718096;font-style:italic;">max $10/week</span>
          </td>
          <td style="text-align:center;${opts.billingPlan === 'LT-DUAL' ? 'background:#e2ece2;font-weight:700;' : ''}">
            <strong>$4</strong> <span style="font-size:10px;color:#718096;">/DOS</span><br>
            <span style="font-size:10px;color:#718096;font-style:italic;">max $15/week</span>
          </td>
        </tr>
      </tbody>
    </table>

    ${enrolledPlanLabel ? `
    <div style="background:#2F3E4E;border-radius:8px;padding:12px 18px;margin:-8px 0 20px;font-family:sans-serif;">
      <p style="margin:0 0 2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#7A8F79;">Enrolled Plan</p>
      <p style="margin:0;font-size:13px;font-weight:700;color:#fff;">${enrolledPlanLabel}</p>
    </div>` : ''}

    <!-- Invoicing -->
    <p class="section-heading">Invoicing &amp; Payment Terms</p>
    <p class="section-body">
      Invoices are issued on a biweekly to monthly basis depending on claim volume and are sent to the email address
      on file. Payment is due within <strong>30 days</strong> of the invoice date.
      <ul>
        <li><strong>Early Payment Credit:</strong> Invoices paid in full within <strong>7 days</strong> of the invoice date receive a <strong>$4 credit</strong> applied to the following month's invoice.</li>
        <li>Balances unpaid after 30 days may incur a <strong>15% late fee</strong>.</li>
        <li>Balances unpaid after 60 days may incur a <strong>20% late fee</strong>.</li>
        <li>Balances unpaid 90 days or more may incur a <strong>22% late fee</strong> per additional month.</li>
        <li>Services may be paused at any time for overdue balances.</li>
      </ul>
    </p>

    <!-- Submission Deadlines -->
    <p class="section-heading">Submission Deadlines</p>
    <p class="section-body">
      <ul>
        <li>Dates of service submitted by <strong>Monday at 11:59 PM</strong> will be included in the current billing cycle when possible.</li>
        <li>Urgent requests to include a date of service in the current pay cycle made after the deadline may incur a <strong>$10 same-day service fee</strong>. Expedited requests must be confirmed directly via phone or text.</li>
      </ul>
    </p>

    <!-- Corrections -->
    <p class="section-heading">Corrections &amp; Adjustments</p>
    <p class="section-body">
      <ul>
        <li>Corrections due to billing errors will be completed at <strong>no cost</strong>.</li>
        <li>Corrections resulting from inaccurate information provided by the provider will incur a <strong>$3 fee per occurrence</strong> for void &amp; reprocessing.</li>
      </ul>
    </p>

    <!-- Provider Responsibility -->
    <p class="section-heading">Provider Responsibility</p>
    <p class="section-body">
      The provider is responsible for ensuring that all submitted information is accurate and complete.
      Coming Home Care Services, LLC is not responsible for claim delays or denials resulting from incorrect
      or incomplete information provided.
    </p>

    <!-- Rate Changes -->
    <p class="section-heading">Rate Changes</p>
    <p class="section-body">
      All rates are subject to change with prior notice. Any increase to service fees will be given a
      <strong>30-day notice</strong>. Any reductions in service fees will take place immediately.
      By using billing services, the provider agrees to the terms outlined above.
    </p>

    <!-- Signature -->
    <div class="sig-block">
      <p>Initials</p>
      <span class="sig-value">${opts.initials}</span>
    </div>
    <div class="sig-block">
      <p>Full Name on Account</p>
      <span style="font-size:15px;font-weight:600;color:#2F3E4E;font-family:sans-serif;">${opts.displayName}</span>
    </div>

    <div class="doc-meta">
      <strong>Account Number:</strong> ${opts.accountNumber || '—'}<br>
      <strong>Signed:</strong> ${dateStr} at ${timeStr}<br>
      <strong>IP Address:</strong> ${opts.ip}<br>
      <strong>Document ID:</strong> ${opts.title}
    </div>
  </div>
  <div class="doc-footer">
    This document is auto-generated and tamper-evident. &nbsp;Coming Home Care Services, LLC &nbsp;·&nbsp; support@cominghomecare.com
  </div>
</div>
</body>
</html>`
}
