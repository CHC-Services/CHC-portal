import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

// /nurse sub-paths that provider-role users may access
const PROVIDER_ALLOWED_NURSE_PATHS = ['/nurse/profile', '/nurse/onboarding']

const DEMO_WRITE_BLOCK_PATHS = ['/api/nurse/', '/api/time-entry']
const WRITE_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE']

export function middleware(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  const { pathname } = req.nextUrl;

  console.log('middleware hit', pathname, 'token', token);

  // Block all writes from demo accounts
  if (WRITE_METHODS.includes(req.method) && DEMO_WRITE_BLOCK_PATHS.some(p => pathname.startsWith(p))) {
    if (token) {
      let decoded = null
      try { decoded = verifyToken(token) } catch {}
      if ((decoded as any)?.isDemo) {
        return NextResponse.json({ error: 'Demo accounts are read-only.' }, { status: 403 })
      }
    }
  }

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/nurse") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/resources") ||
    pathname.startsWith("/care")
  ) {

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

    if (pathname.startsWith("/nurse")) {
      const isNurse = decoded.role === "nurse"
      const isProviderAllowed = decoded.role === "provider" && PROVIDER_ALLOWED_NURSE_PATHS.some(p => pathname.startsWith(p))

      if (!isNurse && !isProviderAllowed) {
        console.log('nurse path blocked for role', decoded.role);
        return NextResponse.redirect(new URL(decoded.role === "provider" ? "/portal" : "/", req.url));
      }
    }

    // /portal, /resources, /care — any authenticated role is fine
    if (
      (pathname.startsWith("/portal") ||
       pathname.startsWith("/resources") ||
       pathname.startsWith("/care")) &&
      !["nurse", "admin", "provider", "biller", "guardian"].includes(decoded.role)
    ) {
      return NextResponse.redirect(new URL("/login", req.url));
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
  matcher: ["/admin/:path*", "/nurse/:path*", "/portal/:path*", "/resources/:path*", "/resources", "/care/:path*", "/care", "/api/nurse/:path*", "/api/time-entry/:path*"],
  runtime: 'nodejs',
};
