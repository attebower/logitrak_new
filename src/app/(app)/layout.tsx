"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/shared/AppSidebar";

const NAV_SECTIONS = [
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

const MOCK_USER = { initials: "MC", name: "Matt Collins", role: "Owner" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        sections={NAV_SECTIONS}
        activeHref={pathname}
        user={MOCK_USER}
        deptLabel="🎬 Lighting Dept"
      />
      <main className="flex-1 overflow-hidden flex flex-col bg-grey-light">
        {children}
      </main>
    </div>
  );
}
