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
  orderDate, orderEndDate, providerName, specialty, orderNotes,
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
  orderDate?: string | null
  orderEndDate?: string | null
  providerName?: string | null
  specialty?: string | null
  orderNotes?: string | null
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
      orderDate: orderDate || null,
      orderEndDate: orderEndDate || null,
      providerName: providerName || null,
      specialty: specialty || null,
      orderNotes: orderNotes || null,
    },
  })
}

export async function listPatientDocuments(patientId: string) {
  const docs = await (prisma.patientDocument.findMany as any)({
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
      orderDate: true,
      orderEndDate: true,
      providerName: true,
      specialty: true,
      orderNotes: true,
      // storageKey intentionally excluded — never sent to client
    },
  })

  // "Recorded by" note: only for docs uploaded by a nurse who is still an
  // active member of this patient's care team — not just anyone who once uploaded one.
  const nurseUploaderUserIds = [...new Set(
    docs.filter((d: any) => d.uploadedByRole === 'nurse').map((d: any) => d.uploadedByUserId)
  )]
  if (nurseUploaderUserIds.length) {
    const nurseProfiles = await (prisma.nurseProfile.findMany as any)({
      where: { userId: { in: nurseUploaderUserIds } },
      select: { id: true, userId: true, firstName: true, lastName: true, displayName: true, credentials: true },
    })
    const activeLinks = await (prisma.nursePatient.findMany as any)({
      where: { patientId, nurseId: { in: nurseProfiles.map((p: any) => p.id) }, isActive: true },
      select: { nurseId: true },
    })
    const activeNurseIds = new Set(activeLinks.map((l: any) => l.nurseId))
    const profileByUserId = new Map(nurseProfiles.map((p: any) => [p.userId, p]))

    for (const doc of docs) {
      if (doc.uploadedByRole !== 'nurse') continue
      const np = profileByUserId.get(doc.uploadedByUserId) as any
      if (!np || !activeNurseIds.has(np.id)) continue
      const name = np.firstName && np.lastName ? `${np.firstName} ${np.lastName[0]}.` : np.displayName
      doc.recordedBy = name + (np.credentials ? `, ${np.credentials}` : '')
    }
  }

  return docs
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
