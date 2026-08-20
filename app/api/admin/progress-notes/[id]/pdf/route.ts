import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { getOrCreateProgressNotePdf } from '../../../../../../lib/progressNotePdf'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Presigned download URL for a signed note's PDF packet (generates it if missing).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const note = await prisma.progressNote.findUnique({ where: { id }, select: { signedAt: true } })
  if (!note || !note.signedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const { url } = await getOrCreateProgressNotePdf(id)
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
