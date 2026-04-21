import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function getNurseId(req: Request): string | null {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  if (!token) return null
  const session = verifyToken(token)
  if (!session?.nurseProfileId) return null
  return session.nurseProfileId
}

export async function GET(req: Request) {
  const nurseId = getNurseId(req)
  if (!nurseId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const invoices = await prisma.invoice.findMany({
    where: { nurseId },
    select: { status: true, totalAmount: true, paidAmount: true },
  })

  const outstanding = invoices.filter(
    inv => inv.status !== 'Paid' && inv.status !== 'Cancelled' && inv.status !== 'WrittenOff'
  )

  const totalDue = outstanding.reduce((sum, inv) => sum + Math.max(0, inv.totalAmount - (inv.paidAmount ?? 0)), 0)
  const count = outstanding.length

  return NextResponse.json({ totalDue, count })
}
