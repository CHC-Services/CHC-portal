import { Resend } from 'resend'

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
  invoiceNumber,
  totalAmount,
  dueTerm,
  dueDate,
  entries,
  notes,
}: {
  to: string
  nurseName: string
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
      subject: `INVOICE ${invoiceNumber} — Coming Home Care Services, LLC`,
      html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#D9E1E8;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="padding:40px 16px">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(47,62,78,0.14)">

  <!-- Header -->
  <div style="background:#2F3E4E;padding:32px 40px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:16px">
      <img src="${PORTAL_URL}/chc_logo.png" alt="CHC" style="height:56px;width:auto"/>
    </div>
    <div style="text-align:right">
      <p style="margin:0;color:#7A8F79;font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:700">Invoice</p>
      <p style="margin:6px 0 0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:1px">${invoiceNumber}</p>
    </div>
  </div>

  <!-- Subheader stripe -->
  <div style="background:#7A8F79;padding:10px 40px;display:flex;justify-content:space-between;align-items:center">
    <p style="margin:0;color:#ffffff;font-size:11px;font-weight:600;letter-spacing:1px">COMING HOME CARE SERVICES, LLC</p>
    <p style="margin:0;color:#f0f4f0;font-size:11px">support@cominghomecare.com</p>
  </div>

  <!-- Bill To + Dates -->
  <div style="padding:28px 40px;display:flex;justify-content:space-between;border-bottom:1px solid #D9E1E8">
    <div>
      <p style="margin:0 0 6px;font-size:10px;color:#7A8F79;text-transform:uppercase;letter-spacing:2px;font-weight:700">Billed To</p>
      <p style="margin:0;font-size:17px;font-weight:800;color:#2F3E4E">${nurseName}</p>
      <p style="margin:3px 0 0;font-size:12px;color:#7A8F79">${to}</p>
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
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="padding:6px 0;width:110px">
          <span style="font-size:13px;color:#2F3E4E;font-weight:700">💚 Venmo</span>
        </td>
        <td style="padding:6px 0;font-size:13px;color:#4a5a6a">@AlexMcGann</td>
      </tr>
      <tr>
        <td style="padding:6px 0"><span style="font-size:13px;color:#2F3E4E;font-weight:700">💚 Zelle</span></td>
        <td style="padding:6px 0;font-size:13px;color:#4a5a6a">support@cominghomecare.com</td>
      </tr>
      <tr>
        <td style="padding:6px 0"><span style="font-size:13px;color:#2F3E4E;font-weight:700">💚 CashApp</span></td>
        <td style="padding:6px 0;font-size:13px;color:#4a5a6a">$myInvoiceCHC</td>
      </tr>
      <tr>
        <td style="padding:6px 0"><span style="font-size:13px;color:#2F3E4E;font-weight:700">🍎 Apple Pay</span></td>
        <td style="padding:6px 0;font-size:13px;color:#4a5a6a">support@cominghomecare.com</td>
      </tr>
    </table>
    ${totalAmount >= 50 ? '<p style="margin:14px 0 0;font-size:11px;color:#7A8F79;border-top:1px solid #D9E1E8;padding-top:12px">Credit card payments accepted for invoices of $50.00 or more — contact us for details.</p>' : ''}
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
