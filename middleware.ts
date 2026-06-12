import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "admin_session";

function isAdminAuthenticated(req: NextRequest): boolean {
  const cookie = req.cookies.get(ADMIN_COOKIE);
  const token = process.env.ADMIN_SESSION_TOKEN;
  return !!token && !!cookie && cookie.value === token;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Admin API routes (except login): return 401 if unauthenticated
  if (pathname.startsWith("/api/admin/") && pathname !== "/api/admin/login") {
    if (!isAdminAuthenticated(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Admin pages (except login): redirect to /admin/login
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    if (!isAdminAuthenticated(req)) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    return NextResponse.next();
  }

  // Supabase session refresh for all other routes
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env vars are missing (e.g. preview deployment without secrets), skip auth refresh
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request: req });
  }

  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /account and /projects — require auth
  if (
    (pathname.startsWith("/account") || pathname.startsWith("/projects")) &&
    !user
  ) {
    return NextResponse.redirect(new URL("/auth?tab=signin", req.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/account/:path*",
    "/projects/:path*",
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
