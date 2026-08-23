import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
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

  // Queue a notification for each affected nurse — always batched now (see
  // lib/flushNurseNotifications.ts), never sent immediately.
  const profiles = await prisma.nurseProfile.findMany({
    where: { id: { in: targets } },
  })
  for (const nurseProfile of profiles) {
    if (!nurseProfile.notifyNewDocument) continue
    await prisma.pendingNotification.create({
      data: {
        nurseId: nurseProfile.id,
        type: 'document',
        payload: { documentTitle: title, category: category || 'General', claimId: claimId ?? null },
      },
    })
  }

  return NextResponse.json({ ok: true, count: docs.length })
}
