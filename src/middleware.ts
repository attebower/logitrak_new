import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes restricted to Admin role only
const ADMIN_ROUTES = ["/admin", "/team", "/settings"];
// Routes where write actions are blocked for read-only role
// (enforced at the API layer by Sage; middleware only handles page-level gating)

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Unauthenticated: redirect to sign-in (except auth routes)
  const isAuthRoute = request.nextUrl.pathname.startsWith("/sign-in") ||
                      request.nextUrl.pathname.startsWith("/sign-up");

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // TODO Sprint 2: fetch workspace role from DB and enforce:
  // - ADMIN_ROUTES: redirect non-admin to /dashboard with ?error=unauthorized
  // - Write actions: enforced at tRPC layer by Sage
  // For now, stub: if user has app_metadata.role === "read_only" or "operator",
  // block admin routes.
  if (user) {
    const role = (user.app_metadata?.role as string | undefined) ?? "member";
    const isAdminRoute = ADMIN_ROUTES.some(r => request.nextUrl.pathname.startsWith(r));
    if (isAdminRoute && role === "operator") {
      const url = new URL("/dashboard", request.url);
      url.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(url);
    }
    if (isAdminRoute && role === "read_only") {
      const url = new URL("/dashboard", request.url);
      url.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
