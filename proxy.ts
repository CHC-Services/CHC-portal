import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

export function proxy(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  const { pathname } = req.nextUrl;

  // Protect admin and nurse routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/nurse")) {

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (pathname.startsWith("/admin") && decoded.role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (pathname.startsWith("/nurse") && decoded.role !== "nurse") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}