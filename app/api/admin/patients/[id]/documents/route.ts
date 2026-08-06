import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../../lib/auth'
import { listPatientDocuments } from '../../../../../../lib/patientDocuments'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// GET — list documents for a patient
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const documents = await listPatientDocuments(id)
  return NextResponse.json({ documents })
}
