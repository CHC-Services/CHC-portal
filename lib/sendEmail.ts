import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const ALERT_TO = 'enroll@cominghomecare.com'
const FROM = 'CHC Portal <notifications@cominghomecare.com>'

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

  const subject =
    action === 'opted_out'   ? `${nurseName} opted out of billing services` :
    action === 'opted_in'    ? `${nurseName} enrolled in billing services` :
                               `${nurseName} re-enrolled in billing services`

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
