import jwt from "jsonwebtoken";

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
  isDemo?: boolean;
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