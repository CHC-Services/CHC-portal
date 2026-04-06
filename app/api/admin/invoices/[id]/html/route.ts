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

const FEE_LABELS: Record<string, string> = {
  A1: 'Medicaid — Single Payer',
  A2: 'Commercial — Single Payer',
  B:  'Dual Payer',
  C:  '3+ Payer',
}

function buildInvoiceHtml(invoice: any): string {
  const nurse = invoice.nurse
  const balance = invoice.totalAmount - (invoice.paidAmount || 0)
  const statusColor: Record<string, string> = {
    Paid: '#16a34a', Partial: '#d97706', Sent: '#2563eb',
    Disputed: '#dc2626', WrittenOff: '#6b7280', Overdue: '#ea580c', Pending: '#2563eb',
  }
  const color = statusColor[invoice.status] || '#6b7280'

  const entryRows = (invoice.entries || []).map((e: any) => `
    <tr style="border-top:1px solid #e2e8f0">
      <td style="padding:8px 16px;font-size:13px">${fmt(e.workDate)}</td>
      <td style="padding:8px 16px;font-size:13px">
        <span style="background:#1e293b;color:white;font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px">${e.invoiceFeePlan || ''}</span>
      </td>
      <td style="padding:8px 16px;font-size:13px;color:#64748b">${FEE_LABELS[e.invoiceFeePlan] || ''}</td>
      <td style="padding:8px 16px;font-size:13px;text-align:right;font-weight:700">$${(e.invoiceFeeAmt || 0).toFixed(2)}</td>
    </tr>`).join('')

  const paymentRows = (invoice.payments || []).map((p: any) => `
    <tr style="border-top:1px solid #e2e8f0;background:#f0fdf4">
      <td colspan="3" style="padding:6px 16px;font-size:12px;color:#16a34a">
        Payment · ${p.receiptNumber} · ${p.method || 'Other'}${p.note ? ` · ${p.note}` : ''} (${fmt(p.appliedAt)})
      </td>
      <td style="padding:6px 16px;font-size:12px;color:#16a34a;text-align:right;font-weight:700">−$${p.amount.toFixed(2)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice ${invoice.invoiceNumber}</title>
<style>
  @media print { body { margin: 0; } .no-print { display: none !important; } }
</style>
</head>
<body style="font-family:system-ui,sans-serif;max-width:680px;margin:32px auto;padding:0 16px;color:#1e293b">
  <div class="no-print" style="margin-bottom:24px;display:flex;gap:10px">
    <button onclick="window.print()" style="background:#1e293b;color:white;border:none;padding:8px 18px;border-radius:6px;font-size:13px;cursor:pointer">
      🖨 Print / Save as PDF
    </button>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px">
    <div>
      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.1em;color:#64748b;text-transform:uppercase">Invoice</p>
      <h2 style="margin:4px 0 2px;font-size:22px;font-weight:900">Coming Home Care Services, LLC</h2>
      <p style="margin:0;font-size:12px;color:#64748b">support@cominghomecare.com · cominghomecare.com</p>
    </div>
    <div style="text-align:right">
      <p style="margin:0;font-family:monospace;font-size:16px;font-weight:700">${invoice.invoiceNumber}</p>
      <span style="font-size:11px;font-weight:700;color:${color};background:${color}18;padding:2px 10px;border-radius:99px;display:inline-block;margin-top:4px">${invoice.status}</span>
      <p style="margin:6px 0 0;font-size:12px;color:#64748b">Issued ${fmt(invoice.sentAt)}</p>
      <p style="margin:2px 0 0;font-size:12px;color:#64748b">Due ${fmt(invoice.dueDate)}</p>
    </div>
  </div>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;margin-bottom:24px">
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Bill To</p>
    <p style="margin:0;font-size:15px;font-weight:700">${nurse?.displayName || invoice.nurseName}</p>
    <p style="margin:0;font-size:13px;color:#64748b">${nurse?.user?.email || invoice.nurseEmail}</p>
    ${nurse?.accountNumber ? `<p style="margin:4px 0 0;font-size:12px;font-family:monospace;color:#64748b">Account: ${nurse.accountNumber}</p>` : ''}
  </div>

  <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px">
    <thead>
      <tr style="background:#f1f5f9">
        <th style="padding:8px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Date</th>
        <th style="padding:8px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Plan</th>
        <th style="padding:8px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Description</th>
        <th style="padding:8px 16px;text-align:right;font-size:11px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Fee</th>
      </tr>
    </thead>
    <tbody>
      ${entryRows}
      ${paymentRows}
      <tr style="border-top:2px solid #1e293b;background:#f8fafc">
        <td colspan="3" style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b">Total Due</td>
        <td style="padding:10px 16px;text-align:right;font-size:20px;font-weight:900;color:${balance > 0 ? '#dc2626' : '#16a34a'}">$${balance.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Payment Methods</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div><p style="margin:0;font-size:12px;font-weight:700">💚 Venmo</p><p style="margin:0;font-size:12px;color:#64748b">@AlexMcGann</p></div>
      <div><p style="margin:0;font-size:12px;font-weight:700">💚 Zelle</p><p style="margin:0;font-size:12px;color:#64748b">support@cominghomecare.com</p></div>
      <div><p style="margin:0;font-size:12px;font-weight:700">💚 CashApp</p><p style="margin:0;font-size:12px;color:#64748b">$myInvoiceCHC</p></div>
      <div><p style="margin:0;font-size:12px;font-weight:700">🍎 Apple Pay</p><p style="margin:0;font-size:12px;color:#64748b">support@cominghomecare.com</p></div>
    </div>
  </div>

  <p style="margin-top:28px;font-size:11px;color:#94a3b8;text-align:center">
    Generated ${fmt(new Date())} · Coming Home Care Services, LLC · This invoice is confidential.
  </p>
</body>
</html>`
}

// GET — returns printable HTML for a single invoice (by invoice id)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: invoiceId } = await params

  const invoice = await (prisma.invoice.findUnique as any)({
    where: { id: invoiceId },
    include: {
      entries: { orderBy: { workDate: 'asc' } },
      payments: { orderBy: { appliedAt: 'asc' } },
      nurse: { select: { displayName: true, accountNumber: true, user: { select: { email: true } } } },
    },
  })

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const html = buildInvoiceHtml(invoice)
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

// POST — emails a single invoice to the nurse
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: invoiceId } = await params

  const invoice = await (prisma.invoice.findUnique as any)({
    where: { id: invoiceId },
    include: {
      entries: { orderBy: { workDate: 'asc' } },
      payments: { orderBy: { appliedAt: 'asc' } },
      nurse: { select: { displayName: true, accountNumber: true, user: { select: { email: true } } } },
    },
  })

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Email not configured' }, { status: 500 })

  const html = buildInvoiceHtml(invoice)
  const nurseEmail = invoice.nurse?.user?.email || invoice.nurseEmail
  const nurseName  = invoice.nurse?.displayName  || invoice.nurseName
  const balance    = invoice.totalAmount - (invoice.paidAmount || 0)

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'Coming Home Care <support@cominghomecare.com>',
    to: nurseEmail,
    subject: `Invoice ${invoice.invoiceNumber} — Coming Home Care Services`,
    html: `<p>Dear ${nurseName},</p>
           <p>Please find your invoice <strong>${invoice.invoiceNumber}</strong> attached below.</p>
           <p><strong>Total:</strong> $${invoice.totalAmount.toFixed(2)}<br/>
           <strong>Balance Due:</strong> $${balance.toFixed(2)}<br/>
           <strong>Due:</strong> ${fmt(invoice.dueDate)}</p>
           ${html}`,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
