import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "admin_session";

function isAuthenticated(req: NextRequest): boolean {
  const cookie = req.cookies.get(SESSION_COOKIE);
  const token = process.env.ADMIN_SESSION_TOKEN;
  return !!token && !!cookie && cookie.value === token;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API admin routes (except login): return 401 if unauthenticated
  if (
    pathname.startsWith("/api/admin/") &&
    pathname !== "/api/admin/login"
  ) {
    if (!isAuthenticated(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Admin pages (except login): redirect to /admin/login
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    if (!isAuthenticated(req)) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
