import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../../../lib/auth'
import { presignProgressNoteDocument } from '../../../../../../../lib/progressNoteDocument'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Admin-only — used only for Replace on an existing document-based note
// (app/api/admin/progress-notes/[id]/document's PATCH); admin never
// originates a document-based note (upload/create stays nurse-only).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId } = await params

  const { fileName, contentType } = await req.json()
  if (!fileName) return NextResponse.json({ error: 'fileName is required' }, { status: 400 })

  const result = await presignProgressNoteDocument({ patientId, fileName, contentType: contentType || 'application/octet-stream' })
  return NextResponse.json(result)
}
