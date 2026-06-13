import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// GET — list login log entries with optional search + filters
export async function GET(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim().toLowerCase() || ''
  const filterType = searchParams.get('accountType') || ''
  const filterResult = searchParams.get('result') || ''
  const dateFrom = searchParams.get('dateFrom') || ''
  const dateTo = searchParams.get('dateTo') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = 100

  const where: Record<string, any> = {}

  if (filterType) where.accountType = filterType
  if (filterResult) where.result = { contains: filterResult, mode: 'insensitive' }
  if (dateFrom || dateTo) {
    where.timestamp = {}
    if (dateFrom) where.timestamp.gte = new Date(dateFrom)
    if (dateTo) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      where.timestamp.lte = end
    }
  }

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { accountNumber: { contains: search, mode: 'insensitive' } },
      { ip: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [total, rows] = await Promise.all([
    (prisma.loginLog.count as any)({ where }),
    (prisma.loginLog.findMany as any)({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return NextResponse.json({ rows, total, page, limit })
}

// DELETE — single entry (body: { id }) or all (body: { all: true })
export async function DELETE(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.all === true) {
    const { count } = await (prisma.loginLog.deleteMany as any)({})
    return NextResponse.json({ ok: true, deleted: count })
  }

  if (body.id) {
    await (prisma.loginLog.delete as any)({ where: { id: body.id } })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Provide id or all:true' }, { status: 400 })
}
