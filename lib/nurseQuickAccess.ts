import crypto from 'crypto'
import { prisma } from './prisma'

// Token generation/verification for the /quick-notes home-screen shortcut —
// a separate, narrowly-scoped credential (see NurseQuickAccessToken in
// schema.prisma), not part of the normal cookie/JWT session system.

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Generates a new 256-bit random token. The plaintext is returned exactly
 * once by the issuing route and never stored — only its hash is. */
export function generateQuickAccessToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function hashQuickAccessToken(token: string): string {
  return hashToken(token)
}

export type QuickAccessIdentity = { nurseId: string; userId: string; tokenId: string }

/** Verifies a presented token against the stored hash. Rejects missing/unknown/revoked tokens. */
export async function verifyQuickAccessToken(token: string | null): Promise<QuickAccessIdentity | null> {
  if (!token) return null

  const record = await prisma.nurseQuickAccessToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, nurseId: true, revokedAt: true, nurse: { select: { userId: true } } },
  })
  if (!record || record.revokedAt) return null

  prisma.nurseQuickAccessToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {})

  return { nurseId: record.nurseId, userId: record.nurse.userId, tokenId: record.id }
}

/** Reads the X-Quick-Access-Token header and verifies it — the one-liner every /api/quick-notes/* route starts with. */
export async function getQuickAccessIdentity(req: Request): Promise<QuickAccessIdentity | null> {
  return verifyQuickAccessToken(req.headers.get('x-quick-access-token'))
}
