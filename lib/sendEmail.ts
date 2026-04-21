import { Resend } from 'resend'
import { shortInvoiceNumber } from './formatInvoice'

const ALERT_TO = 'enroll@cominghomecare.com'
const FROM = 'Coming Home Care <support@cominghomecare.com>'
const PORTAL_URL = process.env.BASE_URL || 'https://portal.cominghomecare.com'

export async function sendWelcomeEmail({
  to,
  displayName,
  email,
  password,
}: {
  to: string
  displayName: string
  email: string
  password: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: 'WELCOME: Your Coming Home Care Provider Portal Account is Ready',
      html: `
        <div style="font-family:sans-serif;max-width:520px;padding:32px;color:#2F3E4E">
          <h2 style="margin:0 0 8px;color:#2F3E4E">Welcome to the CHC Provider Portal</h2>
          <p style="margin:0 0 20px;color:#7A8F79;font-size:14px">Your account has been created. Use the credentials below to sign in.</p>

          <div style="background:#f4f6f8;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <p style="margin:0 0 8px;font-size:14px"><strong>Name:</strong> ${displayName}</p>
            <p style="margin:0 0 8px;font-size:14px"><strong>Email:</strong> ${email}</p>
            <p style="margin:0;font-size:14px"><strong>Temporary Password:</strong> ${password}</p>
          </div>

          <a href="${PORTAL_URL}/login"
             style="display:inline-block;background:#2F3E4E;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">
            Sign In to Your Portal →
          </a>

          <p style="margin-top:24px;font-size:13px;color:#7A8F79">
            Once signed in, you can submit hours, view claim status, and manage your profile.<br/>
            We recommend updating your password after your first login.
          </p>

          <hr style="border:none;border-top:1px solid #D9E1E8;margin:24px 0"/>
          <p style="font-size:11px;color:#aab">This is an automated message from Coming Home Care. Please do not reply to this email.</p>
        </div>
      `,
    })
    return !error
  } catch {
    return false
  }
}

const FEE_PLAN_LABELS: Record<string, string> = {
  A1: 'Medicaid — Single Payer',
  A2: 'Commercial — Single Payer',
  B:  'Dual Payer',
  C:  '3+ Payer',
}

