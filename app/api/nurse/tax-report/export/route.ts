import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { isPaidSubscriber } from '../../../../../lib/planPermissions'
import { uploadToS3, getPresignedDownloadUrl } from '../../../../../lib/s3'
import { generatePdfFromHtml } from '../../../../../lib/generateInvoicePdf'
import { buildNurseTaxReportHtml, TaxReportFilterKey } from '../../../../../lib/incomeReportHtml'
import { aggregateClaimIncome, aggregateNurseInvoiceExpense } from '../../../../../lib/incomeReporting'

// Puppeteer launching headless Chromium + rendering can run past Vercel's
// default serverless timeout.
export const maxDuration = 60

async function requirePaidNurse(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || !['nurse', 'provider'].includes(session.role) || !session.nurseProfileId) return null

  const profile = await (prisma.nurseProfile.findUnique as any)({
    where: { id: session.nurseProfileId },
    select: { planTier: true, trialExpiresAt: true, displayName: true },
  })
  if (!profile || !isPaidSubscriber(profile.planTier, profile.trialExpiresAt)) return null

  return { session, profile }
}

// POST — generate the nurse's year-end tax report as a landscape PDF, store
// it in S3, and drop it into the nurse's own document library (NurseDocument,
// category 'Tax') so it's there to re-download later without regenerating.
// Body: { year, quarter?, filterKey? }
export async function POST(req: Request) {
  const ctx = await requirePaidNurse(req)
  if (!ctx) return NextResponse.json({ error: 'Subscription required' }, { status: 403 })

  const { year, quarter, filterKey } = await req.json()
  const y = parseInt(year, 10)
  if (!y) return NextResponse.json({ error: 'year is required' }, { status: 400 })
  const q = quarter ? parseInt(quarter, 10) : null
  const filter: TaxReportFilterKey = filterKey || 'all_financial'

  const nurseId = ctx.session.nurseProfileId!
  const [claimIncome, expense] = await Promise.all([
    aggregateClaimIncome({ nurseId, year: y }),
    aggregateNurseInvoiceExpense({ nurseId, year: y }),
  ])

  const html = buildNurseTaxReportHtml({
    nurseName: ctx.profile.displayName,
    year: y,
    quarter: q,
    filterKey: filter,
    claimIncome,
    expense,
  })

  const periodLabel = q ? `Q${q}-${y}` : `${y}`
  const fileName = `Tax-Summary-${periodLabel}-${filter}.pdf`
  const storageKey = `nurse-documents/${nurseId}/tax-reports/${Date.now()}-${fileName}`

  let url: string
  try {
    const pdfBuffer = await generatePdfFromHtml(html, { landscape: true })
    await uploadToS3(storageKey, pdfBuffer, 'application/pdf')

    await (prisma.nurseDocument.create as any)({
      data: {
        nurseId,
        title: `Year-End Tax Summary — ${q ? `Q${q} ` : ''}${y}`,
        fileName,
        storageKey,
        category: 'Tax',
        mimeType: 'application/pdf',
        fileSize: pdfBuffer.length,
        uploadedBy: 'system',
        visibleToNurse: true,
        nurseUploaded: false,
      },
    })

    url = await getPresignedDownloadUrl(storageKey, 900, { contentType: 'application/pdf', fileName, inline: true })
  } catch (err) {
    console.error('Tax report PDF generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate the tax report. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, url })
}
