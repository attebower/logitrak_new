/**
 * LogiTrak RoleBadge Component
 * Colour-coded pill for each workspace role.
 *
 * Roles (from product spec, highest → lowest privilege):
 *   owner → admin → manager → operator → read-only
 *
 * Usage:
 *   <RoleBadge role="admin" />
 *   <RoleBadge role="operator" />
 */

import { cn } from "@/lib/utils";

export type WorkspaceRole = "owner" | "admin" | "manager" | "operator" | "read-only";

// Colour mapping — each role gets a distinct, accessible colour pair
const roleStyles: Record<WorkspaceRole, { bg: string; text: string; label: string }> = {
  owner: {
    bg:    "bg-brand-blue-light",
    text:  "text-brand-blue",
    label: "Owner",
  },
  admin: {
    bg:    "bg-surface-dark3/10",
    text:  "text-surface-dark",
    label: "Admin",
  },
  manager: {
    bg:    "bg-status-teal-light",
    text:  "text-status-teal",
    label: "Manager",
  },
  operator: {
    bg:    "bg-status-amber-light",
    text:  "text-status-amber",
    label: "Operator",
  },
  "read-only": {
    bg:    "bg-grey-mid",
    text:  "text-grey",
    label: "Read-Only",
  },
};

export interface RoleBadgeProps {
  role:       WorkspaceRole;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const { bg, text, label } = roleStyles[role];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-badge px-2 py-0.5 text-[11px] font-semibold",
        bg,
        text,
        className
      )}
    >
      {label}
    </span>
  );
}

// Role colour reference (for dropdowns, selectors, etc.)
export const ROLE_OPTIONS: { value: WorkspaceRole; label: string }[] = [
  { value: "owner",     label: "Owner"     },
  { value: "admin",     label: "Admin"     },
  { value: "manager",   label: "Manager"   },
  { value: "operator",  label: "Operator"  },
  { value: "read-only", label: "Read-Only" },
];
