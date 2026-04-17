/**
 * LogiTrak Badge Component
 * Extends shadcn/ui Badge with equipment status variants.
 *
 * Usage: <Badge variant="available" />
 * Drop this file into components/ui/badge.tsx to replace the shadcn default.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // Base styles
  "inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px] font-semibold",
  {
    variants: {
      variant: {
        // ── Equipment status variants ────────────────────────────────
        /**
         * Available — green
         * bg: #DCFCE7 / text: #16A34A
         */
        available: "bg-status-green-light text-status-green",

        /**
         * Checked Out — amber
         * bg: #FEF3C7 / text: #D97706
         */
        "checked-out": "bg-status-amber-light text-status-amber",

        /**
         * Damaged — red
         * bg: #FEE2E2 / text: #DC2626
         */
        damaged: "bg-status-red-light text-status-red",

        /**
         * Repaired — teal
         * bg: #CCFBF1 / text: #0D9488
         */
        repaired: "bg-status-teal-light text-status-teal",

        // ── Under Repair ─────────────────────────────────────────
        "under-repair": "bg-status-orange-light text-status-orange",

        // ── Category chip (Equipment table) ─────────────────────────
        category: "bg-brand-blue-light text-brand-blue before:hidden",

        // ── Generic / default (shadcn compat) ───────────────────────
        default:
          "bg-grey-mid text-surface-dark before:hidden",

        secondary:
          "bg-surface-dark3 text-grey-light before:hidden",

        destructive:
          "bg-status-red-light text-status-red before:hidden",

        outline:
          "border border-grey-mid text-surface-dark before:hidden",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
