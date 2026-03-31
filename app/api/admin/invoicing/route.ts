import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') // 'stats' | 'income' | 'all'
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

  if (view === 'income') {
    // Monthly + yearly income breakdown
    const invoices = await (prisma.invoice.findMany as any)({
      where: {
        status: { in: ['Paid', 'Partial'] },
        sentAt: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31T23:59:59`),
        },
      },
      select: { sentAt: true, paidAmount: true, totalAmount: true, status: true, nurseId: true },
    })

    const monthly: Record<number, { invoiced: number; collected: number; count: number }> = {}
    for (let m = 1; m <= 12; m++) monthly[m] = { invoiced: 0, collected: 0, count: 0 }

    for (const inv of invoices) {
      const m = new Date(inv.sentAt).getMonth() + 1
      monthly[m].invoiced += inv.totalAmount
      monthly[m].collected += inv.status === 'Paid' ? inv.totalAmount : (inv.paidAmount || 0)
      monthly[m].count++
    }

    const yearTotal = Object.values(monthly).reduce((s, m) => ({
      invoiced: s.invoiced + m.invoiced,
      collected: s.collected + m.collected,
      count: s.count + m.count,
    }), { invoiced: 0, collected: 0, count: 0 })

    return NextResponse.json({ monthly, yearTotal, year })
  }

  if (view === 'all') {
    const invoices = await (prisma.invoice.findMany as any)({
      orderBy: { sentAt: 'desc' },
      include: {
        nurse: { select: { displayName: true, accountNumber: true } },
        payments: { select: { id: true, amount: true, method: true, appliedAt: true } },
        entries: { select: { id: true } },
      },
    })
    return NextResponse.json(invoices)
  }

  // Default: stats summary
  const [invoices, pendingEntries] = await Promise.all([
    (prisma.invoice.findMany as any)({ select: { status: true, totalAmount: true, paidAmount: true } }),
    (prisma.timeEntry.findMany as any)({
      where: { readyToInvoice: true, invoiceId: null },
      select: { invoiceFeeAmt: true },
    }),
  ])

  const pendingAmt = pendingEntries.reduce((s: number, e: any) => s + (e.invoiceFeeAmt || 0), 0)
  const pendingCount = pendingEntries.length

  const stats = {
    pending: { amount: pendingAmt, count: pendingCount },
    sent: { amount: 0, count: 0 },
    partial: { amount: 0, count: 0 },
    paid: { amount: 0, count: 0 },
    disputed: { amount: 0, count: 0 },
    writtenOff: { amount: 0, count: 0 },
    overdue: { amount: 0, count: 0 },
  }

  const now = new Date()
  for (const inv of invoices) {
    // Treat old "Pending" status as "Sent"
    const status = inv.status === 'Pending' ? 'Sent' : inv.status
    if (status === 'Sent' || status === 'Overdue') {
      // Check if actually overdue
      const key = 'sent'
      stats[key].amount += inv.totalAmount
      stats[key].count++
    } else if (status === 'Partial') {
      stats.partial.amount += inv.totalAmount
      stats.partial.count++
    } else if (status === 'Paid') {
      stats.paid.amount += inv.totalAmount
      stats.paid.count++
    } else if (status === 'Disputed') {
      stats.disputed.amount += inv.totalAmount
      stats.disputed.count++
    } else if (status === 'WrittenOff') {
      stats.writtenOff.amount += inv.totalAmount
      stats.writtenOff.count++
    }
  }

  return NextResponse.json(stats)
}
