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
};


export function signToken(payload: TokenPayload) {
  // JWT.sign complains if payload already contains exp/iat, so strip them
  const { exp, iat, ...clean } = payload as any;
  return jwt.sign(clean, JWT_SECRET, {
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

export function signPendingToken(userId: string) {
  return jwt.sign({ id: userId, type: 'pending_2fa' }, JWT_SECRET, { expiresIn: '5m' })
}

export function verifyPendingToken(token: string): { id: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any
    if (payload.type !== 'pending_2fa') return null
    return { id: payload.id }
  } catch {
    return null
  }
}