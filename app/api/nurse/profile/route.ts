import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken, signToken } from '../../../../lib/auth'
import bcrypt from 'bcrypt'

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // cast to any so TypeScript doesn't complain about the new `name` field
  const user = (await prisma.user.findUnique({
    where: { id: session.id }
  })) as any

  const profile = await prisma.nurseProfile.findUnique({
    where: { id: session.nurseProfileId },
  })

  return NextResponse.json({ user, profile, onboardingComplete: (profile as any)?.onboardingComplete ?? false })
}

export async function PATCH(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    displayName,
    address,
    city,
    state,
    zip,
    npiNumber,
    medicaidNumber,
    billingInfo,
    receiveNotifications,
    notifyBillingReminder,
    notifyDocExpiring,
    notifyNewDocument,
    notifyNewClaim,
    currentPassword,
    newPassword
  } = body

  const updates: any = {}
  if (displayName !== undefined) updates.displayName = displayName
  if (address !== undefined) updates.address = address
  if (city !== undefined) updates.city = city
  if (state !== undefined) updates.state = state
  if (zip !== undefined) updates.zip = zip
  if (npiNumber !== undefined) updates.npiNumber = npiNumber
  if (medicaidNumber !== undefined) updates.medicaidNumber = medicaidNumber
  if (billingInfo !== undefined) updates.billingInfo = billingInfo
  if (receiveNotifications !== undefined) updates.receiveNotifications = receiveNotifications
  if (notifyBillingReminder !== undefined) updates.notifyBillingReminder = notifyBillingReminder
  if (notifyDocExpiring !== undefined) updates.notifyDocExpiring = notifyDocExpiring
  if (notifyNewDocument !== undefined) updates.notifyNewDocument = notifyNewDocument
  if (notifyNewClaim !== undefined) updates.notifyNewClaim = notifyNewClaim

  // apply profile updates
  let displayNameChanged = false
  if (Object.keys(updates).length > 0) {
    // detect if displayName being changed so we can refresh the JWT
    if (updates.displayName !== undefined && updates.displayName !== session.displayName) {
      displayNameChanged = true
    }
    await prisma.nurseProfile.update({
      where: { id: session.nurseProfileId },
      data: updates
    })
  }

  // password change if requested
  if (currentPassword && newPassword) {
    const user = await prisma.user.findUnique({ where: { id: session.id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Current password incorrect' }, { status: 400 })
    }
    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: session.id }, data: { password: hashed } })
  }

  // if the nurse updated their display name, issue a fresh token
  const res = NextResponse.json({ ok: true })
  if (displayNameChanged) {
    // build fresh payload to avoid copying exp/iat
    const newPayload: any = {
      id: session.id,
      role: session.role,
      name: session.name,
      nurseProfileId: session.nurseProfileId,
      displayName: updates.displayName,
    }
    const newToken = signToken(newPayload)
    // set cookie so banner/layout sees updated name on next render
    res.headers.set('Set-Cookie', `auth_token=${newToken}; Path=/; HttpOnly; SameSite=Lax`)
  }
  return res
}
