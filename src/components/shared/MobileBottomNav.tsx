"use client";

/**
 * LogiTrak MobileBottomNav — Sprint 4
 *
 * Fixed bottom bar for mobile (hidden on lg+).
 * 5 items: Dashboard, Check In/Out, Equipment, Damage, More (→ slide-up sheet)
 * "More" sheet: Reports, Team, Settings.
 *
 * Active state: brand-blue icon + label; inactive: grey.
 * Shown only when `hidden lg:flex` on parent, or directly with `lg:hidden` on this component.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  href:   string;
  label:  string;
  icon:   string;
}

const MAIN_ITEMS: NavItem[] = [
  { href: "/dashboard",  label: "Dashboard",   icon: "⊞" },
  { href: "/checkinout", label: "Check In/Out", icon: "⇄" },
  { href: "/equipment",  label: "Equipment",   icon: "≡" },
  { href: "/damage",     label: "Damage",      icon: "⚠" },
];

const MORE_ITEMS: NavItem[] = [
  { href: "/reports",   label: "Reports",  icon: "📋" },
  { href: "/team",      label: "Team",     icon: "👥" },
  { href: "/locations", label: "Locations", icon: "🏢" },
  { href: "/settings",  label: "Settings", icon: "⚙" },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Close sheet on route change
  useEffect(() => { setSheetOpen(false); }, [pathname]);

  // Close sheet on Escape
  useEffect(() => {
    if (!sheetOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSheetOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const isMoreActive = MORE_ITEMS.some((i) =>
    pathname === i.href || pathname.startsWith(i.href + "/")
  );

  return (
    <>
      {/* Bottom nav bar — only on mobile */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-grey-mid flex items-stretch"
        aria-label="Mobile navigation"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {MAIN_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-center transition-colors",
                isActive ? "text-brand-blue" : "text-grey hover:text-surface-dark"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="text-[20px] leading-none">{item.icon}</span>
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          type="button"
          onClick={() => setSheetOpen((v) => !v)}
          className={cn(
            "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors",
            isMoreActive || sheetOpen ? "text-brand-blue" : "text-grey hover:text-surface-dark"
          )}
          aria-expanded={sheetOpen}
          aria-haspopup="dialog"
        >
          <span className="text-[20px] leading-none">☰</span>
          <span className="text-[10px] font-semibold">More</span>
        </button>
      </nav>

      {/* Slide-up sheet overlay */}
      {sheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/30"
            onClick={() => setSheetOpen(false)}
            aria-hidden
          />

          {/* Sheet */}
          <div
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-panel border-t border-grey-mid"
            role="dialog"
            aria-label="More navigation"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-grey-mid rounded-full" />
            </div>

            <div className="px-4 pb-4">
              <p className="text-[10px] font-bold text-grey uppercase tracking-widest mb-3 px-1">More</p>
              <div className="grid grid-cols-2 gap-2">
                {MORE_ITEMS.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-card border transition-colors",
                        isActive
                          ? "bg-brand-blue-light border-brand-blue/20 text-brand-blue"
                          : "bg-grey-light border-grey-mid text-surface-dark hover:bg-white"
                      )}
                    >
                      <span className="text-[18px]">{item.icon}</span>
                      <span className="text-[13px] font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
