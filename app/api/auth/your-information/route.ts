import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { encrypt, decrypt } from '../../../../lib/encrypt'

function safeDecrypt(val: string | null | undefined): string {
  if (!val) return ''
  const parts = val.split(':')
  if (parts.length === 3 && parts[0].length === 24) {
    try { return decrypt(val) } catch { return val }
  }
  return val
}

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET/PATCH — the shared "Your Information" step every new signup (nurse or
// guardian) passes through once, right after account creation. Nurses write
// to NurseProfile (their existing authoritative copy); guardians write to
// the new User demographic fields directly — same asymmetry as
// User.signatureImageKey vs. NurseProfile's own signature.
export async function GET(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.role === 'nurse' || session.role === 'provider') {
    const profile = session.nurseProfileId
      ? await prisma.nurseProfile.findUnique({ where: { id: session.nurseProfileId } })
      : null
    const p = profile as any
    return NextResponse.json({
      role: session.role,
      firstName: p?.firstName || '',
      lastName: p?.lastName || '',
      dob: safeDecrypt(p?.dob),
      phone: p?.phone || '',
      address: p?.address || '',
      city: p?.city || '',
      state: p?.state || '',
      zip: p?.zip || '',
    })
  }

  const user = (await prisma.user.findUnique({ where: { id: session.id } })) as any
  return NextResponse.json({
    role: session.role,
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    dob: user?.dob || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    zip: user?.zip || '',
  })
}

export async function PATCH(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { firstName, lastName, dob, phone, address, city, state, zip } = await req.json()
  if (!firstName?.trim() || !lastName?.trim() || !dob?.trim() || !phone?.trim() || !address?.trim() || !city?.trim() || !state?.trim() || !zip?.trim()) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }

  if (session.role === 'nurse' || session.role === 'provider') {
    if (!session.nurseProfileId) return NextResponse.json({ error: 'No profile on file' }, { status: 400 })
    await prisma.nurseProfile.update({
      where: { id: session.nurseProfileId },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dob: encrypt(dob.trim()),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
      },
    })
    await (prisma.user.update as any)({
      where: { id: session.id },
      data: { onboardingCompletedAt: new Date() },
    })
  } else {
    await (prisma.user.update as any)({
      where: { id: session.id },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dob: dob.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`,
        onboardingCompletedAt: new Date(),
      },
    })
  }

  return NextResponse.json({ ok: true, role: session.role })
}
