import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken, verifyPatientMatchToken } from '../../../../lib/auth'
import { sendGuardianAccessRequestEmail } from '../../../../lib/sendEmail'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'guardian') return null
  return session
}

function nextAccountNumber(count: number) {
  return `PT-${String(count + 1).padStart(3, '0')}`
}

// GET — the guardian's linked patients, for the myPatients list. A link
// that's still pending approval (see POST below) returns only a minimal
// placeholder — no clinical/insurance data — until an existing approved
// guardian on that patient approves the request.
export async function GET(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const links = await (prisma.guardianPatient.findMany as any)({
    where: { userId: session.id },
    include: { patient: true },
  })

  const patients = links.map((l: any) => {
    if (!l.approvedAt) {
      return {
        id: l.patient.id,
        firstName: l.patient.firstName,
        lastName: l.patient.lastName,
        pending: true,
        pendingMessage: 'Access pending approval from an existing caregiver',
      }
    }
    return { ...l.patient, medicationRemindersOptIn: l.medicationRemindersOptIn }
  })
  return NextResponse.json({ patients })
}

// POST — link to an existing patient (matchToken from /api/family/patients/search-signup),
// OR create a new patient + link (demographics-only — dx codes/PA/meds/secondary
// insurance are left for admin/nurse to complete later).
export async function POST(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.matchToken) {
    const match = verifyPatientMatchToken(body.matchToken)
    if (!match || match.requesterId !== session.id) {
      return NextResponse.json({ error: 'Invalid or expired match. Please search again.' }, { status: 400 })
    }
    const patientId = match.patientId

    const existing = await (prisma.guardianPatient.findUnique as any)({
      where: { userId_patientId: { userId: session.id, patientId } },
    })
    if (existing) {
      return NextResponse.json({ ok: true, linked: true, pending: !existing.approvedAt })
    }

    const patient = await (prisma.patient.findUnique as any)({ where: { id: patientId }, select: { firstName: true, lastName: true } })
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    const otherApprovedGuardians = await (prisma.guardianPatient.findMany as any)({
      where: { patientId, approvedAt: { not: null } },
      include: { user: { select: { email: true, name: true } } },
    })

    const isPending = otherApprovedGuardians.length > 0

    await (prisma.guardianPatient.create as any)({
      data: {
        userId: session.id,
        patientId,
        relationship: body.relationship || null,
        approvedAt: isPending ? null : new Date(),
      },
    })

    if (isPending) {
      const requester = await prisma.user.findUnique({ where: { id: session.id }, select: { name: true } })
      const patientName = `${patient.firstName} ${patient.lastName}`
      await Promise.all(otherApprovedGuardians.map((g: any) =>
        sendGuardianAccessRequestEmail({
          to: g.user.email,
          displayName: g.user.name,
          requesterName: requester?.name || 'A new user',
          patientName,
        }).catch(() => false)
      ))
    }

    return NextResponse.json({ ok: true, linked: true, pending: isPending })
  }

  // Create new canonical patient + link (demographics only — no other approved
  // guardian can exist yet on a brand-new patient, so this link is approved immediately)
  const { patient: p } = body
  if (!p) return NextResponse.json({ error: 'Missing patient data' }, { status: 400 })
  if (!p.lastName?.trim() || !p.firstName?.trim() || !p.dob?.trim() || !p.insuranceType || !p.insuranceId?.trim()) {
    return NextResponse.json({ error: 'First name, last name, date of birth, insurance type, and insurance ID are required' }, { status: 400 })
  }

  const count = await (prisma.patient.count as any)()
  const accountNumber = nextAccountNumber(count)

  const patient = await (prisma.patient.create as any)({
    data: {
      id: crypto.randomUUID(),
      accountNumber,
      lastName: p.lastName.trim(),
      firstName: p.firstName.trim(),
      dob: p.dob.trim(),
      gender: p.gender || null,
      insuranceType: p.insuranceType,
      insuranceId: p.insuranceId.trim(),
      address: p.address || null,
      city: p.city || null,
      state: p.state || null,
      zip: p.zip || null,
      phone: p.phone || null,
    },
  })

  await (prisma.guardianPatient.create as any)({
    data: {
      userId: session.id,
      patientId: patient.id,
      relationship: body.relationship || null,
      approvedAt: new Date(),
    },
  })

  return NextResponse.json({ ok: true, patient })
}
