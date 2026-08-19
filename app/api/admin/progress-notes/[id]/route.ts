import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { getPresignedDownloadUrl } from '../../../../../lib/s3'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const note = await prisma.progressNote.findUnique({
    where: { id },
    include: {
      vitals: { orderBy: { sortOrder: 'asc' } },
      intakeOutput: { orderBy: { sortOrder: 'asc' } },
      authorNurse: { select: { displayName: true } },
    },
  })
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const signatureUrl = note.signatureImageKey
    ? await getPresignedDownloadUrl(note.signatureImageKey, 900, { inline: true, contentType: 'image/png' })
    : null

  return NextResponse.json({ note, signatureUrl })
}
