import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { Resend } from 'resend'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

function fmt(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function buildStatementHtml(nurse: any, invoices: any[], statementDate: string): string {
  const totalBilled  = invoices.reduce((s: number, i: any) => s + i.totalAmount, 0)
  const totalPaid    = invoices.reduce((s: number, i: any) => s + (i.paidAmount || 0), 0)
  const outstanding  = totalBilled - totalPaid

  const rows = invoices.map((inv: any) => {
    const balance = inv.totalAmount - (inv.paidAmount || 0)
    const statusColor: Record<string, string> = {
      Paid: '#16a34a', Partial: '#d97706', Sent: '#2563eb',
      Disputed: '#dc2626', WrittenOff: '#6b7280', Overdue: '#ea580c', Pending: '#2563eb',
    }
    const color = statusColor[inv.status] || '#6b7280'
    const entryRows = (inv.entries || []).map((e: any) =>
      `<tr>
        <td style="padding:4px 12px;font-size:12px;color:#6b7280">${fmt(e.workDate)}</td>
        <td style="padding:4px 12px;font-size:12px;color:#6b7280">${e.invoiceFeePlan || ''}</td>
        <td style="padding:4px 12px;font-size:12px;color:#6b7280;text-align:right">$${(e.invoiceFeeAmt || 0).toFixed(2)}</td>
      </tr>`
    ).join('')
    const paymentRows = (inv.payments || []).map((p: any) =>
      `<tr>
        <td colspan="2" style="padding:3px 12px;font-size:12px;color:#16a34a">
          Payment — ${p.method || 'Other'}${p.note ? ` · ${p.note}` : ''} (${fmt(p.appliedAt)})
        </td>
        <td style="padding:3px 12px;font-size:12px;color:#16a34a;text-align:right">-$${p.amount.toFixed(2)}</td>
      </tr>`
    ).join('')

    return `
      <tr style="background:#f8fafc;border-top:2px solid #e2e8f0">
        <td colspan="3" style="padding:8px 12px">
          <table style="width:100%">
            <tr>
              <td style="font-size:13px;font-weight:700;color:#1e293b">${inv.invoiceNumber}</td>
              <td style="font-size:12px;color:#64748b">Issued ${fmt(inv.sentAt)} · Due ${fmt(inv.dueDate)}</td>
              <td style="text-align:right">
                <span style="font-size:11px;font-weight:700;color:${color};background:${color}18;padding:2px 8px;border-radius:99px">${inv.status}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${entryRows}
      ${paymentRows}
      <tr>
        <td colspan="2" style="padding:4px 12px;font-size:12px;font-weight:600;text-align:right">Invoice Total / Balance Due</td>
        <td style="padding:4px 12px;font-size:12px;font-weight:700;text-align:right;color:${balance > 0 ? '#dc2626' : '#16a34a'}">
          $${inv.totalAmount.toFixed(2)} / $${balance.toFixed(2)}
        </td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Statement — ${nurse.displayName}</title>
<style>@media print { body { margin: 0; } button { display: none; } }</style>
</head>
<body style="font-family:system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 16px;color:#1e293b">
  <button onclick="window.print()" style="background:#1e293b;color:white;border:none;padding:8px 18px;border-radius:6px;font-size:13px;cursor:pointer;margin-bottom:24px">
    🖨 Print / Save as PDF
  </button>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
    <div>
      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.1em;color:#64748b;text-transform:uppercase">Account Statement</p>
      <h2 style="margin:4px 0 2px;font-size:22px;font-weight:900">Coming Home Care Services, LLC</h2>
      <p style="margin:0;font-size:12px;color:#64748b">support@cominghomecare.com · cominghomecare.com</p>
    </div>
    <div style="text-align:right">
      <p style="margin:0;font-size:11px;color:#64748b">Statement Date</p>
      <p style="margin:0;font-size:14px;font-weight:700">${statementDate}</p>
    </div>
  </div>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:24px">
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Bill To</p>
    <p style="margin:0;font-size:15px;font-weight:700">${nurse.displayName}</p>
    <p style="margin:0;font-size:13px;color:#64748b">${nurse.email || ''}</p>
    ${nurse.accountNumber ? `<p style="margin:4px 0 0;font-size:12px;font-family:monospace;color:#64748b">Account: ${nurse.accountNumber}</p>` : ''}
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
    <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Total Billed</p>
      <p style="margin:4px 0 0;font-size:20px;font-weight:900">$${totalBilled.toFixed(2)}</p>
    </div>
    <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.08em;color:#16a34a;text-transform:uppercase">Total Paid</p>
      <p style="margin:4px 0 0;font-size:20px;font-weight:900;color:#16a34a">$${totalPaid.toFixed(2)}</p>
    </div>
    <div style="background:white;border:${outstanding > 0 ? '1px solid #fca5a5' : '1px solid #e2e8f0'};border-radius:8px;padding:12px 16px">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.08em;color:${outstanding > 0 ? '#dc2626' : '#64748b'};text-transform:uppercase">Outstanding</p>
      <p style="margin:4px 0 0;font-size:20px;font-weight:900;color:${outstanding > 0 ? '#dc2626' : '#64748b'}">$${outstanding.toFixed(2)}</p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
    <thead>
      <tr style="background:#f1f5f9">
        <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Date</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Plan</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <p style="margin-top:32px;font-size:11px;color:#94a3b8;text-align:center">
    Generated ${statementDate} · Coming Home Care Services, LLC · This statement is confidential.
  </p>
</body>
</html>`
}

// GET ?action=html — returns the HTML for download/print
// POST { action: 'email' } — sends statement via Resend
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: nurseId } = await params // here id = nurseProfileId, not invoice id
  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') || 'all' // 'all' | 'outstanding'

  const nurse = await prisma.nurseProfile.findUnique({
    where: { id: nurseId },
    include: { user: { select: { email: true } } },
  })
  if (!nurse) return NextResponse.json({ error: 'Nurse not found' }, { status: 404 })

  const where: any = { nurseId }
  if (filter === 'outstanding') where.status = { in: ['Sent', 'Partial', 'Overdue', 'Pending'] }

  const invoices = await (prisma.invoice.findMany as any)({
    where,
    orderBy: { sentAt: 'asc' },
    include: {
      entries: { orderBy: { workDate: 'asc' } },
      payments: { orderBy: { appliedAt: 'asc' } },
    },
  })

  const html = buildStatementHtml(
    { displayName: nurse.displayName, email: nurse.user.email, accountNumber: nurse.accountNumber },
    invoices,
    new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  )

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: nurseId } = await params
  const { filter = 'all' } = await req.json().catch(() => ({}))

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
  }

  const nurse = await prisma.nurseProfile.findUnique({
    where: { id: nurseId },
    include: { user: { select: { email: true } } },
  })
  if (!nurse) return NextResponse.json({ error: 'Nurse not found' }, { status: 404 })

  const where: any = { nurseId }
  if (filter === 'outstanding') where.status = { in: ['Sent', 'Partial', 'Overdue', 'Pending'] }

  const invoices = await (prisma.invoice.findMany as any)({
    where,
    orderBy: { sentAt: 'asc' },
    include: { entries: { orderBy: { workDate: 'asc' } }, payments: { orderBy: { appliedAt: 'asc' } } },
  })

  const statementDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const html = buildStatementHtml(
    { displayName: nurse.displayName, email: nurse.user.email, accountNumber: nurse.accountNumber },
    invoices,
    statementDate
  )

  const resend = new Resend(process.env.RESEND_API_KEY)
  const totalBilled  = invoices.reduce((s: number, i: any) => s + i.totalAmount, 0)
  const totalPaid    = invoices.reduce((s: number, i: any) => s + (i.paidAmount || 0), 0)

  const { error } = await resend.emails.send({
    from: 'Coming Home Care <support@cominghomecare.com>',
    to: nurse.user.email,
    subject: `Account Statement — ${statementDate}`,
    html: `<p>Dear ${nurse.displayName},</p>
           <p>Please find your Coming Home Care account statement for ${statementDate} attached below.</p>
           <p><strong>Total Billed:</strong> $${totalBilled.toFixed(2)}<br/>
           <strong>Total Paid:</strong> $${totalPaid.toFixed(2)}<br/>
           <strong>Outstanding:</strong> $${(totalBilled - totalPaid).toFixed(2)}</p>
           ${html}`,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
