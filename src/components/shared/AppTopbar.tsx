/**
 * LogiTrak AppTopbar Component
 * Pixel-match to LogiTrak_UI_Concepts.html — topbar across all screens.
 *
 * Spec:
 * - Height: 56px
 * - Background: white
 * - Bottom border: 1px solid #E2E8F0
 * - Title: 16px / 700 / #0F172A
 * - Actions slot: right-aligned flex
 */

import { cn } from "@/lib/utils";

export interface AppTopbarProps {
  /** Page title — e.g. "Dashboard", "Equipment Registry" */
  title: string;
  /** Right-aligned actions area — pass Button elements or any JSX */
  actions?: React.ReactNode;
  /** Optional context label shown left of actions — e.g. "🎬 Series 4 Production" */
  context?: string;
  className?: string;
}

export function AppTopbar({
  title,
  actions,
  context,
  className,
}: AppTopbarProps) {
  return (
    <header
      className={cn(
        "h-topbar flex-shrink-0 bg-white border-b border-grey-mid",
        "flex items-center justify-between px-7",
        className
      )}
    >
      {/* Title */}
      <h1 className="text-[16px] font-bold text-surface-dark">{title}</h1>

      {/* Right: optional context + actions */}
      <div className="flex items-center gap-2.5">
        {context && (
          <span className="text-[11px] text-grey hidden sm:block">{context}</span>
        )}
        {actions}
      </div>
    </header>
  );
}
