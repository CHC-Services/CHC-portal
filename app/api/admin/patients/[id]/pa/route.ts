import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

async function syncHighTech(patientId: string) {
  const latest = await (prisma.patientPA.findFirst as any)({
    where: { patientId },
    orderBy: [{ paStartDate: 'desc' }, { createdAt: 'desc' }],
    select: { highTech: true },
  })
  await (prisma.patient.update as any)({
    where: { id: patientId },
    data: { highTech: latest?.highTech ?? false, updatedAt: new Date() },
  })
}

// POST — add a new PA record
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { paNumber, paStartDate, paEndDate, highTech } = await req.json()
  if (!paNumber?.trim()) return NextResponse.json({ error: 'PA number required' }, { status: 400 })

  const pa = await (prisma.patientPA.create as any)({
    data: {
      id: crypto.randomUUID(),
      patientId: id,
      paNumber: paNumber.trim(),
      paStartDate: paStartDate || null,
      paEndDate: paEndDate || null,
      highTech: highTech ?? false,
    },
  })

  await syncHighTech(id)
  return NextResponse.json({ ok: true, pa })
}

// DELETE — remove a PA record (body: { paId })
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { paId } = await req.json()
  if (!paId) return NextResponse.json({ error: 'paId required' }, { status: 400 })

  await (prisma.patientPA.delete as any)({ where: { id: paId } })
  await syncHighTech(id)
  return NextResponse.json({ ok: true })
}
