import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

const FEE_AMOUNTS: Record<string, number> = {
  'ST-MED':  3.00,
  'ST-COM':  4.00,
  'ST-DUAL': 5.00,
  'LT-MED':  2.00,
  'LT-COM':  3.00,
  'LT-DUAL': 4.00,
  'VR-MED':  4.00,
  'VR-COM':  5.00,
  'CORR':    3.00,
  'SAMEDAY': 10.00,
  // Legacy plan codes kept for backward compat
  A1: 2.00,
  A2: 3.00,
  B:  4.00,
  C:  6.00,
}

const PER_CLAIM_PLANS = new Set(['VR-MED', 'VR-COM', 'CORR', 'SAMEDAY'])

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
  const { readyToInvoice, invoiceFeePlan, claimRef, hours, notes, patientId } = await req.json()

  const data: Record<string, unknown> = {}

  if (hours !== undefined) {
    const h = parseFloat(hours)
    if (!isNaN(h) && h > 0) data.hours = h
  }

  if (notes !== undefined) {
    data.notes = notes || null
  }

  if (readyToInvoice !== undefined) {
    data.readyToInvoice = readyToInvoice
    if (readyToInvoice && invoiceFeePlan) {
      data.invoiceFeePlan = invoiceFeePlan
      const base = FEE_AMOUNTS[invoiceFeePlan] ?? null
      if (base !== null && PER_CLAIM_PLANS.has(invoiceFeePlan)) {
        const existing = await (prisma.timeEntry as any).findUnique({ where: { id }, select: { hours: true } })
        data.invoiceFeeAmt = base * (existing?.hours ?? 1)
      } else {
        data.invoiceFeeAmt = base
      }
    } else if (!readyToInvoice) {
      data.invoiceFeePlan = null
      data.invoiceFeeAmt = null
    }
  }

  if (claimRef !== undefined) {
    data.claimRef = claimRef || null
  }

  if (patientId !== undefined) {
    data.patientId = patientId || null
  }

  const entry = await prisma.timeEntry.update({ where: { id }, data })
  return NextResponse.json(entry)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  await prisma.timeEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
