import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const nurseId = searchParams.get('nurseId')
  if (!nurseId) return NextResponse.json({ error: 'nurseId required' }, { status: 400 })

  const entries = await prisma.timeEntry.findMany({
    where: { nurseId },
    orderBy: { workDate: 'asc' },
    include: { invoice: { select: { invoiceNumber: true, status: true } } },
  })
  return NextResponse.json(entries)
}

export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { nurseId, workDate, hours, notes } = await req.json()

  if (!nurseId || !workDate || !hours) {
    return NextResponse.json({ error: 'nurseId, workDate, and hours are required' }, { status: 400 })
  }

  try {
    const entry = await prisma.timeEntry.create({
      data: {
        nurseId,
        workDate: new Date(workDate),
        hours: parseInt(hours, 10),
        notes: notes || null,
      }
    })
    return NextResponse.json(entry)
  } catch (err: any) {
    // Unique constraint = duplicate date for this nurse
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'An entry already exists for this nurse on that date.' }, { status: 409 })
    }
    return NextResponse.json({ error: err.message || 'Failed to create entry' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const entry = await prisma.timeEntry.findUnique({ where: { id }, select: { billed: true } })
  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  if (entry.billed) return NextResponse.json({ error: 'Cannot delete a billed entry.' }, { status: 403 })

  await prisma.timeEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
