import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  const { pathname } = req.nextUrl;

  // debugging
  console.log('middleware hit', pathname, 'token', token);

  // Protect admin and nurse routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/nurse")) {

    if (!token) {
      console.log('no token, redirect to login');
      return NextResponse.redirect(new URL("/login", req.url));
    }

    let decoded = null
    try {
      decoded = verifyToken(token);
    } catch (err) {
      console.log('verifyToken threw', err);
    }
    console.log('decoded token', decoded);

    if (!decoded) {
      console.log('token invalid');
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (pathname.startsWith("/admin") && decoded.role !== "admin") {
      console.log('role mismatch, not admin');
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (pathname.startsWith("/nurse") && decoded.role !== "nurse") {
      console.log('role mismatch, not nurse');
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Valid session — reset the 24-hour inactivity clock on every page visit
    const res = NextResponse.next()
    res.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
    return res
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/nurse/:path*"],
  runtime: 'nodejs',
};