export async function sendInvoiceEmail({
  to,
  nurseName,
  nurseFirstName,
  nurseLastName,
  nurseAddress,
  nurseCity,
  nurseState,
  nurseZip,
  invoiceNumber,
  totalAmount,
  dueTerm,
  dueDate,
  entries,
  notes,
}: {
  to: string
  nurseName: string
  nurseFirstName?: string
  nurseLastName?: string
  nurseAddress?: string
  nurseCity?: string
  nurseState?: string
  nurseZip?: string
  invoiceNumber: string
  totalAmount: number
  dueTerm: string
  dueDate: Date
  entries: { workDate: Date; invoiceFeePlan: string; invoiceFeeAmt: number }[]
  notes?: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const resend = new Resend(process.env.RESEND_API_KEY)

  const fmt = (d: Date) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  const fmtMoney = (n: number) => `$${n.toFixed(2)}`
  const issueDate = fmt(new Date())
  const dueDateFmt = dueTerm === 'ASAP' ? 'Due Immediately' : fmt(dueDate)

  // Build base64 SVG icon data URIs for payment buttons
  const svgImg = (svg: string) =>
    `<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="20" height="20" alt="" style="display:block"/>`
  const venmoIcon = svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M19.04 2c.76 1.27 1.1 2.58 1.1 4.23 0 5.27-4.5 12.11-8.16 16.92H4.22L1 4.01l6.77-.65 1.73 13.92c1.6-2.68 3.58-6.9 3.58-9.77 0-1.57-.27-2.64-.68-3.51H19.04z"/></svg>`)
  const cashappIcon = svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M13.567 7.9c.84.23 1.62.69 2.19 1.35l1.67-1.67a6.42 6.42 0 00-3.86-1.88V4h-2v1.72c-2.3.4-3.97 2.06-3.97 4.13 0 2.37 1.85 3.38 3.97 3.93v3.37c-.9-.18-1.74-.64-2.36-1.32L7.4 17.5a6.5 6.5 0 004.16 1.78V21h2v-1.73c2.34-.37 4.03-2.05 4.03-4.2 0-2.44-1.91-3.47-4.03-4v-3.17zm-2 0V5.77c-.88.26-1.47 1-1.47 1.85 0 .8.5 1.35 1.47 1.65v-3.37zm2 8.27c.92-.27 1.53-1.03 1.53-1.9 0-.83-.52-1.4-1.53-1.72v3.62z"/></svg>`)
  const appleIcon = svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`)
  const zelleIcon = svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="white" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" font-size="11" font-weight="900" font-family="Arial,Helvetica,sans-serif" fill="white">Z</text></svg>`)

  // Billed-to address lines
  const billName = (nurseFirstName && nurseLastName) ? `${nurseFirstName} ${nurseLastName}` : nurseName
  const cityLine = [nurseCity, nurseState, nurseZip].filter(Boolean).join(nurseState ? ', ' : ' ')
  const addressBlock = [
    nurseAddress ? `<p style="margin:2px 0 0;font-size:12px;color:#7A8F79">${nurseAddress}</p>` : '',
    cityLine     ? `<p style="margin:2px 0 0;font-size:12px;color:#7A8F79">${cityLine}</p>`    : '',
  ].join('')

  // Payment deep links
  const shortNum   = shortInvoiceNumber(invoiceNumber)
  const venmoUrl   = `https://venmo.com/AlexMcGann?txn=pay&amount=${totalAmount.toFixed(2)}&note=${encodeURIComponent(shortNum)}`
  const cashappUrl = `https://cash.app/$myInvoiceCHC/${totalAmount.toFixed(2)}`
  const zelleUrl   = `mailto:support@cominghomecare.com?subject=${encodeURIComponent(`Zelle Payment – ${shortNum}`)}`
  const appleUrl   = `mailto:support@cominghomecare.com?subject=${encodeURIComponent(`Apple Pay – ${shortNum}`)}`

  // Reusable payment button builder
  const payBtn = (href: string, bg: string, icon: string, label: string, handle: string) => `
    <td style="padding:4px;width:50%">
      <a href="${href}" style="display:block;background:${bg};border-radius:12px;padding:12px 14px;text-decoration:none">
        <table style="border-collapse:collapse;width:100%"><tr>
          <td style="width:24px;padding:0;vertical-align:middle">${icon}</td>
          <td style="padding:0 0 0 9px;vertical-align:middle">
            <p style="margin:0;font-size:13px;font-weight:800;color:#ffffff;line-height:1.2">${label}</p>
            <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.75);line-height:1">${handle}</p>
          </td>
        </tr></table>
      </a>
    </td>`

  const lineItems = entries.map(e => `
    <tr>
      <td style="padding:10px 0;font-size:13px;color:#2F3E4E;border-bottom:1px solid #f0f4f0">${fmt(e.workDate)}</td>
      <td style="padding:10px 12px;font-size:13px;color:#2F3E4E;border-bottom:1px solid #f0f4f0">
        <span style="background:#2F3E4E;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:0.5px">${e.invoiceFeePlan}</span>
      </td>
      <td style="padding:10px 0;font-size:13px;color:#4a5a6a;border-bottom:1px solid #f0f4f0">${FEE_PLAN_LABELS[e.invoiceFeePlan] || e.invoiceFeePlan}</td>
      <td style="padding:10px 0;font-size:13px;color:#2F3E4E;font-weight:600;text-align:right;border-bottom:1px solid #f0f4f0">${fmtMoney(e.invoiceFeeAmt)}</td>
    </tr>
  `).join('')

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `INVOICE ${shortNum} — Coming Home Care Services, LLC`,
      html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#D9E1E8;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="padding:40px 16px">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(47,62,78,0.14)">

  <!-- Header -->
  <div style="background:#2F3E4E;padding:32px 40px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:16px">
      <div style="background:#ffffff;border-radius:10px;padding:8px 14px;display:inline-block;line-height:0">
        <img src="${PORTAL_URL}/chc_logo.png" alt="Coming Home Care" style="height:52px;width:auto;display:block"/>
      </div>
    </div>
    <div style="text-align:right">
      <p style="margin:0;color:#7A8F79;font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:700">Invoice</p>
      <p style="margin:6px 0 0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:1px">${shortNum}</p>
    </div>
  </div>

  <!-- Subheader stripe -->
  <div style="background:#7A8F79;padding:10px 40px;text-align:right">
    <p style="margin:0;color:#f0f4f0;font-size:11px">support@cominghomecare.com</p>
  </div>

  <!-- Bill To + Dates -->
  <div style="padding:28px 40px;display:flex;justify-content:space-between;border-bottom:1px solid #D9E1E8">
    <div>
      <p style="margin:0 0 6px;font-size:10px;color:#7A8F79;text-transform:uppercase;letter-spacing:2px;font-weight:700">Billed To</p>
      <p style="margin:0;font-size:17px;font-weight:800;color:#2F3E4E">${billName}</p>
      ${addressBlock}
    </div>
    <div style="text-align:right">
      <div style="margin-bottom:10px">
        <p style="margin:0;font-size:10px;color:#7A8F79;text-transform:uppercase;letter-spacing:2px;font-weight:700">Issued</p>
        <p style="margin:3px 0 0;font-size:13px;color:#2F3E4E;font-weight:600">${issueDate}</p>
      </div>
      <div>
        <p style="margin:0;font-size:10px;color:#7A8F79;text-transform:uppercase;letter-spacing:2px;font-weight:700">Due</p>
        <p style="margin:3px 0 0;font-size:13px;color:#2F3E4E;font-weight:800">${dueDateFmt}</p>
      </div>
    </div>
  </div>

  <!-- Line Items -->
  <div style="padding:24px 40px">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="border-bottom:2px solid #2F3E4E">
          <th style="text-align:left;padding:6px 0 10px;font-size:10px;color:#7A8F79;text-transform:uppercase;letter-spacing:1.5px;font-weight:700">Service Date</th>
          <th style="text-align:left;padding:6px 12px 10px;font-size:10px;color:#7A8F79;text-transform:uppercase;letter-spacing:1.5px;font-weight:700">Plan</th>
          <th style="text-align:left;padding:6px 0 10px;font-size:10px;color:#7A8F79;text-transform:uppercase;letter-spacing:1.5px;font-weight:700">Description</th>
          <th style="text-align:right;padding:6px 0 10px;font-size:10px;color:#7A8F79;text-transform:uppercase;letter-spacing:1.5px;font-weight:700">Fee</th>
        </tr>
      </thead>
      <tbody>${lineItems}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:16px 0 0;font-size:11px;font-weight:700;color:#7A8F79;text-transform:uppercase;letter-spacing:1.5px">Total Due</td>
          <td style="padding:16px 0 0;text-align:right;font-size:28px;font-weight:800;color:#2F3E4E">${fmtMoney(totalAmount)}</td>
        </tr>
      </tfoot>
    </table>
    ${notes ? `<div style="margin-top:16px;padding:12px 16px;background:#f4f6f8;border-left:3px solid #7A8F79;border-radius:0 8px 8px 0"><p style="margin:0;font-size:12px;color:#4a5a6a"><strong>Note:</strong> ${notes}</p></div>` : ''}
  </div>

  <!-- Payment Options -->
  <div style="margin:0 40px 32px;background:#f4f6f8;border-radius:14px;padding:24px 28px">
    <p style="margin:0 0 14px;font-size:10px;color:#7A8F79;text-transform:uppercase;letter-spacing:2px;font-weight:700">How to Pay</p>
    <table style="width:100%;border-collapse:collapse;margin:-4px">
      <tr>
        ${payBtn(venmoUrl,   '#3D95CE', venmoIcon,   'Venmo',     '@AlexMcGann')}
        ${payBtn(cashappUrl, '#00C244', cashappIcon, 'Cash App',  '$myInvoiceCHC')}
      </tr>
      <tr>
        ${payBtn(zelleUrl,  '#6D1ED4', zelleIcon,  'Zelle',     'support@cominghomecare.com')}
        ${payBtn(appleUrl,  '#1c1c1e', appleIcon,  'Apple Pay', 'support@cominghomecare.com')}
      </tr>
    </table>
    <p style="margin:14px 0 0;font-size:11px;color:#9aabb5">Please include <strong>${shortNum}</strong> as your payment note.</p>
    ${totalAmount >= 50 ? '<p style="margin:8px 0 0;font-size:11px;color:#7A8F79;border-top:1px solid #D9E1E8;padding-top:10px">Credit card payments accepted for invoices of $50.00 or more — contact us for details.</p>' : ''}
  </div>

  <!-- CTA -->
  <div style="text-align:center;padding:0 40px 36px">
    <a href="${PORTAL_URL}/nurse/invoices"
       style="display:inline-block;background:#2F3E4E;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:14px;font-weight:700;letter-spacing:0.5px">
      View Invoice in Portal →
    </a>
  </div>

  <!-- Footer -->
  <div style="background:#2F3E4E;padding:20px 40px;display:flex;justify-content:space-between;align-items:center">
    <p style="margin:0;font-size:12px;color:#7A8F79;font-weight:600">Coming Home Care Services, LLC</p>
    <p style="margin:0;font-size:11px;color:#4a5a6a">cominghomecare.com</p>
  </div>

</div>
</div>
</body>
</html>
      `,
    })
    return !error
  } catch {
    return false
  }
}

export async function sendRegistrationConfirmation({
  to,
  displayName,
}: {
  to: string
  displayName: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: 'Welcome to the Coming Home Care Provider Portal',
      html: `
        <div style="font-family:sans-serif;max-width:520px;padding:32px;color:#2F3E4E">
          <h2 style="margin:0 0 8px;color:#2F3E4E">You're in — Welcome to the CHC Portal</h2>
          <p style="margin:0 0 20px;color:#7A8F79;font-size:14px">Hi ${displayName}, your account has been created. Sign in any time using the email and password you registered with.</p>

          <a href="${PORTAL_URL}/login"
             style="display:inline-block;background:#2F3E4E;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">
            Sign In to Your Portal →
          </a>

          <p style="margin-top:24px;font-size:13px;color:#7A8F79">
            Once signed in, you can complete your profile and get started with billing enrollment.<br/>
            If you have any questions, contact us at support@cominghomecare.com.
          </p>

          <hr style="border:none;border-top:1px solid #D9E1E8;margin:24px 0"/>
          <p style="font-size:11px;color:#aab">This is an automated message from Coming Home Care. Please do not reply to this email.</p>
        </div>
      `,
    })
    return !error
  } catch {
    return false
  }
}

export async function sendPasswordResetByAdmin({
  to,
  displayName,
  email,
  password,
}: {
  to: string
  displayName: string
  email: string
  password: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: 'ACTION REQUIRED: Your Coming Home Care Portal Password Has Been Updated',
      html: `
        <div style="font-family:sans-serif;max-width:520px;padding:32px;color:#2F3E4E">
          <h2 style="margin:0 0 8px;color:#2F3E4E">Your Portal Password Was Updated</h2>
          <p style="margin:0 0 20px;color:#7A8F79;font-size:14px">
            Hi ${displayName} — your password for the Coming Home Care Provider Portal has been set by an administrator.
            Use the credentials below to sign in.
          </p>

          <div style="background:#f4f6f8;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <p style="margin:0 0 8px;font-size:14px"><strong>Email:</strong> ${email}</p>
            <p style="margin:0;font-size:14px"><strong>New Password:</strong> ${password}</p>
          </div>

          <a href="${PORTAL_URL}/login"
             style="display:inline-block;background:#2F3E4E;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">
            Sign In to Your Portal →
          </a>

          <p style="margin-top:24px;font-size:13px;color:#7A8F79">
            We recommend updating your password after signing in.<br/>
            If you did not expect this change, please contact us at support@cominghomecare.com.
          </p>

          <hr style="border:none;border-top:1px solid #D9E1E8;margin:24px 0"/>
          <p style="font-size:11px;color:#aab">This is an automated message from Coming Home Care. Please do not reply to this email.</p>
        </div>
      `,
    })
    return !error
  } catch {
    return false
  }
}

export async function sendWeeklyHoursReminder({
  to,
  displayName,
  nurseProfileId,
}: {
  to: string
  displayName: string
  nurseProfileId: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { createHmac } = await import('crypto')
  const unsubToken = createHmac('sha256', process.env.JWT_SECRET!)
    .update(nurseProfileId)
    .digest('hex')
  const unsubUrl = `${PORTAL_URL}/unsubscribe?id=${nurseProfileId}&token=${unsubToken}`

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      replyTo: 'support@cominghomecare.com',
      to,
      subject: 'Reminder: Submit Your Hours for Billing This Week',
      html: `
        <div style="font-family:sans-serif;max-width:520px;padding:32px;color:#2F3E4E">
          <h2 style="margin:0 0 8px;color:#2F3E4E">Hi ${displayName},</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#2F3E4E;line-height:1.6">
            This is your weekly reminder to log any hours worked this week in the CHC Provider Portal.
            Staying current with your time entries helps ensure accurate and timely billing.
          </p>

          <div style="background:#f4f6f8;border-left:4px solid #7A8F79;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:24px">
            <p style="margin:0;font-size:14px;color:#2F3E4E">
              <strong>What to do:</strong> Sign in, head to <em>myDashboard</em>, and submit your hours for each day worked this week.
            </p>
          </div>

          <a href="${PORTAL_URL}/nurse"
             style="display:inline-block;background:#2F3E4E;color:white;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:14px;font-weight:600">
            Go to myDashboard →
          </a>

          <p style="margin-top:24px;font-size:13px;color:#7A8F79;line-height:1.5">
            If you have any questions about your hours or billing, reply to this email and we'll get back to you.
          </p>

          <hr style="border:none;border-top:1px solid #D9E1E8;margin:28px 0"/>
          <p style="font-size:11px;color:#aab;line-height:1.6">
            Coming Home Care Services, LLC · cominghomecare.com<br/>
            You're receiving this because you have an active provider account.<br/>
            <a href="${unsubUrl}" style="color:#7A8F79;text-decoration:underline">Unsubscribe from weekly reminders</a>
          </p>
        </div>
      `,
    })
    return !error
  } catch {
    return false
  }
}

export async function sendBillingInquiry({
  firstName,
  lastName,
  email,
  phone,
  insuranceCount,
  insuranceNames,
}: {
  firstName: string
  lastName: string
  email: string
  phone?: string
  insuranceCount: number
  insuranceNames: string[]
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const resend = new Resend(process.env.RESEND_API_KEY)

  const insuranceList = insuranceNames
    .map((name, i) => `<li style="margin-bottom:4px">${i + 1}. ${name}</li>`)
    .join('')

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: ALERT_TO,
      subject: `BILLING INQUIRY: ${firstName} ${lastName}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;padding:32px;color:#2F3E4E">
          <h2 style="margin:0 0 8px;color:#2F3E4E">New Billing Services Inquiry</h2>
          <p style="margin:0 0 20px;color:#7A8F79;font-size:14px">Submitted via the CHC Billing Services page.</p>

          <div style="background:#f4f6f8;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <p style="margin:0 0 8px;font-size:14px"><strong>Name:</strong> ${firstName} ${lastName}</p>
            <p style="margin:0 0 8px;font-size:14px"><strong>Email:</strong> ${email}</p>
            ${phone ? `<p style="margin:0 0 8px;font-size:14px"><strong>Phone:</strong> ${phone}</p>` : ''}
            <p style="margin:0 0 8px;font-size:14px"><strong>Total Insurances:</strong> ${insuranceCount}</p>
            <p style="margin:0 4px 4px;font-size:14px"><strong>Insurance Names:</strong></p>
            <ul style="margin:0;padding-left:20px;font-size:14px">${insuranceList}</ul>
          </div>

          <hr style="border:none;border-top:1px solid #D9E1E8;margin:24px 0"/>
          <p style="font-size:11px;color:#aab">Submitted from cominghomecare.com/billing</p>
        </div>
      `,
    })
    return !error
  } catch {
    return false
  }
}

export async function sendEnrollmentAlert({
  nurseName,
  action,
  details,
}: {
  nurseName: string
  action: 'opted_out' | 'opted_in' | 're_enrolled'
  details?: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const resend = new Resend(process.env.RESEND_API_KEY)

  const subject =
    action === 'opted_out'   ? `BILLING: ${nurseName} – Opted Out of Billing Services` :
    action === 'opted_in'    ? `BILLING: ${nurseName} – Enrolled in Billing Services` :
                               `BILLING: ${nurseName} – Re-Enrolled in Billing Services`

  const body =
    action === 'opted_out'
      ? `<p><strong>${nurseName}</strong> has opted out of billing services on the CHC Portal.</p>
         <p>They have been informed they can re-enroll at any time from their dashboard.</p>`
      : `<p><strong>${nurseName}</strong> has ${action === 're_enrolled' ? 're-enrolled in' : 'enrolled in'} billing services on the CHC Portal.</p>
         ${details ? `<p><strong>Details:</strong> ${details}</p>` : ''}`

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: ALERT_TO,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:480px;padding:24px">
          <h2 style="color:#2F3E4E;margin-bottom:8px">CHC Portal Alert</h2>
          ${body}
          <hr style="border:none;border-top:1px solid #D9E1E8;margin:16px 0"/>
          <p style="color:#7A8F79;font-size:12px">This is an automated alert from the CHC Provider Portal.</p>
        </div>
      `,
    })
    return !error
  } catch {
    return false
  }
}

