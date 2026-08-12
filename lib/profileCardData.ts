import { prisma } from './prisma'
import { encrypt, decrypt } from './encrypt'

// Shared logic for the Demographics/Billing Info/Banking cards — every
// role-scoped profile route (nurse self-service, admin self-service, family
// self-service, admin-viewing-any-account) calls into this instead of
// tripling the encrypt/decrypt + field-mapping logic.

function safeDecrypt(val: string | null | undefined): string {
  if (!val) return ''
  const parts = val.split(':')
  if (parts.length === 3 && parts[0].length === 24) {
    try { return decrypt(val) } catch { return val }
  }
  return val
}

// All profile-card data lives on NurseProfile regardless of the owning
// account's role (see ProfileCardConfig's schema comment) — find-or-create
// by userId so admin/biller/guardian accounts, which never got a NurseProfile
// row at creation time, get one lazily on first profile page visit.
export async function getOrCreateProfileByUserId(userId: string, defaultDisplayName: string) {
  return (prisma.nurseProfile.upsert as any)({
    where: { userId },
    update: {},
    create: { userId, displayName: defaultDisplayName },
  })
}

export function decryptProfileCardData(p: any) {
  return {
    displayName: p.displayName,
    firstName: p.firstName,
    middleInitial: p.middleInitial,
    lastName: p.lastName,
    phone: p.phone,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    dob: safeDecrypt(p.dob),
    ssn: p.ssnEncrypted ? safeDecrypt(p.ssnEncrypted) : '',
    npiNumber: safeDecrypt(p.npiNumber),
    medicaidNumber: safeDecrypt(p.medicaidNumber),
    bankName: p.bankName,
    bankRoutingOnFile: !!p.bankRoutingEncrypted,
    bankAccountOnFile: !!p.bankAccountEncrypted,
  }
}

const DEMOGRAPHICS_FIELDS = ['displayName', 'firstName', 'middleInitial', 'lastName', 'phone', 'address', 'city', 'state', 'zip'] as const

// Builds a Prisma `data` object from a PATCH body, encrypting the fields that
// are stored encrypted. Only includes keys actually present in `body` so a
// partial PATCH never clobbers fields the caller didn't send.
export function buildProfileUpdates(body: any): Record<string, any> {
  const updates: Record<string, any> = {}
  for (const f of DEMOGRAPHICS_FIELDS) {
    if (body[f] !== undefined) updates[f] = body[f]
  }
  if (body.dob !== undefined) updates.dob = body.dob ? encrypt(body.dob) : null
  if (body.ssn !== undefined) updates.ssnEncrypted = body.ssn ? encrypt(body.ssn) : null
  if (body.npiNumber !== undefined) updates.npiNumber = body.npiNumber ? encrypt(body.npiNumber) : null
  if (body.medicaidNumber !== undefined) updates.medicaidNumber = body.medicaidNumber ? encrypt(body.medicaidNumber) : null
  return updates
}
