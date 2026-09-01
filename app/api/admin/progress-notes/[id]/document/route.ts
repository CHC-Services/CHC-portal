import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { replaceProgressNoteDocument, deleteProgressNoteDocument } from '../../../../../../lib/progressNoteDocument'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Admin escape-hatch mirror of app/api/nurse/progress-notes/[id]/document —
// same replace/delete on a document-based note's attached file, admin-only.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.progressNote.findUnique({ where: { id } })
  if (!existing || !existing.documentStorageKey) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { storageKey, fileName, mimeType, fileSize } = await req.json()
  if (!storageKey || !fileName) return NextResponse.json({ error: 'storageKey and fileName are required' }, { status: 400 })

  const note = await replaceProgressNoteDocument(id, { storageKey, fileName, mimeType: mimeType || null, fileSize: fileSize ?? null })
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ note })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.progressNote.findUnique({ where: { id } })
  if (!existing || !existing.documentStorageKey) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await deleteProgressNoteDocument(id)
  return NextResponse.json({ ok: true })
}
