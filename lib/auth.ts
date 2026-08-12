import jwt from "jsonwebtoken";
export { formalName } from "./formatName";

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET not defined in environment variables");
}

type TokenPayload = {
  id: string;
  role: string;
  nurseProfileId?: string;
  name: string;            // internal/admin name
  displayName?: string;   // nurse-chosen name
  firstName?: string;
  lastName?: string;
  isDemo?: boolean;
  portalAgreementSigned?: boolean;
  lastActivityAt?: number; // epoch ms — refreshed on every request, checked against INACTIVITY_MS
};

// PHI session policy: cookie is session-only (no maxAge, dies on full browser close)
// and the token itself carries a rolling inactivity clock enforced by middleware.ts.
export const INACTIVITY_MS = 30 * 60 * 1000;

export function signToken(payload: TokenPayload) {
  // JWT.sign complains if payload already contains exp/iat, so strip them
  const { exp, iat, ...clean } = payload as any;
  return jwt.sign({ ...clean, lastActivityAt: Date.now() }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
    }
   catch {
    return null;
  }
}

export type MfaMethod = 'sms' | 'email' | 'totp'

export function signPendingToken(userId: string, mfaMethod?: MfaMethod) {
  return jwt.sign({ id: userId, type: 'pending_2fa', mfaMethod }, JWT_SECRET, { expiresIn: '5m' })
}

export function verifyPendingToken(token: string): { id: string; mfaMethod?: MfaMethod } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any
    if (payload.type !== 'pending_2fa') return null
    return { id: payload.id, mfaMethod: payload.mfaMethod }
  } catch {
    return null
  }
}