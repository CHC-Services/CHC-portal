import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { sendNewDocumentAlert } from '../../../../../lib/sendEmail'
import { objectExists } from '../../../../../lib/s3'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST /api/admin/documents/confirm
// Called after the browser has PUT the file directly to S3 via a presigned URL.
// Body: { nurseId, title, storageKey, fileName, fileSize, mimeType, category, expiresAt?, reminderDays? }
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const {
    nurseId,
    nurseIds,
    title,
    storageKey,
    fileName,
    fileSize,
    mimeType,
    category,
    expiresAt,
    reminderDays,
    visibleToNurse,
    claimId,
  } = await req.json()

  // Support single nurseId or array of nurseIds
  const targets: string[] = Array.isArray(nurseIds) && nurseIds.length > 0
    ? nurseIds
    : nurseId ? [nurseId] : []

  if (!targets.length || !title || !storageKey || !fileName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify the upload actually landed in S3 before creating any DB records
  const uploaded = await objectExists(storageKey)
  if (!uploaded) {
    return NextResponse.json(
      { error: 'File not found in storage — the upload may have failed. Please try again.' },
      { status: 422 }
    )
  }

  const sanitizedReminderDays = Array.isArray(reminderDays)
    ? reminderDays.map(Number).filter((n: number) => !isNaN(n))
    : []

  const docs = await Promise.all(targets.map(nid =>
    prisma.nurseDocument.create({
      data: {
        nurseId: nid,
        title,
        fileName,
        storageKey,
        category: category || 'General',
        fileSize: fileSize ?? null,
        mimeType: mimeType ?? null,
        uploadedBy: session.id,
        visibleToNurse: visibleToNurse === true,
        claimId: claimId ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        reminderDays: sanitizedReminderDays,
      },
    })
  ))

  // Check global bulk import mode
  const bulkSetting = await prisma.systemSetting.findUnique({ where: { key: 'bulkImportMode' } })
  const bulkMode = bulkSetting?.value === 'true'

  // Send (or queue) notification for each affected nurse
  const profiles = await prisma.nurseProfile.findMany({
    where: { id: { in: targets } },
    include: { user: { select: { email: true } } },
  })
  for (const nurseProfile of profiles) {
    if (!nurseProfile.notifyNewDocument) continue
    if (bulkMode) {
      await prisma.pendingNotification.create({
        data: {
          nurseId: nurseProfile.id,
          type: 'document',
          payload: { documentTitle: title, category: category || 'General' },
        },
      })
    } else if (nurseProfile.user?.email) {
      sendNewDocumentAlert({
        nurseEmail: nurseProfile.user.email,
        nurseName: nurseProfile.displayName,
        documentTitle: title,
        category: category || 'General',
        uploadedAt: docs[0].createdAt,
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true, count: docs.length })
}
