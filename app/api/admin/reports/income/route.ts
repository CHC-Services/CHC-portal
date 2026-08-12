import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import {
  aggregateClaimIncome,
  aggregateInvoiceIncome,
  aggregateReceivables,
  aggregateDiscountExpense,
} from '../../../../../lib/incomeReporting'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// GET — on-screen income report data for a given year (monthly + quarterly
// buckets included so the page can switch views without a re-fetch), plus
// the report-history list for re-downloading previously exported PDFs.
export async function GET(req: Request) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || '', 10) || new Date().getFullYear()

  const [invoiceIncome, claimIncome, receivables, discountExpense, reports] = await Promise.all([
    aggregateInvoiceIncome({ year }),
    aggregateClaimIncome({ year }),
    aggregateReceivables(),
    aggregateDiscountExpense({ year }),
    (prisma.adminReport.findMany as any)({
      where: { reportType: 'income_summary' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, periodLabel: true, fileName: true, createdAt: true },
    }),
  ])

  return NextResponse.json({ year, invoiceIncome, claimIncome, receivables, discountExpense, reports })
}
