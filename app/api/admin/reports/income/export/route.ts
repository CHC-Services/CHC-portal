import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { uploadToS3, getPresignedDownloadUrl } from '../../../../../../lib/s3'
import { generatePdfFromHtml } from '../../../../../../lib/generateInvoicePdf'
import { buildAdminIncomeReportHtml } from '../../../../../../lib/incomeReportHtml'
import {
  aggregateClaimIncome,
  aggregateInvoiceIncome,
  aggregateReceivables,
  aggregateDiscountExpense,
} from '../../../../../../lib/incomeReporting'

// Puppeteer launching headless Chromium + rendering can run past Vercel's
// default serverless timeout.
export const maxDuration = 60

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// POST — generate the admin income report as a landscape PDF, store it in
// S3, and index it in AdminReport for later re-download (body: { year,
// quarter? }).
export async function POST(req: Request) {
  const session = adminAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { year, quarter } = await req.json()
  const y = parseInt(year, 10)
  if (!y) return NextResponse.json({ error: 'year is required' }, { status: 400 })
  const q = quarter ? parseInt(quarter, 10) : null

  const [invoiceIncome, claimIncome, receivables, discountExpense] = await Promise.all([
    aggregateInvoiceIncome({ year: y }),
    aggregateClaimIncome({ year: y }),
    aggregateReceivables(),
    aggregateDiscountExpense({ year: y }),
  ])

  const html = buildAdminIncomeReportHtml({ year: y, quarter: q, invoiceIncome, claimIncome, receivables, discountExpense })

  const periodLabel = q ? `Q${q} ${y}` : `${y}`
  const fileName = `Income-Report-${periodLabel.replace(/\s+/g, '-')}.pdf`
  const storageKey = `admin-reports/income/${Date.now()}-${fileName}`

  let report: { id: string; createdAt: Date }
  let url: string
  try {
    const pdfBuffer = await generatePdfFromHtml(html, { landscape: true })
    await uploadToS3(storageKey, pdfBuffer, 'application/pdf')

    report = await (prisma.adminReport.create as any)({
      data: {
        reportType: 'income_summary',
        periodLabel,
        storageKey,
        fileName,
        generatedByUserId: session.id,
      },
    })

    url = await getPresignedDownloadUrl(storageKey, 900, { contentType: 'application/pdf', fileName, inline: true })
  } catch (err) {
    console.error('Income report PDF generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate the income report. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, report: { id: report.id, periodLabel, fileName, createdAt: report.createdAt }, url })
}
