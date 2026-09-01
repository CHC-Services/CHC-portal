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
          medications: { orderBy: { createdAt: 'desc' }, include: { pharmacy: true, scheduleTimes: { orderBy: { sortOrder: 'asc' } } } },
          nurseLinks: {
            include: {
              nurse: { select: { id: true, userId: true, displayName: true, firstName: true, lastName: true, accountNumber: true } },
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
  if (!link || !link.isActive || !link.patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { priorAuths, medications, nurseLinks, guardianLinks, ...patientFields } = link.patient

  return NextResponse.json({
    patient: {
      linkId: link.id,
      patientId: link.patientId,
      overrides: link.overrides,
      medicationRemindersOptIn: link.medicationRemindersOptIn,
      merged: { ...patientFields, ...(link.overrides || {}) },
      priorAuths: priorAuths || [],
      medications: (medications || []).map(flattenMedication),
      nurseLinks: nurseLinks || [],
      guardianLinks: guardianLinks || [],
    },
  })
}

// PATCH — update nurse-level overrides for a patient, or this nurse's own
// medicationRemindersOptIn flag (lives on the NursePatient link, not overrides)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const link = await (prisma.nursePatient.findUnique as any)({
    where: { nurseId_patientId: { nurseId: session.nurseProfileId!, patientId: id } },
    include: { patient: { select: { isLocked: true } } },
  })
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Notification opt-in isn't clinical data, so it's exempt from the isLocked
  // block below — an admin-locked record shouldn't block a nurse from
  // managing their own reminder subscription for that patient.
  if ('medicationRemindersOptIn' in body) {
    await (prisma.nursePatient.update as any)({
      where: { id: link.id },
      data: { medicationRemindersOptIn: !!body.medicationRemindersOptIn },
    })
  }

  const { medicationRemindersOptIn, ...updates } = body
  if (Object.keys(updates).length > 0) {
    if (link.patient?.isLocked) return NextResponse.json({ error: 'Record locked by admin' }, { status: 403 })
    const existing = (link.overrides as Record<string, any>) || {}
    const merged = { ...existing, ...updates }
    await (prisma.nursePatient.update as any)({
      where: { id: link.id },
      data: { overrides: merged, updatedAt: new Date() },
    })
  }

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