export async function sendDocumentExpirationReminder({
  nurseEmail,
  nurseName,
  documentTitle,
  expiresAt,
  daysUntilExpiry,
}: {
  nurseEmail: string
  nurseName: string
  documentTitle: string
  expiresAt: Date
  daysUntilExpiry: number
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const resend = new Resend(process.env.RESEND_API_KEY)

  const expDateStr = expiresAt.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const urgency = daysUntilExpiry <= 7 ? 'urgent' : daysUntilExpiry <= 30 ? 'soon' : 'upcoming'
  const urgencyColor = urgency === 'urgent' ? '#b91c1c' : urgency === 'soon' ? '#d97706' : '#2F3E4E'
  const subject = urgency === 'urgent'
    ? `⚠ URGENT: "${documentTitle}" expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`
    : `Reminder: "${documentTitle}" expires in ${daysUntilExpiry} days`

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: nurseEmail,
      replyTo: 'support@cominghomecare.com',
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:520px;padding:32px;color:#2F3E4E">
          <h2 style="margin:0 0 4px;color:${urgencyColor}">Document Expiration Reminder</h2>
          <p style="margin:0 0 24px;font-size:13px;color:#7A8F79">Coming Home Care Services, LLC</p>

          <div style="background:#f4f6f8;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <p style="margin:0 0 8px;font-size:14px">Hi <strong>${nurseName}</strong>,</p>
            <p style="margin:0 0 16px;font-size:14px">
              This is a reminder that the following document on file with Coming Home Care will expire soon:
            </p>
            <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#2F3E4E">${documentTitle}</p>
            <p style="margin:0;font-size:13px;color:${urgencyColor};font-weight:600">
              Expires: ${expDateStr} (${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''} from now)
            </p>
          </div>

          <p style="font-size:13px;color:#2F3E4E;margin-bottom:8px">
            Please ensure your updated document is submitted to your coordinator before the expiration date to avoid any interruption in services.
          </p>
          <p style="font-size:13px;color:#2F3E4E;margin-bottom:24px">
            If you have questions, reply to this email or contact us at
            <a href="mailto:support@cominghomecare.com" style="color:#7A8F79">support@cominghomecare.com</a>.
          </p>

          <hr style="border:none;border-top:1px solid #D9E1E8;margin:24px 0"/>
          <p style="font-size:11px;color:#aab">Coming Home Care Services, LLC · Automated document reminder</p>
        </div>
      `,
    })
    return !error
  } catch {
    return false
  }
}

export async function sendEdiSummaryEmail({
  unmatched,
  matched,
  summary,
  dryRun = false,
}: {
  unmatched: { claimId: string; submittedDate: string | null; status: string; payerName: string | null }[]
  matched: { claimId: string; changes: string[]; status: string; payerName: string | null; submittedDate: string | null; errorCode: string | null }[]
  summary: {
    filesUploaded: number
    filesParsed: number
    claimsFound: number
    claimsMatched: number
    claimsUnmatched: number
  }
  dryRun?: boolean
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const resend = new Resend(process.env.RESEND_API_KEY)

  const now = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })

  const statusColor = (s: string) =>
    s === 'accepted' ? '#15803d' : s === 'rejected' || s === 'warning' ? '#b91c1c' : '#7A8F79'

  const statusLabel = (s: string) =>
    s === 'accepted' ? 'Accepted' : s === 'rejected' ? 'Rejected' : s === 'warning' ? 'Warning' : 'Unknown'

  const unmatchedRows = unmatched.map(u => `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:8px 12px;font-family:monospace;font-size:13px;color:#2F3E4E">${u.claimId}</td>
      <td style="padding:8px 12px;font-size:13px;color:#2F3E4E">${u.submittedDate || '—'}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:${statusColor(u.status)}">${statusLabel(u.status)}</td>
      <td style="padding:8px 12px;font-size:13px;color:#7A8F79">${u.payerName || '—'}</td>
    </tr>`).join('')

  const matchedRows = matched.map(m => `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:8px 12px;font-family:monospace;font-size:13px;color:#2F3E4E">${m.claimId}</td>
      <td style="padding:8px 12px;font-size:13px;color:#2F3E4E">${m.submittedDate || '—'}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:${statusColor(m.status)}">${statusLabel(m.status)}</td>
      <td style="padding:8px 12px;font-size:13px;color:#7A8F79">${m.payerName || '—'}</td>
      <td style="padding:8px 12px;font-size:13px;color:#7A8F79">${m.errorCode || '—'}</td>
      <td style="padding:8px 12px;font-size:13px;color:#7A8F79">${m.changes.length > 0 ? m.changes.join(' · ') : 'no changes'}</td>
    </tr>`).join('')

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: 'alex@cominghomecare.com',
      replyTo: 'support@cominghomecare.com',
      subject: dryRun
        ? `[PREVIEW] EDI Summary — ${unmatched.length} unmatched · No changes made`
        : `EDI Upload Summary — ${unmatched.length} unmatched claim${unmatched.length !== 1 ? 's' : ''}`,
      html: `
        <div style="font-family:sans-serif;max-width:680px;padding:32px;color:#2F3E4E">
          ${dryRun ? `
          <div style="background:#fef9c3;border:2px solid #fbbf24;border-radius:10px;padding:14px 18px;margin-bottom:20px">
            <p style="margin:0;font-size:14px;font-weight:700;color:#92400e">⚠ PREVIEW ONLY — No claim lines were updated</p>
            <p style="margin:4px 0 0;font-size:13px;color:#92400e">This is a dry-run summary. The portal database was not modified. Re-upload with "Update live claims" selected to apply changes.</p>
          </div>` : ''}
          <h2 style="margin:0 0 4px;color:#2F3E4E">${dryRun ? 'EDI Preview Summary' : 'EDI Upload Summary'}</h2>
          <p style="margin:0 0 24px;font-size:13px;color:#7A8F79">${now} · Files processed in-memory only — no file content is stored.</p>

          <table style="width:100%;border-collapse:collapse;margin-bottom:28px;background:#F4F6F5;border-radius:8px;overflow:hidden">
            <tr>
              <td style="padding:14px 18px;text-align:center">
                <div style="font-size:22px;font-weight:700;color:#2F3E4E">${summary.filesUploaded}</div>
                <div style="font-size:11px;color:#7A8F79;text-transform:uppercase;letter-spacing:.05em">Files Uploaded</div>
              </td>
              <td style="padding:14px 18px;text-align:center">
                <div style="font-size:22px;font-weight:700;color:#2F3E4E">${summary.claimsFound}</div>
                <div style="font-size:11px;color:#7A8F79;text-transform:uppercase;letter-spacing:.05em">Claims in Files</div>
              </td>
              <td style="padding:14px 18px;text-align:center">
                <div style="font-size:22px;font-weight:700;color:#15803d">${summary.claimsMatched}</div>
                <div style="font-size:11px;color:#7A8F79;text-transform:uppercase;letter-spacing:.05em">${dryRun ? 'Matched (preview)' : 'Matched & Updated'}</div>
              </td>
              <td style="padding:14px 18px;text-align:center">
                <div style="font-size:22px;font-weight:700;color:${unmatched.length > 0 ? '#b91c1c' : '#2F3E4E'}">${summary.claimsUnmatched}</div>
                <div style="font-size:11px;color:#7A8F79;text-transform:uppercase;letter-spacing:.05em">Not in Portal</div>
              </td>
            </tr>
          </table>

          ${unmatched.length > 0 ? `
          <h3 style="margin:0 0 10px;font-size:14px;color:#b91c1c;text-transform:uppercase;letter-spacing:.05em">
            ⚠ Claims in EDI Files — Not Yet in Portal
          </h3>
          <p style="margin:0 0 12px;font-size:13px;color:#7A8F79">These claim IDs appeared in the uploaded files but have no matching record in the portal. Import a CSV to add them.</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
            <thead>
              <tr style="background:#2F3E4E;color:white;font-size:11px;text-transform:uppercase;letter-spacing:.05em">
                <th style="padding:8px 12px;text-align:left">Claim ID</th>
                <th style="padding:8px 12px;text-align:left">Submit Date</th>
                <th style="padding:8px 12px;text-align:left">Status</th>
                <th style="padding:8px 12px;text-align:left">Payer</th>
              </tr>
            </thead>
            <tbody>${unmatchedRows}</tbody>
          </table>` : `
          <p style="font-size:14px;color:#15803d;font-weight:600;margin-bottom:28px">✓ All claims in the uploaded files were matched to the portal.</p>`}

          ${matched.length > 0 ? `
          <h3 style="margin:0 0 10px;font-size:14px;color:#2F3E4E;text-transform:uppercase;letter-spacing:.05em">
            ✓ Matched Claims — Full Detail
          </h3>
          <p style="margin:0 0 12px;font-size:13px;color:#7A8F79">${dryRun ? 'All claims that would have been updated — no changes were written.' : 'All claims found in the EDI files that matched an existing portal record. Notes and stage updates were only applied for non-accepted statuses.'}</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
            <thead>
              <tr style="background:#F4F6F5;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#7A8F79">
                <th style="padding:8px 12px;text-align:left">Claim ID</th>
                <th style="padding:8px 12px;text-align:left">Submit Date</th>
                <th style="padding:8px 12px;text-align:left">Status</th>
                <th style="padding:8px 12px;text-align:left">Payer</th>
                <th style="padding:8px 12px;text-align:left">Error Code</th>
                <th style="padding:8px 12px;text-align:left">Portal Changes</th>
              </tr>
            </thead>
            <tbody>${matchedRows}</tbody>
          </table>` : ''}

          <p style="font-size:11px;color:#aaa;border-top:1px solid #e5e7eb;padding-top:16px;margin:0">
            Coming Home Care Services, LLC · EDI files are processed in-memory and never written to disk or database.
          </p>
        </div>
      `,
    })
    return !error
  } catch {
    return false
  }
}

export async function sendNewDocumentAlert({
  nurseEmail,
  nurseName,
  documentTitle,
  category,
  uploadedAt,
}: {
  nurseEmail: string
  nurseName: string
  documentTitle: string
  category: string
  uploadedAt: Date
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const resend = new Resend(process.env.RESEND_API_KEY)

  const dateStr = uploadedAt.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: nurseEmail,
      replyTo: 'support@cominghomecare.com',
      subject: `New document added to your profile — ${documentTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;padding:32px;color:#2F3E4E">
          <h2 style="margin:0 0 4px;color:#2F3E4E">New Document Added</h2>
          <p style="margin:0 0 24px;font-size:13px;color:#7A8F79">Coming Home Care Services, LLC</p>
          <div style="background:#f4f6f8;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <p style="margin:0 0 10px;font-size:14px">Hi <strong>${nurseName}</strong>,</p>
            <p style="margin:0 0 16px;font-size:14px">A new document has been added to your provider profile:</p>
            <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#2F3E4E">${documentTitle}</p>
            <p style="margin:0 0 4px;font-size:13px;color:#7A8F79">Category: ${category}</p>
            <p style="margin:0;font-size:13px;color:#7A8F79">Added: ${dateStr}</p>
          </div>
          <p style="font-size:13px;color:#2F3E4E;margin-bottom:20px">
            You can view and download this document any time from your
            <a href="${PORTAL_URL}/nurse/documents" style="color:#7A8F79;font-weight:600">myDocuments</a> page.
          </p>
          <hr style="border:none;border-top:1px solid #D9E1E8;margin:24px 0"/>
          <p style="font-size:11px;color:#aab">Coming Home Care Services, LLC · Automated document alert</p>
        </div>
      `,
    })
    return !error
  } catch {
    return false
  }
}

export async function sendNewClaimAlert({
  nurseEmail,
  nurseName,
  claimId,
  dosStart,
  dosStop,
  totalBilled,
}: {
  nurseEmail: string
  nurseName: string
  claimId: string
  dosStart: Date | null
  dosStop: Date | null
  totalBilled: number | null
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const resend = new Resend(process.env.RESEND_API_KEY)

  function fmtDate(d: Date | null) {
    if (!d) return '—'
    return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
  }
  function fmtDOS() {
    if (!dosStart) return '—'
    if (!dosStop) return fmtDate(dosStart)
    if (dosStart.getUTCFullYear() !== dosStop.getUTCFullYear()) return `${fmtDate(dosStart)} – ${fmtDate(dosStop)}`
    if (dosStart.getUTCMonth() !== dosStop.getUTCMonth())
      return `${dosStart.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })} – ${fmtDate(dosStop)}`
    return `${dosStart.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' })} ${dosStart.getUTCDate()}–${dosStop.getUTCDate()}, ${dosStart.getUTCFullYear()}`
  }
  function fmtMoney(n: number | null) {
    if (n == null) return '—'
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: nurseEmail,
      replyTo: 'support@cominghomecare.com',
      subject: `New claim added to your account — ${claimId}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;padding:32px;color:#2F3E4E">
          <h2 style="margin:0 0 4px;color:#2F3E4E">New Claim Added</h2>
          <p style="margin:0 0 24px;font-size:13px;color:#7A8F79">Coming Home Care Services, LLC</p>
          <div style="background:#f4f6f8;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <p style="margin:0 0 12px;font-size:14px">Hi <strong>${nurseName}</strong>,</p>
            <p style="margin:0 0 16px;font-size:14px">A new claim has been added to your account:</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr>
                <td style="padding:6px 0;color:#7A8F79;font-weight:600;width:140px">Claim ID</td>
                <td style="padding:6px 0;font-family:monospace;font-weight:700;color:#2F3E4E">${claimId}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#7A8F79;font-weight:600">Date of Service</td>
                <td style="padding:6px 0;color:#2F3E4E;font-weight:600">${fmtDOS()}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#7A8F79;font-weight:600">Total Billed</td>
                <td style="padding:6px 0;color:#2F3E4E;font-weight:700">${fmtMoney(totalBilled)}</td>
              </tr>
            </table>
          </div>
          <p style="font-size:13px;color:#2F3E4E;margin-bottom:20px">
            Track this claim and all your billing activity on your
            <a href="${PORTAL_URL}/nurse/claims" style="color:#7A8F79;font-weight:600">myClaims</a> page.
          </p>
          <hr style="border:none;border-top:1px solid #D9E1E8;margin:24px 0"/>
          <p style="font-size:11px;color:#aab">Coming Home Care Services, LLC · Automated claim alert</p>
        </div>
      `,
    })
    return !error
  } catch {
    return false
  }
}

