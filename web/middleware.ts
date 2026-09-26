import { NextRequest, NextResponse } from "next/server";

// Simple HTTP Basic Auth in front of /admin — enough for a single-admin
// tool. If this ever needs multiple admins or finer-grained permissions,
// swap this for real session-based auth; not worth the complexity yet.
export function middleware(req: NextRequest) {
  const auth = req.headers.get("authorization");

  if (auth) {
    const [, encoded] = auth.split(" ");
    const [user, pass] = Buffer.from(encoded, "base64").toString().split(":");
    if (user === process.env.ADMIN_USERNAME && pass === process.env.ADMIN_PASSWORD) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
  });
}

export const config = {
  matcher: "/admin/:path*",
};
