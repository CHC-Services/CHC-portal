import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canManageProgressNoteDocument } from '../../../../../../lib/permissions'
import { replaceProgressNoteDocument, deleteProgressNoteDocument } from '../../../../../../lib/progressNoteDocument'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Replace or delete a document-based note's attached file — the only
// after-the-fact correction available for a note that was signed
// immediately at upload (see lib/progressNoteDocument.ts). Never touches a
// normal typed/voice note: 404s unless documentStorageKey is already set.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.progressNote.findUnique({ where: { id } })
  if (!existing || !existing.documentStorageKey) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canManageProgressNoteDocument(session, existing))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { storageKey, fileName, mimeType, fileSize } = await req.json()
  if (!storageKey || !fileName) return NextResponse.json({ error: 'storageKey and fileName are required' }, { status: 400 })

  const note = await replaceProgressNoteDocument(id, { storageKey, fileName, mimeType: mimeType || null, fileSize: fileSize ?? null })
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ note })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.progressNote.findUnique({ where: { id } })
  if (!existing || !existing.documentStorageKey) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canManageProgressNoteDocument(session, existing))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await deleteProgressNoteDocument(id)
  return NextResponse.json({ ok: true })
}
