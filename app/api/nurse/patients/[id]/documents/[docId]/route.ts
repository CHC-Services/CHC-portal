import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../../lib/auth'
import { getPatientDocumentDownloadUrl, deletePatientDocument } from '../../../../../../../lib/patientDocuments'

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

// GET — returns a 15-minute presigned download URL
export async function GET(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, docId } = await params

  if (!await verifyLinked(session.nurseProfileId!, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = await getPatientDocumentDownloadUrl(docId, id)
  if (!url) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ url })
}

// DELETE — nurses may delete any document on a patient they're linked to
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, docId } = await params

  if (!await verifyLinked(session.nurseProfileId!, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await deletePatientDocument(docId, id)
  if (!result.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
