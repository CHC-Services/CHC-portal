import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../../../lib/auth'
import { getPatientDocumentDownloadUrl, deletePatientDocument } from '../../../../../../../lib/patientDocuments'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// GET — returns a 15-minute presigned download URL
export async function GET(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = adminAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, docId } = await params

  const url = await getPatientDocumentDownloadUrl(docId, id)
  if (!url) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ url })
}

// DELETE — admin may delete any patient document
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = adminAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, docId } = await params

  const result = await deletePatientDocument(docId, id)
  if (!result.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
