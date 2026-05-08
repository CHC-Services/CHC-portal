import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { deleteFromS3 } from '../../../../../lib/s3'
import { sendRoutedFormAlert } from '../../../../../lib/sendEmail'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// DELETE /api/admin/routed-forms/[id] — cancel and remove a pending routed form
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await (prisma.routedForm as any).findUnique({ where: { id } })
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (form.storageKey) { try { await deleteFromS3(form.storageKey) } catch {} }
  if (form.signedKey)  { try { await deleteFromS3(form.signedKey)  } catch {} }

  await (prisma.routedForm as any).delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// PATCH /api/admin/routed-forms/[id] — resend the email notification to the nurse
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await (prisma.routedForm as any).findUnique({
    where: { id },
    include: { nurse: { include: { user: { select: { email: true } } } } },
  })
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (form.nurse?.user?.email) {
    await sendRoutedFormAlert({
      nurseEmail: form.nurse.user.email,
      nurseName: form.nurse.displayName,
      formTitle: form.title,
      urgent: form.urgent,
    })
  }

  return NextResponse.json({ ok: true })
}
