import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

const FEE_AMOUNTS: Record<string, number> = {
  A1: 2.00,
  A2: 3.00,
  B:  4.00,
  C:  6.00,
}

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { readyToInvoice, invoiceFeePlan } = await req.json()

  const data: Record<string, unknown> = { readyToInvoice }

  if (readyToInvoice && invoiceFeePlan) {
    data.invoiceFeePlan = invoiceFeePlan
    data.invoiceFeeAmt = FEE_AMOUNTS[invoiceFeePlan] ?? null
  } else if (!readyToInvoice) {
    data.invoiceFeePlan = null
    data.invoiceFeeAmt = null
  }

  const entry = await prisma.timeEntry.update({ where: { id }, data })
  return NextResponse.json(entry)
}
