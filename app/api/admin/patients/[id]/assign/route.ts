import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// POST { nurseId } — link a nurse to this patient
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nurseId } = await req.json()
  if (!nurseId) return NextResponse.json({ error: 'nurseId required' }, { status: 400 })

  const existing = await (prisma.nursePatient.findUnique as any)({
    where: { nurseId_patientId: { nurseId, patientId: params.id } },
  })

  if (existing) {
    if (!existing.isActive) {
      await (prisma.nursePatient.update as any)({
        where: { id: existing.id },
        data: { isActive: true, updatedAt: new Date() },
      })
    }
    return NextResponse.json({ ok: true, linked: true })
  }

  await (prisma.nursePatient.create as any)({
    data: {
      id: crypto.randomUUID(),
      nurseId,
      patientId: params.id,
    },
  })

  return NextResponse.json({ ok: true, linked: true })
}

// DELETE { nurseId } — soft-unlink
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nurseId } = await req.json()
  if (!nurseId) return NextResponse.json({ error: 'nurseId required' }, { status: 400 })

  const link = await (prisma.nursePatient.findUnique as any)({
    where: { nurseId_patientId: { nurseId, patientId: params.id } },
  })

  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await (prisma.nursePatient.update as any)({
    where: { id: link.id },
    data: { isActive: false, updatedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
