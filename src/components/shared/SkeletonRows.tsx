/**
 * SkeletonRows — generic loading placeholder for list-style surfaces.
 *
 * Renders `count` faded grey rows that mimic a typical "label + value"
 * row. Used in place of the old "Loading…" plain-text patterns so list
 * pages feel responsive while data is fetching.
 *
 * Usage:
 *   {isLoading ? <SkeletonRows count={5} /> : <RealList … />}
 */

import { cn } from "@/lib/utils";

export interface SkeletonRowsProps {
  /** How many placeholder rows to show. Default 4. */
  count?: number;
  /** Variant. "row" — flex row with two bars (default). "card" — taller block. */
  variant?: "row" | "card";
  /** Extra wrapper className. */
  className?: string;
}

export function SkeletonRows({ count = 4, variant = "row", className }: SkeletonRowsProps) {
  if (variant === "card") {
    return (
      <div className={cn("grid grid-cols-1 gap-2", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-card border border-grey-mid p-4 animate-pulse">
            <div className="h-3 w-1/3 bg-grey-mid rounded mb-2" />
            <div className="h-3 w-2/3 bg-grey-mid rounded" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={cn("divide-y divide-grey-mid", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
          <div className="flex-1 h-3 bg-grey-mid rounded" />
          <div className="w-16 h-3 bg-grey-mid rounded" />
        </div>
      ))}
    </div>
  );
}
