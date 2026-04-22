import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

const DEFAULTS = [
  { code: 'A3',  description: 'Acknowledgement/Returned as unprocessable claim — The claim/encounter has been rejected and has not been entered into the adjudication system.' },
  { code: '400', description: 'Claim is out of balance.' },
  { code: 'F1',  description: 'Finalized/Payment — The claim/line has been paid.' },
  { code: '3',   description: 'Claim has been adjudicated and is awaiting payment cycle.' },
  { code: 'F2',  description: 'Finalized/Denial — The claim/line has been denied.' },
  { code: '483', description: 'Maximum coverage amount met or exceeded for benefit period.' },
]

export async function GET(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const count = await (prisma.medicaidStatusCode.count as any)()
  if (count === 0) {
    await (prisma.medicaidStatusCode.createMany as any)({ data: DEFAULTS, skipDuplicates: true })
  }

  const codes = await (prisma.medicaidStatusCode.findMany as any)({ orderBy: { code: 'asc' } })
  return NextResponse.json(codes)
}

export async function POST(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code, description } = await req.json()
  if (!code?.trim() || !description?.trim()) {
    return NextResponse.json({ error: 'code and description required' }, { status: 400 })
  }

  try {
    const record = await (prisma.medicaidStatusCode.create as any)({
      data: { code: code.trim().toUpperCase(), description: description.trim() },
    })
    return NextResponse.json(record, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Code already exists.' }, { status: 409 })
  }
}
