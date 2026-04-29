/**
 * LogiTrak AppSidebar Component
 * Pixel-match to LogiTrak_UI_Concepts.html — Screen 01 sidebar.
 *
 * Active route is derived internally via usePathname() — the layout does
 * not need to pass activeHref. This keeps the layout a Server Component
 * so it can perform server-side auth checks.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

export interface NavItem {
  label: string;
  href:  string;
  icon:  React.ReactNode;
  badge?: number; // e.g. damage count
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export interface AppSidebarProps {
  sections: NavSection[];
  /** User display info */
  user: {
    initials: string;
    name:     string;
    role:     string;
  };
  /** Department / production context shown under logo */
  deptLabel?: string;
}

export function AppSidebar({
  sections,
  user,
  deptLabel,
}: AppSidebarProps) {
  const pathname = usePathname();
  return (
    <aside
      className="w-sidebar flex-shrink-0 hidden lg:flex flex-col bg-surface-dark border-r border-white/[0.05]"
      aria-label="Main navigation"
    >
      {/* ── Logo ── */}
      <div className="px-5 py-5 pb-4 border-b border-white/[0.06]">
        <div className="text-[18px] font-extrabold text-white tracking-[-0.03125rem]">
          <span className="text-brand-blue">Logi</span>Trak
        </div>
        {deptLabel && (
          <div className="text-[11px] text-slate-muted mt-0.5">{deptLabel}</div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label}>
            {/* Section label */}
            <p className="text-[10px] font-bold text-surface-dark3 uppercase tracking-[0.05rem] px-5 pt-4 pb-1.5">
              {section.label}
            </p>

            {/* Items */}
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-5 py-[9px] text-[13px] font-medium transition-colors duration-150",
                    isActive
                      ? "text-white font-semibold"
                      : "text-white/90 hover:text-white"
                  )}
                >
                  <span className="w-4 text-center text-sm leading-none" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="ml-auto bg-status-red text-white text-[10px] font-bold px-1.5 py-px rounded-[10px]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Theme toggle ── */}
      <div className="px-5 py-3 border-t border-white/[0.06]">
        <ThemeToggle />
      </div>

      {/* ── User footer ── */}
      <div className="px-5 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          <div className="w-[30px] h-[30px] flex-shrink-0 rounded-full bg-brand-blue flex items-center justify-center text-[12px] font-bold text-white">
            {user.initials}
          </div>
          <div>
            <div className="text-[12px] font-semibold text-slate-300">
              {user.name}
            </div>
            <div className="text-[10px] text-slate-muted">{user.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
