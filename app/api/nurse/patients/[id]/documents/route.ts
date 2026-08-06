import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { listPatientDocuments } from '../../../../../../lib/patientDocuments'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'nurse') return null
  return session
}

async function verifyLinked(nurseId: string, patientId: string) {
  const link = await (prisma.nursePatient.findUnique as any)({
    where: { nurseId_patientId: { nurseId, patientId } },
    select: { isActive: true },
  })
  return link?.isActive === true
}

// GET — list documents for a patient this nurse is linked to
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (!await verifyLinked(session.nurseProfileId!, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const documents = await listPatientDocuments(id)
  return NextResponse.json({ documents })
}
