import { prisma } from './prisma'
import { getPresignedPost, getPresignedDownloadUrl, deleteFromS3 } from './s3'

// Shared logic for the PatientDocument feature — any of the three role-scoped
// route trees (nurse/admin/family) call into this after doing their own auth
// check, so the S3/Prisma work isn't tripled three ways.

export async function presignPatientDocument({
  patientId, fileName, contentType, category,
}: {
  patientId: string
  fileName: string
  contentType: string
  category: string
}) {
  const safeCategory = (category || 'general').toLowerCase().replace(/[^a-z0-9]/g, '-')
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storageKey = `patient-documents/${patientId}/${safeCategory}/${Date.now()}-${safeName}`

  const { url, fields } = await getPresignedPost(storageKey, contentType || 'application/octet-stream')
  return { url, fields, storageKey }
}

export async function confirmPatientDocument({
  patientId, storageKey, fileName, title, category, fileSize, mimeType, uploadedByUserId, uploadedByRole,
}: {
  patientId: string
  storageKey: string
  fileName: string
  title: string
  category?: string
  fileSize?: number | null
  mimeType?: string | null
  uploadedByUserId: string
  uploadedByRole: 'nurse' | 'admin' | 'guardian'
}) {
  return (prisma.patientDocument.create as any)({
    data: {
      patientId,
      title,
      fileName,
      storageKey,
      category: category || 'General',
      fileSize: fileSize ?? null,
      mimeType: mimeType ?? null,
      uploadedByUserId,
      uploadedByRole,
    },
  })
}

export async function listPatientDocuments(patientId: string) {
  return (prisma.patientDocument.findMany as any)({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      fileName: true,
      category: true,
      fileSize: true,
      mimeType: true,
      expiresAt: true,
      createdAt: true,
      uploadedByUserId: true,
      uploadedByRole: true,
      // storageKey intentionally excluded — never sent to client
    },
  })
}

export async function getPatientDocumentDownloadUrl(docId: string, patientId: string) {
  const doc = await (prisma.patientDocument.findUnique as any)({ where: { id: docId } })
  if (!doc || doc.patientId !== patientId) return null

  return getPresignedDownloadUrl(doc.storageKey, 900, {
    contentType: doc.mimeType || undefined,
    fileName: doc.fileName,
    inline: true,
  })
}

export async function deletePatientDocument(docId: string, patientId: string) {
  const doc = await (prisma.patientDocument.findUnique as any)({ where: { id: docId } })
  if (!doc || doc.patientId !== patientId) return { ok: false, status: 404 as const }

  await deleteFromS3(doc.storageKey)
  await (prisma.patientDocument.delete as any)({ where: { id: docId } })
  return { ok: true as const, doc }
}
