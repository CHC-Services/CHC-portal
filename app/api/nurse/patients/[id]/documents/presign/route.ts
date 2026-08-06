import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../../lib/auth'
import { presignPatientDocument } from '../../../../../../../lib/patientDocuments'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'nurse') return null
  return session
}

async function verifyLinked(nurseId: string, patientId: string) {
  const link = await (prisma.nursePatient.findUnique as any)({
    where: { nurseId_patientId: { nurseId, patientId } },
    select: { isActive: true },
  })
  return link?.isActive === true
}

// POST — body: { fileName, contentType, category }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (!await verifyLinked(session.nurseProfileId!, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { fileName, contentType, category } = await req.json()
  if (!fileName) return NextResponse.json({ error: 'Missing fileName' }, { status: 400 })

  try {
    const { url, fields, storageKey } = await presignPatientDocument({
      patientId: id, fileName, contentType, category,
    })
    return NextResponse.json({ url, fields, storageKey })
  } catch (err: any) {
    return NextResponse.json({ error: `Could not generate upload URL: ${err?.message || 'unknown'}` }, { status: 500 })
  }
}
