import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../lib/auth'
import { getAccountBalance } from '../../../../lib/accountBalance'

function getNurseId(req: Request): string | null {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  if (!token) return null
  const session = verifyToken(token)
  if (!session?.nurseProfileId) return null
  return session.nurseProfileId
}

export async function GET(req: Request) {
  const nurseId = getNurseId(req)
  if (!nurseId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const balance = await getAccountBalance(nurseId)
  return NextResponse.json({ balance })
}
