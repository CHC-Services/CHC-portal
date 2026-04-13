import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function nurseSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const s = token ? verifyToken(token) : null
  return s && s.nurseProfileId ? s : null
}

// GET — directory entries for cases the current nurse is on
export async function GET(req: Request) {
  const session = nurseSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const nurseId = session.nurseProfileId!

  // Fetch cases the current nurse is assigned to, with all co-nurse assignments
  const cases = await prisma.homeCase.findMany({
    where: {
      active: true,
      assignments: { some: { nurseId } },
    },
    orderBy: { patientFirstName: 'asc' },
    include: {
      assignments: {
        include: {
          nurse: {
            select: {
              id: true,
              firstName: true,
              phone: true,
              dirOptIn: true,
              dirShowEmail: true,
              dirShowPhone: true,
              user: { select: { email: true } },
            },
          },
        },
      },
    },
  })

  // Current nurse's own settings
  const me = await prisma.nurseProfile.findUnique({
    where: { id: nurseId },
    select: { dirOptIn: true, dirShowEmail: true, dirShowPhone: true, firstName: true },
  })

  // Shape response: only expose fields each nurse has allowed
  const directory = cases.map(c => ({
    caseId: c.id,
    patientFirstName: c.patientFirstName,
    nurses: c.assignments
      .filter(a => a.nurseId !== nurseId && a.nurse.dirOptIn)
      .map(a => ({
        id: a.nurse.id,
        firstName: a.nurse.firstName || '—',
        email: a.nurse.dirShowEmail ? a.nurse.user?.email ?? null : null,
        phone: a.nurse.dirShowPhone ? a.nurse.phone ?? null : null,
      })),
  }))

  return NextResponse.json({ directory, mySettings: me })
}

// PATCH — update own directory privacy settings
export async function PATCH(req: Request) {
  const session = nurseSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const data: Record<string, boolean> = {}
  if (typeof body.dirOptIn     === 'boolean') data.dirOptIn     = body.dirOptIn
  if (typeof body.dirShowEmail === 'boolean') data.dirShowEmail = body.dirShowEmail
  if (typeof body.dirShowPhone === 'boolean') data.dirShowPhone = body.dirShowPhone

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  await prisma.nurseProfile.update({ where: { id: session.nurseProfileId! }, data })
  return NextResponse.json({ ok: true })
}