export async function sendNurseSharedDocumentAlert({
  nurseName,
  documentTitle,
  category,
  uploadedAt,
}: {
  nurseName: string
  documentTitle: string
  category: string
  uploadedAt: Date
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: ALERT_TO,
      subject: `New Document Shared for Review — ${nurseName}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;padding:32px;color:#2F3E4E">
          <h2 style="margin:0 0 8px;color:#2F3E4E">Document Shared for Review</h2>
          <p style="margin:0 0 20px;color:#7A8F79;font-size:14px">
            A provider has uploaded a document and shared it with Coming Home Care for enrollment, billing, or service review.
          </p>
          <div style="background:#f4f6f8;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <p style="margin:0 0 8px;font-size:14px"><strong>Provider:</strong> ${nurseName}</p>
            <p style="margin:0 0 8px;font-size:14px"><strong>Document:</strong> ${documentTitle}</p>
            <p style="margin:0 0 8px;font-size:14px"><strong>Category:</strong> ${category}</p>
            <p style="margin:0;font-size:14px"><strong>Uploaded:</strong> ${uploadedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <a href="${PORTAL_URL}/admin/documents"
             style="display:inline-block;background:#2F3E4E;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">
            Review in Admin Portal →
          </a>
          <hr style="border:none;border-top:1px solid #D9E1E8;margin:24px 0"/>
          <p style="font-size:11px;color:#aab">Coming Home Care Services, LLC · Automated document alert</p>
        </div>
      `,
    })
    return !error
  } catch {
    return false
  }
}

