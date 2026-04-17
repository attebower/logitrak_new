/**
 * LogiTrak MobileBottomNav Component
 * Fixed bottom navigation for mobile — hidden on lg+ (sidebar takes over).
 *
 * 5 tabs: Dashboard, Check In/Out, Equipment, Damage, More.
 * "More" opens a slide-up sheet with secondary nav items.
 * Safe-area padding for notched phones (env(safe-area-inset-bottom)).
 *
 * Usage:
 *   // In the app shell layout, below the main content:
 *   <MobileBottomNav
 *     activeHref={pathname}
 *     damageCount={damageCount}
 *   />
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ArrowLeftRight, List, AlertTriangle,
  FileText, Users, Building2, Settings, MoreHorizontal,
} from "lucide-react";

// ── Nav definitions ───────────────────────────────────────────────────────

interface PrimaryTab {
  label:  string;
  href:   string;
  icon:   React.ReactNode;
  badge?: number;
}

interface SheetItem {
  label: string;
  href:  string;
  icon:  React.ReactNode;
}

const PRIMARY_TABS: PrimaryTab[] = [
  { label: "Dashboard",    href: "/dashboard",  icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
  { label: "Check In/Out", href: "/checkinout", icon: <ArrowLeftRight className="h-[18px] w-[18px]" /> },
  { label: "Equipment",    href: "/equipment",  icon: <List className="h-[18px] w-[18px]" /> },
  { label: "Damage",       href: "/damage",     icon: <AlertTriangle className="h-[18px] w-[18px]" /> },
];

const SHEET_ITEMS: SheetItem[] = [
  { label: "Reports",   href: "/reports",   icon: <FileText className="h-[20px] w-[20px]" /> },
  { label: "Team",      href: "/team",      icon: <Users className="h-[20px] w-[20px]" /> },
  { label: "Locations", href: "/locations", icon: <Building2 className="h-[20px] w-[20px]" /> },
  { label: "Settings",  href: "/settings",  icon: <Settings className="h-[20px] w-[20px]" /> },
];

// ── Component ─────────────────────────────────────────────────────────────

export interface MobileBottomNavProps {
  /** Active href — pass usePathname() */
  activeHref?:  string;
  /** Damage count for badge — mirrors sidebar badge */
  damageCount?: number;
}

export function MobileBottomNav({
  activeHref,
  damageCount,
}: MobileBottomNavProps) {
  const pathname   = usePathname();
  const current    = activeHref ?? pathname;
  const [sheetOpen, setSheetOpen] = useState(false);

  // Close sheet on route change
  useEffect(() => { setSheetOpen(false); }, [pathname]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    document.body.style.overflow = sheetOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sheetOpen]);

  const sheetActive = SHEET_ITEMS.some((i) => i.href === current);

  return (
    <>
      {/* ── Bottom nav bar ── */}
      <nav
        className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 z-30",
          "bg-white border-t border-grey-mid",
          // Safe-area padding for notched phones
          "pb-[env(safe-area-inset-bottom,0px)]"
        )}
        aria-label="Mobile navigation"
      >
        <div className="flex">
          {/* Primary tabs */}
          {PRIMARY_TABS.map((tab) => {
            const isActive = current === tab.href;
            const count = tab.href === "/damage" ? damageCount : undefined;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex-1 flex flex-col items-center pt-2.5 pb-2"
                aria-current={isActive ? "page" : undefined}
              >
                <div className="relative">
                  <span
                    className={cn(isActive ? "text-brand-blue" : "text-grey")}
                    aria-hidden
                  >
                    {tab.icon}
                  </span>
                  {count != null && count > 0 && (
                    <span className="absolute -top-1 -right-1.5 bg-status-red text-white text-[9px] font-bold px-1 py-px rounded-full leading-none">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[9px] mt-1 font-medium tracking-tight",
                    isActive ? "text-brand-blue" : "text-grey"
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}

          {/* More tab */}
          <button
            className="flex-1 flex flex-col items-center pt-2.5 pb-2"
            onClick={() => setSheetOpen((o) => !o)}
            aria-expanded={sheetOpen}
            aria-controls="more-sheet"
            aria-label="More navigation options"
          >
            <MoreHorizontal
              className={cn("h-[18px] w-[18px]", (sheetOpen || sheetActive) ? "text-brand-blue" : "text-grey")}
              aria-hidden
            />
            <span
              className={cn(
                "text-[9px] mt-1 font-medium tracking-tight",
                (sheetOpen || sheetActive) ? "text-brand-blue" : "text-grey"
              )}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* ── More sheet ── */}
      {/* Backdrop */}
      {sheetOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setSheetOpen(false)}
          aria-hidden
        />
      )}

      {/* Sheet */}
      <div
        id="more-sheet"
        role="dialog"
        aria-label="More navigation"
        aria-modal="true"
        className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 z-50",
          "bg-white rounded-t-[20px] shadow-device",
          "transition-transform duration-300",
          // Slide up/down
          sheetOpen ? "translate-y-0" : "translate-y-full",
          // Safe-area bottom padding
          "pb-[env(safe-area-inset-bottom,16px)]"
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-9 h-1 bg-grey-mid rounded-full" aria-hidden />
        </div>

        {/* Sheet items */}
        <div className="px-4 pb-4">
          {SHEET_ITEMS.map((item) => {
            const isActive = current === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-4 px-4 py-3.5 rounded-[10px] transition-colors",
                  isActive
                    ? "bg-brand-blue/8 text-brand-blue"
                    : "text-surface-dark hover:bg-grey-light"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="w-7 flex items-center justify-center" aria-hidden>
                  {item.icon}
                </span>
                <span className="text-[15px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
