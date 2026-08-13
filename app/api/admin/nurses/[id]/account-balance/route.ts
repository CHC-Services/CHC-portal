import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../../lib/auth'
import { getAccountBalance } from '../../../../../../lib/accountBalance'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: nurseId } = await params
  const balance = await getAccountBalance(nurseId)
  return NextResponse.json({ balance })
}
