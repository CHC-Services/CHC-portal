import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { deleteUserAccount } from '../../../../../lib/deleteAccount'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// DELETE — permanently delete an account (any role). `id` may be either a
// User.id (as used by /admin/accounts/[id]) or a NurseProfile.id (as used by
// /admin/nurse/[id]) — resolved here so both pages can call this one route
// with whichever id they already have on hand.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let targetUser = await (prisma.user.findUnique as any)({
    where: { id },
    select: { id: true, role: true },
  })

  if (!targetUser) {
    const profile = await (prisma.nurseProfile.findUnique as any)({
      where: { id },
      select: { userId: true, user: { select: { id: true, role: true } } },
    })
    targetUser = profile?.user || null
  }

  if (!targetUser) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  if (targetUser.id === session.id) {
    return NextResponse.json({ error: "You can't delete the account you're currently logged in as." }, { status: 400 })
  }

  if (targetUser.role === 'admin') {
    const adminCount = await (prisma.user.count as any)({ where: { role: 'admin' } })
    if (adminCount <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last remaining admin account.' }, { status: 400 })
    }
  }

  await deleteUserAccount(targetUser.id)

  return NextResponse.json({ ok: true })
}
