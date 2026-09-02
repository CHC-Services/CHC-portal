import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { canViewTreatmentAdministration, canDocumentTreatmentAdministration } from '../../../../../lib/permissions'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

function serializeTreatment(t: any) {
  return {
    id: t.id,
    treatmentName: t.treatmentName,
    instructions: t.instructions,
    frequency: t.frequency,
    active: t.active,
  }
}

// GET — this patient's treatment orders (the TAR's row definitions).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId } = await params

  if (!(await canViewTreatmentAdministration(session, patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const treatments = await (prisma.patientTreatment.findMany as any)({
    where: { patientId, active: true },
    orderBy: { treatmentName: 'asc' },
  })

  return NextResponse.json({ treatments: treatments.map(serializeTreatment) })
}

// POST — order a new treatment for this patient (body: { treatmentName, instructions?, frequency? })
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId } = await params

  if (!(await canDocumentTreatmentAdministration(session, patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { treatmentName, instructions, frequency } = await req.json()
  if (!treatmentName?.trim()) {
    return NextResponse.json({ error: 'Treatment name is required' }, { status: 400 })
  }

  const treatment = await (prisma.patientTreatment.create as any)({
    data: {
      patientId,
      treatmentName: treatmentName.trim(),
      instructions: instructions?.trim() || null,
      frequency: frequency?.trim() || null,
      createdByUserId: session.id,
      createdByRole: session.role,
    },
  })

  return NextResponse.json({ ok: true, treatment: serializeTreatment(treatment) })
}
