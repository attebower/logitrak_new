"use client";

/**
 * Settings layout — adds a left sub-sidebar with grouped sections.
 * The main app sidebar stays on the far left; this is a secondary nav
 * scoped to /settings/* routes.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { cn } from "@/lib/utils";

const SETTINGS_NAV = [
  {
    label: "Account",
    items: [
      { label: "General",        href: "/settings" },
      { label: "Business",       href: "/settings/business" },
      { label: "Invoicing",      href: "/settings/invoicing" },
      { label: "Documents",      href: "/settings/documents" },
      { label: "Billing",        href: "/settings/billing" },
    ],
  },
  {
    label: "Equipment",
    items: [
      { label: "Categories",     href: "/settings/categories" },
      { label: "Product Catalog",href: "/settings/catalog" },
      { label: "Locations",      href: "/settings/locations" },
    ],
  },
  {
    label: "Advanced",
    items: [
      { label: "Danger Zone",    href: "/settings/danger" },
    ],
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <AppTopbar title="Settings" />

      <div className="flex-1 overflow-hidden flex">
        {/* Sub-sidebar */}
        <aside className="w-[220px] shrink-0 bg-white border-r border-grey-mid overflow-y-auto">
          <nav className="py-4 px-3 space-y-6">
            {SETTINGS_NAV.map((section) => (
              <div key={section.label}>
                <div className="px-2 mb-1.5 text-[10px] font-semibold text-grey uppercase tracking-wider">
                  {section.label}
                </div>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "block px-2 py-1.5 rounded-btn text-[13px] transition-colors",
                            isActive
                              ? "bg-brand-blue/10 text-brand-blue font-semibold"
                              : "text-surface-dark hover:bg-grey-light"
                          )}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}
