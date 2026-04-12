import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { uploadToS3, deleteFromS3, getPresignedDownloadUrl } from '../../../../../lib/s3'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST — upload a new Prompt Pay form file (replaces existing)
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowed = ['application/pdf', 'image/png', 'image/jpeg']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF, PNG, or JPEG files are supported' }, { status: 400 })
  }

  // Delete any existing form file
  const existing = await prisma.systemSetting.findUnique({ where: { key: 'promptPay.formS3Key' } })
  if (existing?.value) {
    try { await deleteFromS3(existing.value) } catch {}
  }

  const ext = file.name.split('.').pop() || 'pdf'
  const key = `prompt-pay-forms/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadToS3(key, buffer, file.type)

  // Save S3 key and file name, clear external URL
  await Promise.all([
    prisma.systemSetting.upsert({ where: { key: 'promptPay.formS3Key' }, update: { value: key }, create: { key: 'promptPay.formS3Key', value: key } }),
    prisma.systemSetting.upsert({ where: { key: 'promptPay.formFileName' }, update: { value: file.name }, create: { key: 'promptPay.formFileName', value: file.name } }),
    prisma.systemSetting.upsert({ where: { key: 'promptPay.formUrl' }, update: { value: '' }, create: { key: 'promptPay.formUrl', value: '' } }),
  ])

  // Return a short-lived presigned URL for immediate preview
  const previewUrl = await getPresignedDownloadUrl(key, 900)
  return NextResponse.json({ ok: true, fileName: file.name, previewUrl })
}

// DELETE — remove the uploaded form file
export async function DELETE(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await prisma.systemSetting.findUnique({ where: { key: 'promptPay.formS3Key' } })
  if (existing?.value) {
    try { await deleteFromS3(existing.value) } catch {}
  }

  await Promise.all([
    prisma.systemSetting.deleteMany({ where: { key: { in: ['promptPay.formS3Key', 'promptPay.formFileName'] } } }),
  ])

  return NextResponse.json({ ok: true })
}

// GET — generate a presigned download URL for the current form
export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await prisma.systemSetting.findUnique({ where: { key: 'promptPay.formS3Key' } })
  if (!existing?.value) return NextResponse.json({ error: 'No form uploaded' }, { status: 404 })

  const url = await getPresignedDownloadUrl(existing.value, 900)
  return NextResponse.json({ url })
}
