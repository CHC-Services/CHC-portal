import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const nurses = await prisma.nurseProfile.findMany({
    include: {
      user: { select: { id: true, email: true, name: true, role: true, createdAt: true } },
      timeEntries: { orderBy: { workDate: 'desc' } },
      invoices: { select: { totalAmount: true, paidAmount: true, status: true } },
    },
    orderBy: { displayName: 'asc' }
  })

  const result = nurses.map((n: any) => {
    const invoiceBalance = n.invoices.reduce((sum: number, inv: any) => {
      if (inv.status === 'WrittenOff' || inv.status === 'Cancelled') return sum
      return sum + (inv.totalAmount - (inv.paidAmount || 0))
    }, 0)
    const { invoices, ...rest } = n
    return { ...rest, invoiceBalance }
  })

  return NextResponse.json(result)
}
