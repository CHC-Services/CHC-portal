import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../../../lib/auth'
import { confirmPatientDocument } from '../../../../../../../lib/patientDocuments'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// POST — body: { title, storageKey, fileName, fileSize, mimeType, category }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { title, storageKey, fileName, fileSize, mimeType, category, orderDate, orderEndDate, providerName, specialty, orderNotes } = await req.json()
  if (!title || !storageKey || !fileName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const document = await confirmPatientDocument({
    patientId: id, storageKey, fileName, title, category, fileSize, mimeType,
    uploadedByUserId: session.id, uploadedByRole: 'admin',
    orderDate, orderEndDate, providerName, specialty, orderNotes,
  })

  return NextResponse.json({ ok: true, document })
}
