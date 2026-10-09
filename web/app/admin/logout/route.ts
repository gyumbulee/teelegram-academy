import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminSession";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/admin/login", req.url));
  res.cookies.delete(ADMIN_SESSION_COOKIE);
  return res;
}
