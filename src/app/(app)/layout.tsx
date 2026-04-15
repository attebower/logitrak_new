/**
 * App shell layout — Server Component.
 *
 * Auth gate: redirects unauthenticated users to /sign-in.
 * Workspace: fetches the user's first active workspace via Prisma directly
 * (cheaper than a tRPC round-trip at layout level) and passes it into
 * WorkspaceProvider so all client components have access to workspaceId.
 *
 * If the user has no workspace yet, redirects to /onboarding.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { AppSidebar } from "@/components/shared/AppSidebar";
import { TRPCProvider } from "@/lib/trpc/provider";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { MobileBottomNav } from "@/components/shared/MobileBottomNav";
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
      { label: "Damage",  href: "/damage",  icon: "⚠" },
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

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  // Fetch the user's first active workspace membership
  const membership = await prisma.workspaceUser.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { createdAt: "asc" },
    include: { workspace: { select: { id: true, name: true, slug: true } } },
  });

  if (!membership) redirect("/onboarding");

  const workspaceCtx = {
    workspaceId: membership.workspace.id,
    workspaceName: membership.workspace.name,
    userRole: membership.role,
  };

  const displayUser = {
    initials: initialsFromEmail(user.email ?? ""),
    name: user.email ?? "User",
    role: membership.role.charAt(0).toUpperCase() + membership.role.slice(1),
  };

  return (
    <TRPCProvider>
      <WorkspaceProvider value={workspaceCtx}>
        <div className="flex h-screen overflow-hidden">
          <AppSidebar
            sections={NAV_SECTIONS}
            user={displayUser}
            deptLabel={membership.workspace.name}
          />
          <main className="flex-1 overflow-hidden flex flex-col bg-grey-light pb-20 lg:pb-0">
            {children}
          </main>
          <MobileBottomNav />
        </div>
      </WorkspaceProvider>
    </TRPCProvider>
  );
}
