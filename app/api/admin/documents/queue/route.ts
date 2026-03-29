import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET /api/admin/documents/queue
// Returns all nurse-uploaded docs shared with admin that haven't been reviewed yet
export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const docs = await prisma.nurseDocument.findMany({
    where: { nurseUploaded: true, sharedWithAdmin: true, adminReviewed: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      fileName: true,
      category: true,
      fileSize: true,
      mimeType: true,
      createdAt: true,
      nurseId: true,
      nurse: { select: { displayName: true } },
    },
  })

  return NextResponse.json({ docs })
}

// PATCH /api/admin/documents/queue — mark one or all as reviewed
// Body: { id } to mark one, or { all: true } to clear all
export async function PATCH(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  if (body.all) {
    await prisma.nurseDocument.updateMany({
      where: { nurseUploaded: true, sharedWithAdmin: true, adminReviewed: false },
      data: { adminReviewed: true },
    })
  } else if (body.id) {
    await prisma.nurseDocument.update({
      where: { id: body.id },
      data: { adminReviewed: true },
    })
  }

  return NextResponse.json({ ok: true })
}
