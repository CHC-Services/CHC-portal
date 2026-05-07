import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { getPresignedPost } from '../../../../lib/s3'
import { sendRoutedFormAlert } from '../../../../lib/sendEmail'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET /api/admin/routed-forms — list all routed forms
export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const forms = await prisma.routedForm.findMany({
    orderBy: { createdAt: 'desc' },
    include: { nurse: { select: { displayName: true, user: { select: { email: true } } } } },
  })
  return NextResponse.json({ forms })
}

// POST /api/admin/routed-forms
// Body: { nurseId, title, category, urgent, notes, routedBy, fileName?, contentType? }
// If fileName+contentType are provided, returns a presign URL + storageKey so client can upload the blank form.
// Client then calls PATCH with storageKey to finalize.
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nurseId, title, category, urgent, notes, routedBy, fileName, contentType } = await req.json()
  if (!nurseId || !title || !routedBy) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  let presignPayload: { url: string; fields: Record<string, string>; storageKey: string } | null = null

  if (fileName) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storageKey = `routed-forms/${nurseId}/${Date.now()}-${safeName}`
    const { url, fields } = await getPresignedPost(storageKey, contentType || 'application/octet-stream')
    presignPayload = { url, fields, storageKey }
  }

  // Create the record — storageKey set later via PATCH if file is attached
  const form = await prisma.routedForm.create({
    data: {
      nurseId,
      title,
      category: category || 'Form',
      urgent: urgent === true,
      routedBy,
      notes: notes || null,
      storageKey: presignPayload?.storageKey ?? null,
      fileName: fileName ?? null,
    },
  })

  // Email the nurse
  const nurse = await prisma.nurseProfile.findUnique({
    where: { id: nurseId },
    include: { user: { select: { email: true } } },
  })
  if (nurse?.user?.email) {
    sendRoutedFormAlert({
      nurseEmail: nurse.user.email,
      nurseName: nurse.displayName,
      formTitle: title,
      urgent: urgent === true,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, form, presign: presignPayload })
}
