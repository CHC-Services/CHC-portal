import { Resend } from 'resend'

const ALERT_TO = 'enroll@cominghomecare.com'
const FROM = 'Coming Home Care <support@cominghomecare.com>'
const PORTAL_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://portal.cominghomecare.com'

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
