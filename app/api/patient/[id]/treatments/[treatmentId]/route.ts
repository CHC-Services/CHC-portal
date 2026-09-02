import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canDocumentTreatmentAdministration } from '../../../../../../lib/permissions'

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

async function loadTreatment(patientId: string, treatmentId: string) {
  const treatment = await (prisma.patientTreatment.findUnique as any)({ where: { id: treatmentId } })
  if (!treatment || treatment.patientId !== patientId) return null
  return treatment
}

// PATCH — edit a treatment order, or deactivate it (active: false) so it
// drops off the TAR grid without deleting its administration history.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; treatmentId: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId, treatmentId } = await params

  if (!(await canDocumentTreatmentAdministration(session, patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const existing = await loadTreatment(patientId, treatmentId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { treatmentName, instructions, frequency, active } = await req.json()
  const data: Record<string, any> = {}
  if (treatmentName !== undefined) {
    if (!treatmentName?.trim()) return NextResponse.json({ error: 'Treatment name is required' }, { status: 400 })
    data.treatmentName = treatmentName.trim()
  }
  if (instructions !== undefined) data.instructions = instructions?.trim() || null
  if (frequency !== undefined) data.frequency = frequency?.trim() || null
  if (active !== undefined) data.active = !!active

  const treatment = await (prisma.patientTreatment.update as any)({ where: { id: treatmentId }, data })
  return NextResponse.json({ ok: true, treatment: serializeTreatment(treatment) })
}
