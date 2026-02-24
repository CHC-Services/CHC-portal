import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

export async function getUserFromCookie() {
  const cookieStore = await cookies();  // ✅ MUST be awaited
  const token = cookieStore.get("auth_token")?.value;

  if (!token) return null;

  const user = verifyToken(token);
  return user;
}