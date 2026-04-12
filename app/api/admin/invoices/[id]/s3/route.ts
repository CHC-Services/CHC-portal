import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { uploadToS3, getPresignedDownloadUrl } from '../../../../../../lib/s3'

// Build a self-contained printable HTML invoice (no external deps)
function buildInvoiceHtml(invoice: any): string {
  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  const FEE_LABELS: Record<string, string> = {
    A1: 'Medicaid — Single Payer', A2: 'Commercial — Single Payer', B: 'Dual Payer', C: '3+ Payer',
  }
  const nurse = invoice.nurse
  const balance = invoice.totalAmount - (invoice.paidAmount || 0)
  const PORTAL_URL = process.env.BASE_URL || 'https://cominghomecare.com'
  const useBiz = !!nurse?.hasBusinessProvider
  const billToName = useBiz
    ? (nurse?.bizEntityName || nurse?.displayName || invoice.nurseName)
    : ((nurse?.firstName && nurse?.lastName) ? `${nurse.firstName} ${nurse.lastName}` : (nurse?.displayName || invoice.nurseName))
  const billToAddress = useBiz
    ? (nurse?.bizServiceAddress || '')
    : [nurse?.address, [nurse?.city, nurse?.state].filter(Boolean).join(', ') + (nurse?.zip ? ` ${nurse.zip}` : '')].filter(Boolean).join('<br>')
  const billToPhone = useBiz ? (nurse?.bizPhone || '') : (nurse?.phone || '')
  const billToEmail = useBiz ? (nurse?.bizEmail || nurse?.user?.email || invoice.nurseEmail) : (nurse?.user?.email || invoice.nurseEmail)

  const entryRows = (invoice.entries || []).map((e: any) => `
    <tr style="border-top:1px solid #e2e8f0">
      <td style="padding:8px 16px;font-size:13px">${fmtDate(e.workDate)}</td>
      <td style="padding:8px 16px;font-size:13px">
        <span style="background:#1e293b;color:white;font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px">${e.invoiceFeePlan || ''}</span>
      </td>
      <td style="padding:8px 16px;font-size:13px;color:#64748b">${FEE_LABELS[e.invoiceFeePlan] || ''}</td>
      <td style="padding:8px 16px;font-size:13px;text-align:right;font-weight:700">$${(e.invoiceFeeAmt || 0).toFixed(2)}</td>
    </tr>`).join('')

  const paymentRows = (invoice.payments || []).map((p: any) => `
    <tr style="border-top:1px solid #e2e8f0;background:#f0fdf4">
      <td colspan="3" style="padding:6px 16px;font-size:12px;color:#16a34a">
        Payment · ${p.receiptNumber} · ${p.method || 'Other'}${p.note ? ` · ${p.note}` : ''} (${fmtDate(p.appliedAt)})
      </td>
      <td style="padding:6px 16px;font-size:12px;color:#16a34a;text-align:right;font-weight:700">−$${p.amount.toFixed(2)}</td>
    </tr>`).join('')

  const statusColor: Record<string, string> = {
    Paid: '#16a34a', Partial: '#d97706', Sent: '#2563eb',
    Disputed: '#dc2626', WrittenOff: '#6b7280', Overdue: '#ea580c', Pending: '#2563eb',
  }
  const color = statusColor[invoice.status] || '#6b7280'

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice ${invoice.invoiceNumber}</title>
<style>
  @media print { body { margin: 0; } button { display: none !important; } }
</style>
</head>
<body style="font-family:system-ui,sans-serif;max-width:680px;margin:32px auto;padding:0 16px;color:#1e293b">
  <button onclick="window.print()" style="background:#1e293b;color:white;border:none;padding:8px 18px;border-radius:6px;font-size:13px;cursor:pointer;margin-bottom:24px">
    🖨 Print / Save as PDF
  </button>

  <!-- Header banner -->
  <div style="background:#2F3E4E;border-radius:10px 10px 0 0;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;margin-bottom:0">
    <div style="display:flex;align-items:center;gap:16px">
      <div style="background:white;border-radius:8px;padding:8px 12px;display:inline-block;line-height:0">
        <img src="${PORTAL_URL}/chc_logo.png" alt="Coming Home Care" style="height:48px;width:auto;display:block">
      </div>
      <div>
        <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.1em;color:#7A8F79;text-transform:uppercase">Invoice</p>
        <p style="margin:2px 0 0;font-size:18px;font-weight:900;color:white">Coming Home Care Services, LLC</p>
        <p style="margin:2px 0 0;font-size:11px;color:#D9E1E8">support@cominghomecare.com · cominghomecare.com</p>
      </div>
    </div>
    <div style="text-align:right">
      <p style="margin:0;font-family:monospace;font-size:16px;font-weight:700;color:white">${invoice.invoiceNumber}</p>
      <span style="font-size:11px;font-weight:700;color:${color};background:${color}28;padding:2px 10px;border-radius:99px;display:inline-block;margin-top:4px">${invoice.status}</span>
      <p style="margin:6px 0 0;font-size:12px;color:#D9E1E8">Issued ${fmtDate(invoice.sentAt)}</p>
      <p style="margin:2px 0 0;font-size:12px;color:#D9E1E8">Due ${fmtDate(invoice.dueDate)}</p>
    </div>
  </div>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;padding:14px 18px;margin-bottom:24px">
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Bill To</p>
    <p style="margin:0;font-size:15px;font-weight:700">${billToName}</p>
    ${billToAddress ? `<p style="margin:2px 0 0;font-size:13px;color:#2F3E4E">${billToAddress}</p>` : ''}
    ${billToPhone ? `<p style="margin:2px 0 0;font-size:13px;color:#64748b">${billToPhone}</p>` : ''}
    <p style="margin:2px 0 0;font-size:13px;color:#64748b">${billToEmail}</p>
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
      <div><p style="margin:0;font-size:12px;font-weight:700">Venmo</p><p style="margin:0;font-size:12px;color:#64748b">@AlexMcGann</p></div>
      <div><p style="margin:0;font-size:12px;font-weight:700">Zelle</p><p style="margin:0;font-size:12px;color:#64748b">support@cominghomecare.com</p></div>
      <div><p style="margin:0;font-size:12px;font-weight:700">CashApp</p><p style="margin:0;font-size:12px;color:#64748b">$myInvoiceCHC</p></div>
      <div><p style="margin:0;font-size:12px;font-weight:700">Apple Pay</p><p style="margin:0;font-size:12px;color:#64748b">support@cominghomecare.com</p></div>
    </div>
  </div>

  <p style="margin-top:28px;font-size:11px;color:#94a3b8;text-align:center">
    Generated ${fmtDate(new Date())} · Coming Home Care Services, LLC · This invoice is confidential.
  </p>
</body>
</html>`
}

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST — save invoice to S3, return presigned download URL
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const invoice = await (prisma.invoice.findUnique as any)({
    where: { id },
    include: {
      entries: { orderBy: { workDate: 'asc' } },
      payments: { orderBy: { appliedAt: 'asc' } },
      nurse: { select: { displayName: true, accountNumber: true, firstName: true, lastName: true, address: true, city: true, state: true, zip: true, phone: true, hasBusinessProvider: true, bizEntityName: true, bizServiceAddress: true, bizPhone: true, bizEmail: true, user: { select: { email: true } } } },
    },
  })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const s3Key = `invoices/${invoice.nurseId}/${invoice.invoiceNumber}.html`
  const payload = Buffer.from(buildInvoiceHtml(invoice), 'utf-8')

  await uploadToS3(s3Key, payload, 'text/html; charset=utf-8')

  await (prisma.invoice.update as any)({ where: { id }, data: { s3Key } })

  const url = await getPresignedDownloadUrl(s3Key, 900)

  return NextResponse.json({ ok: true, s3Key, url })
}

// GET — get presigned download URL for existing stored invoice
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const invoice = await (prisma.invoice.findUnique as any)({ where: { id }, select: { s3Key: true } })
  if (!invoice?.s3Key) return NextResponse.json({ error: 'Not stored in S3 yet' }, { status: 404 })

  const url = await getPresignedDownloadUrl(invoice.s3Key, 900)
  return NextResponse.json({ url })
}
