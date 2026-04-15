/**
 * App shell layout — Server Component.
 *
 * Performs server-side auth via Supabase before rendering any app UI.
 * Unauthenticated requests are redirected to /sign-in.
 *
 * Active route highlighting is handled inside AppSidebar via usePathname(),
 * so this layout does not need to be a Client Component.
 *
 * MOCK_USER (name/initials/role) will be replaced with a workspace membership
 * query once Sage's tRPC procedures are live in Sprint 2.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/shared/AppSidebar";
import type { NavSection } from "@/components/shared/AppSidebar";

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard",    href: "/dashboard",  icon: "⊞" },
      { label: "Check In/Out", href: "/checkinout", icon: "⇄" },
      { label: "Equipment",    href: "/equipment",  icon: "≡" },
    ],
  },
  {
    label: "Monitor",
    items: [
      { label: "Reports", href: "/reports", icon: "📋" },
      { label: "Damage",  href: "/damage",  icon: "⚠", badge: 21 },
    ],
  },
  {
    label: "Manage",
    items: [
      { label: "Locations", href: "/locations", icon: "🏢" },
      { label: "Team",      href: "/team",      icon: "👥" },
      { label: "Settings",  href: "/settings",  icon: "⚙" },
    ],
  },
];

/** Derive display initials from an email address. e.g. "matt@x.com" → "MA" */
function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Placeholder user display — Sprint 2 will replace with workspace membership query
  const displayUser = {
    initials: initialsFromEmail(user.email ?? ""),
    name: user.email ?? "User",
    role: "Member", // TODO Sprint 2: derive from workspace membership
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        sections={NAV_SECTIONS}
        user={displayUser}
        deptLabel="🎬 Lighting Dept"
      />
      <main className="flex-1 overflow-hidden flex flex-col bg-grey-light">
        {children}
      </main>
    </div>
  );
}
