import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../../../lib/auth'
import { presignPatientDocument } from '../../../../../../../lib/patientDocuments'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// POST — body: { fileName, contentType, category }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

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
