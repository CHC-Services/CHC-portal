import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const nurse = await prisma.nurseProfile.findUnique({ where: { userId: session.id } })
  if (!nurse) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const invoices = await prisma.invoice.findMany({
    where: { nurseId: nurse.id },
    orderBy: { createdAt: 'desc' },
    include: {
      entries: {
        select: { workDate: true, hours: true, invoiceFeePlan: true, invoiceFeeAmt: true },
        orderBy: { workDate: 'asc' },
      },
    },
  })

  return NextResponse.json(invoices)
}
