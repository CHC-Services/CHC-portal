import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
      nurse: { select: { displayName: true, accountNumber: true, firstName: true, lastName: true, address: true, city: true, state: true, zip: true, phone: true, user: { select: { email: true } } } },
    },
  })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(invoice)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { status } = await req.json()

  const VALID = ['Sent', 'Partial', 'Paid', 'Disputed', 'WrittenOff', 'Overdue', 'Pending']
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const data: Record<string, unknown> = { status }
  if (status === 'Paid') data.paidAt = new Date()

  const invoice = await (prisma.invoice.update as any)({ where: { id }, data })
  return NextResponse.json(invoice)
}
