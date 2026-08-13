import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../../lib/auth'
import { confirmPatientDocument } from '../../../../../../../lib/patientDocuments'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'guardian') return null
  return session
}

async function verifyGuardianLinked(userId: string, patientId: string) {
  const link = await (prisma.guardianPatient.findUnique as any)({
    where: { userId_patientId: { userId, patientId } },
  })
  return !!link
}

// POST — body: { title, storageKey, fileName, fileSize, mimeType, category }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (!await verifyGuardianLinked(session.id, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { title, storageKey, fileName, fileSize, mimeType, category, orderDate, orderEndDate, providerName, specialty, orderNotes } = await req.json()
  if (!title || !storageKey || !fileName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const document = await confirmPatientDocument({
    patientId: id, storageKey, fileName, title, category, fileSize, mimeType,
    uploadedByUserId: session.id, uploadedByRole: 'guardian',
    orderDate, orderEndDate, providerName, specialty, orderNotes,
  })

  return NextResponse.json({ ok: true, document })
}
