import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; nurseId: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: caseId, nurseId } = await params
  await prisma.caseAssignment.deleteMany({ where: { caseId, nurseId } })
  return NextResponse.json({ ok: true })
}
