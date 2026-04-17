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

  // Unauthenticated: redirect to sign-in (except public routes)
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/sign-in") ||
                      pathname.startsWith("/sign-up") ||
                      pathname.startsWith("/auth");
  const isPublicRoute = pathname === "/" ||
                        pathname.startsWith("/pricing") ||
                        pathname.startsWith("/about");

  if (!user && !isAuthRoute && !isPublicRoute) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Enforce admin route gating using the workspace role from the DB.
  // app_metadata.role is not populated — roles live in WorkspaceUser.role.
  if (user) {
    const isAdminRoute = ADMIN_ROUTES.some(r => request.nextUrl.pathname.startsWith(r));
    if (isAdminRoute) {
      const { data: membership } = await supabase
        .from("workspace_users")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const role = membership?.role ?? null;
      const ADMIN_ROLES = ["owner", "admin", "manager"];
      if (!role || !ADMIN_ROLES.includes(role)) {
        const url = new URL("/dashboard", request.url);
        url.searchParams.set("error", "unauthorized");
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
