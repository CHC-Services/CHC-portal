import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../../lib/auth'
import { getPatientDocumentDownloadUrl, deletePatientDocument } from '../../../../../../../lib/patientDocuments'

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

// GET — returns a 15-minute presigned download URL
export async function GET(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, docId } = await params

  if (!await verifyGuardianLinked(session.id, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = await getPatientDocumentDownloadUrl(docId, id)
  if (!url) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ url })
}

// DELETE — guardians may only delete documents they uploaded themselves
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, docId } = await params

  if (!await verifyGuardianLinked(session.id, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const doc = await (prisma.patientDocument.findUnique as any)({ where: { id: docId } })
  if (!doc || doc.patientId !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (doc.uploadedByUserId !== session.id) {
    return NextResponse.json({ error: 'You can only delete documents you uploaded' }, { status: 403 })
  }

  const result = await deletePatientDocument(docId, id)
  if (!result.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
