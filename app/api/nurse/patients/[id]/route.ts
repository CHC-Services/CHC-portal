import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { flattenMedication } from '../../../../../lib/pharmacyLookup'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'nurse') return null
  return session
}

// GET — single linked patient (canonical merged with this nurse's overrides)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const link = await (prisma.nursePatient.findUnique as any)({
    where: { nurseId_patientId: { nurseId: session.nurseProfileId!, patientId: id } },
    include: {
      patient: {
        include: {
          priorAuths: { orderBy: [{ paStartDate: 'desc' }, { createdAt: 'desc' }] },
          medications: { orderBy: { createdAt: 'desc' }, include: { pharmacy: true } },
          nurseLinks: {
            include: {
              nurse: { select: { id: true, displayName: true, firstName: true, lastName: true, accountNumber: true } },
            },
          },
          guardianLinks: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  })
  if (!link || !link.isActive) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { priorAuths, medications, nurseLinks, guardianLinks, ...patientFields } = link.patient

  return NextResponse.json({
    patient: {
      linkId: link.id,
      patientId: link.patientId,
      overrides: link.overrides,
      merged: { ...patientFields, ...(link.overrides || {}) },
      priorAuths: priorAuths || [],
      medications: (medications || []).map(flattenMedication),
      nurseLinks: nurseLinks || [],
      guardianLinks: guardianLinks || [],
    },
  })
}

// PATCH — update nurse-level overrides for a patient
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const link = await (prisma.nursePatient.findUnique as any)({
    where: { nurseId_patientId: { nurseId: session.nurseProfileId!, patientId: id } },
    include: { patient: { select: { isLocked: true } } },
  })
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (link.patient?.isLocked) return NextResponse.json({ error: 'Record locked by admin' }, { status: 403 })

  const updates = await req.json()
  const existing = (link.overrides as Record<string, any>) || {}
  const merged = { ...existing, ...updates }

  await (prisma.nursePatient.update as any)({
    where: { id: link.id },
    data: { overrides: merged, updatedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}

// DELETE — unlink (soft delete) this nurse from a patient
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const link = await (prisma.nursePatient.findUnique as any)({
    where: { nurseId_patientId: { nurseId: session.nurseProfileId!, patientId: id } },
  })
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await (prisma.nursePatient.update as any)({
    where: { id: link.id },
    data: { isActive: false, updatedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
