/**
 * LogiTrak StatCard Component
 * Custom component — not a shadcn override.
 *
 * Spec: white card, rounded, grey border, 3px coloured top border, ghost icon top-right,
 *       uppercase label, large bold number, optional change/subtext.
 *
 * Usage:
 *   <StatCard
 *     color="blue"
 *     icon="⊞"
 *     label="Total Assets"
 *     value={847}
 *     change="↑ 12 this week"
 *     changeColor="green"
 *   />
 */

import { cn } from "@/lib/utils";

// Top-border colour variants — maps to spec stat card colours
const colorMap = {
  blue:  "before:bg-brand-blue",
  green: "before:bg-status-green",
  amber: "before:bg-status-amber",
  red:   "before:bg-status-red",
  teal:  "before:bg-status-teal",
} as const;

const changeColorMap = {
  green: "text-status-green",
  red:   "text-status-red",
  grey:  "text-grey",
} as const;

export type StatCardColor = keyof typeof colorMap;
export type StatCardChangeColor = keyof typeof changeColorMap;

export interface StatCardProps {
  /** Top border accent colour */
  color: StatCardColor;
  /** Icon rendered ghost top-right */
  icon?: React.ReactNode;
  /** Uppercase label — e.g. "Total Assets" */
  label: string;
  /** Large number value */
  value: number | string;
  /** Optional sub-line — e.g. "↑ 12 this week" or "48.6% of total" */
  change?: string;
  /** Colour of the change line */
  changeColor?: StatCardChangeColor;
  className?: string;
}

export function StatCard({
  color,
  icon,
  label,
  value,
  change,
  changeColor = "grey",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        // Card base
        "relative overflow-hidden rounded-card bg-white border border-grey-mid p-[18px_20px]",
        // Top border via ::before pseudo — Tailwind pseudo classes
        "before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:content-['']",
        colorMap[color],
        className
      )}
    >
      {/* Ghost icon — top-right */}
      {icon && (
        <span
          className="absolute top-4 right-4 opacity-20 select-none"
          aria-hidden
        >
          {icon}
        </span>
      )}

      {/* Label */}
      <p className="text-caption text-grey uppercase tracking-[0.03125rem] mb-1.5">
        {label}
      </p>

      {/* Value */}
      <p className="text-[32px] font-extrabold text-surface-dark leading-none tracking-tight">
        {value}
      </p>

      {/* Change / subtext */}
      {change && (
        <p className={cn("text-caption mt-1", changeColorMap[changeColor])}>
          {change}
        </p>
      )}
    </div>
  );
}

// Convenience preset — matches the 4-up dashboard stat grid
export function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {children}
    </div>
  );
}
