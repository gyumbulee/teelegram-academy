import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifySessionCookieValue } from "@/lib/adminSession";

// Gate on a signed session cookie set by /admin/login's form (see
// lib/adminSession.ts) — a real login page instead of the browser's native
// HTTP Basic Auth popup. /admin/login itself must stay reachable without a
// session, or nobody could ever log in.
export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (await verifySessionCookieValue(cookie)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: "/admin/:path*",
};
