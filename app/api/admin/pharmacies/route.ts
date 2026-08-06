import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// GET — every pharmacy with the patients (and their guardians) who use it, for the directory page
export async function GET(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pharmacies = await (prisma.pharmacy.findMany as any)({
    orderBy: { name: 'asc' },
    include: {
      medications: {
        include: {
          patient: {
            select: {
              id: true,
              accountNumber: true,
              firstName: true,
              lastName: true,
              guardianLinks: { include: { user: { select: { id: true, name: true, email: true } } } },
            },
          },
        },
      },
    },
  })

  const result = pharmacies.map((p: any) => {
    const patientsById = new Map<string, any>()
    for (const med of p.medications) {
      const patient = med.patient
      if (!patientsById.has(patient.id)) {
        patientsById.set(patient.id, {
          id: patient.id,
          accountNumber: patient.accountNumber,
          firstName: patient.firstName,
          lastName: patient.lastName,
          guardians: patient.guardianLinks.map((g: any) => ({ id: g.user.id, name: g.user.name, email: g.user.email })),
        })
      }
    }
    return {
      id: p.id,
      name: p.name,
      address: p.address,
      phone: p.phone,
      patients: [...patientsById.values()],
    }
  })

  return NextResponse.json(result)
}

// POST — manual create (housekeeping: add a pharmacy before any medication references it)
export async function POST(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, address, phone } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const pharmacy = await (prisma.pharmacy.create as any)({
    data: { name: name.trim(), address: address?.trim() || null, phone: phone?.trim() || null },
  })

  return NextResponse.json(pharmacy)
}
