import { prisma } from './prisma'
import { getPresignedPost, getPresignedDownloadUrl, deleteFromS3 } from './s3'

// Shared logic for the progress-note document-upload feature — mirrors
// lib/patientDocuments.ts's presign/confirm split. A "document-based" note
// is signed the instant it's created (no separate sign step, per the
// feature's design), so Replace/Delete exist here as the only way to fix a
// mistake afterward — never a return to draft/edit.

export async function presignProgressNoteDocument({
  patientId, fileName, contentType,
}: {
  patientId: string
  fileName: string
  contentType: string
}) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storageKey = `progress-note-documents/${patientId}/${Date.now()}-${safeName}`

  const { url, fields } = await getPresignedPost(storageKey, contentType || 'application/octet-stream')
  return { url, fields, storageKey }
}

export async function createProgressNoteDocument({
  id, patientId, serviceDate, storageKey, fileName, mimeType, fileSize, shiftNotes, authorUserId, signatureImageKey, authorDisplayNameSnapshot,
}: {
  id: string
  patientId: string
  serviceDate: Date
  storageKey: string
  fileName: string
  mimeType: string | null
  fileSize: number | null
  shiftNotes: string | null
  authorUserId: string
  signatureImageKey: string
  authorDisplayNameSnapshot: string
}) {
  return prisma.progressNote.create({
    data: {
      id,
      patientId,
      authorUserId,
      authorRole: 'nurse',
      authorDisplayNameSnapshot,
      shiftId: null,
      serviceDate,
      shiftNotes: shiftNotes || null,
      signedAt: new Date(),
      signatureImageKey,
      documentStorageKey: storageKey,
      documentFileName: fileName,
      documentMimeType: mimeType,
      documentFileSize: fileSize,
    },
  })
}

export async function replaceProgressNoteDocument(noteId: string, {
  storageKey, fileName, mimeType, fileSize,
}: {
  storageKey: string
  fileName: string
  mimeType: string | null
  fileSize: number | null
}) {
  const existing = await prisma.progressNote.findUnique({ where: { id: noteId } })
  if (!existing?.documentStorageKey) return null

  await deleteFromS3(existing.documentStorageKey).catch(() => {})
  return prisma.progressNote.update({
    where: { id: noteId },
    data: { documentStorageKey: storageKey, documentFileName: fileName, documentMimeType: mimeType, documentFileSize: fileSize },
  })
}

export async function deleteProgressNoteDocument(noteId: string) {
  const existing = await prisma.progressNote.findUnique({ where: { id: noteId } })
  if (!existing?.documentStorageKey) return null

  await deleteFromS3(existing.documentStorageKey).catch(() => {})
  await prisma.progressNote.delete({ where: { id: noteId } })
  return existing
}

export async function getProgressNoteDocumentUrl(storageKey: string, fileName: string, mimeType: string | null) {
  return getPresignedDownloadUrl(storageKey, 900, { contentType: mimeType || undefined, fileName, inline: true })
}
