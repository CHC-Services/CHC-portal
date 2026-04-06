import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: Request) {
  const { requestor, accountNumber, documentType, comments, requestDate, urgencyLevel } = await req.json()

  if (!requestor || !documentType) {
    return NextResponse.json({ error: 'Requestor and document type are required' }, { status: 400 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
  }

  const isUrgent = urgencyLevel === 'Urgent'
  const subject = `${isUrgent ? 'URGENT — ' : ''}Document Request — ${documentType}`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'Coming Home Care <support@cominghomecare.com>',
    to: 'admin@cominghomecare.com',
    subject,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
        <div style="background:${isUrgent ? '#dc2626' : '#2F3E4E'};padding:16px 24px;border-radius:10px 10px 0 0">
          <h2 style="margin:0;color:white;font-size:18px">${isUrgent ? '🚨 URGENT — ' : ''}Document Request</h2>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;padding:24px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;width:140px">Requestor</td><td style="padding:6px 0;font-size:14px;font-weight:600">${requestor}</td></tr>
            <tr><td style="padding:6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b">Account #</td><td style="padding:6px 0;font-size:14px;font-family:monospace">${accountNumber || '—'}</td></tr>
            <tr><td style="padding:6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b">Document Type</td><td style="padding:6px 0;font-size:14px;font-weight:600">${documentType}</td></tr>
            <tr><td style="padding:6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b">Urgency Level</td><td style="padding:6px 0"><span style="background:${isUrgent ? '#fee2e2' : urgencyLevel === 'Normal' ? '#dbeafe' : '#f0fdf4'};color:${isUrgent ? '#dc2626' : urgencyLevel === 'Normal' ? '#1d4ed8' : '#16a34a'};font-size:12px;font-weight:700;padding:2px 10px;border-radius:999px">${urgencyLevel}</span></td></tr>
            <tr><td style="padding:6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b">Request Date</td><td style="padding:6px 0;font-size:13px">${requestDate}</td></tr>
            ${comments ? `<tr><td style="padding:6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;vertical-align:top">Comments</td><td style="padding:6px 0;font-size:13px;line-height:1.5">${comments}</td></tr>` : ''}
          </table>
        </div>
        <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;text-align:center">Submitted via Coming Home Care provider portal</p>
      </div>
    `,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