// Sent to each nurse when admin turns off Bulk Import Mode
// summarizes all queued claims + documents that would have triggered individual alerts
export async function sendBulkImportSummary({
  nurseEmail,
  nurseName,
  claims,
  documents,
}: {
  nurseEmail: string
  nurseName: string
  claims: { claimId: string; dosStart: Date | null; dosStop: Date | null; totalBilled: number | null }[]
  documents: { documentTitle: string; category: string }[]
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const resend = new Resend(process.env.RESEND_API_KEY)

  function fmtDate(d: Date | null) {
    if (!d) return '—'
    return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
  }
  function fmtDOS(start: Date | null, stop: Date | null) {
    if (!start) return '—'
    if (!stop) return fmtDate(start)
    if (start.getUTCFullYear() !== stop.getUTCFullYear()) return `${fmtDate(start)} – ${fmtDate(stop)}`
    if (start.getUTCMonth() !== stop.getUTCMonth())
      return `${start.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })} – ${fmtDate(stop)}`
    return `${start.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' })} ${start.getUTCDate()}–${stop.getUTCDate()}, ${start.getUTCFullYear()}`
  }
  function fmtMoney(n: number | null) {
    if (n == null) return '—'
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const claimRows = claims.map(c => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:8px 0;font-family:monospace;font-size:13px;color:#2F3E4E;font-weight:700">${c.claimId}</td>
      <td style="padding:8px 16px;font-size:13px;color:#2F3E4E">${fmtDOS(c.dosStart, c.dosStop)}</td>
      <td style="padding:8px 0;font-size:13px;color:#2F3E4E;font-weight:600;text-align:right">${fmtMoney(c.totalBilled)}</td>
    </tr>`).join('')

  const docRows = documents.map(d => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:8px 0;font-size:13px;font-weight:600;color:#2F3E4E">${d.documentTitle}</td>
      <td style="padding:8px 0 8px 16px;font-size:13px;color:#7A8F79">${d.category}</td>
    </tr>`).join('')

  const parts: string[] = []
  if (claims.length > 0) parts.push(`${claims.length} new claim${claims.length !== 1 ? 's' : ''}`)
  if (documents.length > 0) parts.push(`${documents.length} new document${documents.length !== 1 ? 's' : ''}`)

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: nurseEmail,
      replyTo: 'support@cominghomecare.com',
      subject: `CHC Portal Update — ${parts.join(' & ')} added to your account`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;padding:32px;color:#2F3E4E">
          <h2 style="margin:0 0 4px;color:#2F3E4E">Portal Update Summary</h2>
          <p style="margin:0 0 24px;font-size:13px;color:#7A8F79">Coming Home Care Services, LLC</p>

          <div style="background:#f4f6f8;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <p style="margin:0 0 16px;font-size:14px">Hi <strong>${nurseName}</strong>,</p>
            <p style="margin:0;font-size:14px;color:#2F3E4E">
              The following items were recently added to your account. You can view all details in the portal.
            </p>
          </div>

          ${claims.length > 0 ? `
          <h3 style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#7A8F79">
            New Claims (${claims.length})
          </h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
            <thead>
              <tr style="background:#F4F6F5;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#7A8F79">
                <th style="padding:8px 0;text-align:left;font-weight:700">Claim ID</th>
                <th style="padding:8px 16px;text-align:left;font-weight:700">Date of Service</th>
                <th style="padding:8px 0;text-align:right;font-weight:700">Total Billed</th>
              </tr>
            </thead>
            <tbody>${claimRows}</tbody>
          </table>` : ''}

          ${documents.length > 0 ? `
          <h3 style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#7A8F79">
            New Documents (${documents.length})
          </h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
            <thead>
              <tr style="background:#F4F6F5;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#7A8F79">
                <th style="padding:8px 0;text-align:left;font-weight:700">Document</th>
                <th style="padding:8px 0 8px 16px;text-align:left;font-weight:700">Category</th>
              </tr>
            </thead>
            <tbody>${docRows}</tbody>
          </table>` : ''}

          <a href="${PORTAL_URL}/nurse"
             style="display:inline-block;background:#2F3E4E;color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;margin-bottom:24px">
            View in Portal →
          </a>

          <hr style="border:none;border-top:1px solid #D9E1E8;margin:24px 0"/>
          <p style="font-size:11px;color:#aab">Coming Home Care Services, LLC · Automated portal update summary</p>
        </div>
      `,
    })
    return !error
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Pay Interest — 28-day claim submit date alert
// ─────────────────────────────────────────────────────────────────────────────
export async function sendPromptPayReminder({
  toEmail,
  fromEmail,
  providerName,
  claimId,
  submitDate,
  day30,
  formLinkName,
  formUrl,
  subjectTemplate,
  customNote,
}: {
  toEmail: string
  fromEmail: string
  providerName: string
  claimId: string
  submitDate: Date
  day30: Date
  formLinkName: string
  formUrl: string | null
  subjectTemplate: string
  customNote: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const resend = new Resend(process.env.RESEND_API_KEY)

  const fmtD = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

  const subject = subjectTemplate
    .replace('{claimId}', claimId)
    .replace('{provider}', providerName)
    .replace('{day30}', fmtD(day30))

  const formBlock = formUrl
    ? `<a href="${formUrl}" style="display:inline-block;background:#7A8F79;color:white;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600;margin-top:16px">${formLinkName} →</a>`
    : `<p style="color:#7A8F79;font-size:13px;margin-top:16px;font-style:italic">No form link configured — add one in adEmail settings.</p>`

  const noteBlock = customNote.trim()
    ? `<div style="background:#f4f6f8;border-radius:8px;padding:14px 18px;margin-top:20px"><p style="margin:0;font-size:13px;color:#2F3E4E">${customNote.replace(/\n/g, '<br/>')}</p></div>`
    : ''

  try {
    const { error } = await resend.emails.send({
      from: `Coming Home Care Alerts <${fromEmail}>`,
      to: toEmail,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:560px;padding:32px;color:#2F3E4E">
          <div style="background:#2F3E4E;border-radius:12px;padding:20px 24px;margin-bottom:28px">
            <p style="margin:0;font-size:20px;font-weight:700;color:white">⏰ Prompt Pay Interest Alert</p>
          </div>

          <p style="font-size:15px;color:#2F3E4E;margin:0 0 20px">
            A claim has reached <strong>28 days</strong> since submission. Prompt Pay interest may apply on <strong>${fmtD(day30)}</strong> (day 30).
          </p>

          <div style="background:#f4f6f8;border-radius:10px;padding:20px 24px;margin-bottom:20px">
            <table style="width:100%;border-collapse:collapse">
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#7A8F79;width:140px">Provider</td>
                <td style="padding:6px 0;font-size:14px;font-weight:600;color:#2F3E4E">${providerName}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#7A8F79">Claim ID</td>
                <td style="padding:6px 0;font-size:14px;font-weight:600;color:#2F3E4E;font-family:monospace">${claimId}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#7A8F79">Submit Date</td>
                <td style="padding:6px 0;font-size:14px;color:#2F3E4E">${fmtD(submitDate)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#7A8F79">Day 30 Deadline</td>
                <td style="padding:6px 0;font-size:14px;font-weight:700;color:#c0392b">${fmtD(day30)}</td>
              </tr>
            </table>
          </div>

          ${formBlock}
          ${noteBlock}

          <hr style="border:none;border-top:1px solid #D9E1E8;margin:28px 0"/>
          <p style="font-size:11px;color:#aab">
            Coming Home Care Services, LLC · Automated claim alert<br/>
            To manage alert settings, visit the adEmail page in the provider portal.
          </p>
        </div>
      `,
    })
    return !error
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment Receipt Email
// ─────────────────────────────────────────────────────────────────────────────
export async function sendReceiptEmail({
  to,
  nurseName,
  nurseFirstName,
  nurseLastName,
  accountNumber,
  receiptNumber,
  invoiceNumber,
  paymentAmount,
  paymentMethod,
  paymentNote,
  appliedAt,
  invoiceTotal,
  previouslyPaid,
  newTotalPaid,
  balance,
  newStatus,
}: {
  to: string
  nurseName: string
  nurseFirstName?: string
  nurseLastName?: string
  accountNumber?: string | null
  receiptNumber: string
  invoiceNumber: string
  paymentAmount: number
  paymentMethod?: string | null
  paymentNote?: string | null
  appliedAt: Date
  invoiceTotal: number
  previouslyPaid: number
  newTotalPaid: number
  balance: number
  newStatus: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const resend = new Resend(process.env.RESEND_API_KEY)

  const fmt = (d: Date) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  const fmtMoney = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const isPaidInFull = newStatus === 'Paid' || balance <= 0
  const billName = (nurseFirstName && nurseLastName) ? `${nurseFirstName} ${nurseLastName}` : nurseName

  const svgImg = (svg: string) =>
    `<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="18" height="18" alt="" style="display:inline-block;vertical-align:middle;margin-right:6px"/>`
  const checkIcon = svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`)

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `RECEIPT ${receiptNumber} — Payment Applied to ${shortInvoiceNumber(invoiceNumber)}`,
      html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#D9E1E8;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="padding:40px 16px">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(47,62,78,0.14)">

  <!-- Header -->
  <div style="background:#2F3E4E;padding:28px 40px;display:flex;align-items:center;justify-content:space-between">
    <div style="background:#ffffff;border-radius:10px;padding:8px 14px;display:inline-block;line-height:0">
      <img src="${PORTAL_URL}/chc_logo.png" alt="Coming Home Care" style="height:52px;width:auto;display:block"/>
    </div>
    <div style="text-align:right">
      <p style="margin:0;color:#7A8F79;font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:700">Receipt</p>
      <p style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:1px">${receiptNumber}</p>
      <p style="margin:4px 0 0;color:#7A8F79;font-size:11px">Invoice ${shortInvoiceNumber(invoiceNumber)}</p>
    </div>
  </div>

  <!-- Payment received stripe -->
  <div style="background:${isPaidInFull ? '#16a34a' : '#2563eb'};padding:18px 40px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center">
      ${checkIcon}
      <p style="margin:0;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">
        ${isPaidInFull ? 'Paid in Full' : 'Payment Received'}
      </p>
    </div>
    <p style="margin:0;color:#ffffff;font-size:26px;font-weight:900">${fmtMoney(paymentAmount)}</p>
  </div>

  <!-- Provider + Payment Details -->
  <div style="padding:28px 40px;display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #D9E1E8">
    <div style="flex:1">
      <p style="margin:0 0 6px;font-size:10px;color:#7A8F79;text-transform:uppercase;letter-spacing:2px;font-weight:700">Provider</p>
      <p style="margin:0;font-size:16px;font-weight:800;color:#2F3E4E">${billName}</p>
      <p style="margin:3px 0 0;font-size:12px;color:#7A8F79">${to}</p>
      ${accountNumber ? `<p style="margin:3px 0 0;font-size:11px;font-family:monospace;color:#7A8F79">Acct: ${accountNumber}</p>` : ''}
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="margin-bottom:10px">
        <p style="margin:0;font-size:10px;color:#7A8F79;text-transform:uppercase;letter-spacing:2px;font-weight:700">Applied</p>
        <p style="margin:3px 0 0;font-size:13px;color:#2F3E4E;font-weight:600">${fmt(appliedAt)}</p>
      </div>
      ${paymentMethod ? `
      <div>
        <p style="margin:0;font-size:10px;color:#7A8F79;text-transform:uppercase;letter-spacing:2px;font-weight:700">Method</p>
        <p style="margin:3px 0 0;font-size:13px;color:#2F3E4E;font-weight:600">${paymentMethod}</p>
      </div>` : ''}
    </div>
  </div>

  <!-- Invoice Summary -->
  <div style="padding:24px 40px">
    <p style="margin:0 0 14px;font-size:10px;color:#7A8F79;text-transform:uppercase;letter-spacing:2px;font-weight:700">Invoice Summary</p>
    <table style="width:100%;border-collapse:collapse">
      <tr style="border-bottom:1px solid #f0f4f0">
        <td style="padding:10px 0;font-size:13px;color:#7A8F79">Invoice Total</td>
        <td style="padding:10px 0;font-size:13px;color:#2F3E4E;font-weight:600;text-align:right">${fmtMoney(invoiceTotal)}</td>
      </tr>
      ${previouslyPaid > 0 ? `
      <tr style="border-bottom:1px solid #f0f4f0">
        <td style="padding:10px 0;font-size:13px;color:#7A8F79">Previously Paid</td>
        <td style="padding:10px 0;font-size:13px;color:#16a34a;font-weight:600;text-align:right">&#8722;${fmtMoney(previouslyPaid)}</td>
      </tr>` : ''}
      <tr style="border-bottom:2px solid #2F3E4E">
        <td style="padding:10px 0;font-size:13px;font-weight:700;color:#2F3E4E">This Payment</td>
        <td style="padding:10px 0;font-size:16px;font-weight:800;color:#2F3E4E;text-align:right">&#8722;${fmtMoney(paymentAmount)}</td>
      </tr>
      <tr>
        <td style="padding:14px 0 0;font-size:12px;font-weight:700;color:#7A8F79;text-transform:uppercase;letter-spacing:1px">Remaining Balance</td>
        <td style="padding:14px 0 0;font-size:24px;font-weight:900;text-align:right;color:${isPaidInFull ? '#16a34a' : '#dc2626'}">${fmtMoney(balance)}</td>
      </tr>
    </table>

    ${isPaidInFull ? `
    <div style="margin-top:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;text-align:center">
      <p style="margin:0;font-size:14px;font-weight:800;color:#16a34a">&#10003; Invoice Paid in Full &#8212; Thank You!</p>
    </div>` : `
    <div style="margin-top:20px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 18px">
      <p style="margin:0;font-size:12px;color:#2563eb">Remaining balance of <strong>${fmtMoney(balance)}</strong> is due on the original invoice terms.</p>
    </div>`}

    ${paymentNote ? `<div style="margin-top:14px;padding:10px 14px;background:#f4f6f8;border-left:3px solid #7A8F79;border-radius:0 8px 8px 0"><p style="margin:0;font-size:12px;color:#4a5a6a"><strong>Note:</strong> ${paymentNote}</p></div>` : ''}
  </div>

  <!-- CTA -->
  <div style="text-align:center;padding:0 40px 32px">
    <a href="${PORTAL_URL}/nurse/invoices"
       style="display:inline-block;background:#2F3E4E;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:14px;font-weight:700;letter-spacing:0.5px">
      View Invoice in Portal &#8594;
    </a>
  </div>

  <!-- Footer -->
  <div style="background:#2F3E4E;padding:20px 40px;display:flex;justify-content:space-between;align-items:center">
    <p style="margin:0;font-size:12px;color:#7A8F79;font-weight:600">Coming Home Care Services, LLC</p>
    <p style="margin:0;font-size:11px;color:#4a5a6a">cominghomecare.com</p>
  </div>

</div>
</div>
</body>
</html>
      `,
    })
    return !error
  } catch {
    return false
  }
}
