import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: caseId } = await params
  const { nurseId } = await req.json()
  if (!nurseId) return NextResponse.json({ error: 'nurseId required' }, { status: 400 })
  try {
    const assignment = await prisma.caseAssignment.create({ data: { caseId, nurseId } })
    return NextResponse.json({ ok: true, assignment })
  } catch {
    return NextResponse.json({ error: 'Already assigned or invalid IDs' }, { status: 409 })
  }
}
