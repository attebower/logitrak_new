/**
 * StatusPill — rectangular, rounded, with a coloured right edge.
 *
 * Replaces the round badge "chip" style for equipment statuses.
 * Neutral background + bold coloured right edge = quick scan legibility
 * without the visual noise of full-fill coloured chips.
 *
 * Usage:
 *   <StatusPill status="available" />
 *   <StatusPill status="damaged"   size="sm" />
 */

import { cn } from "@/lib/utils";

export type StatusPillValue =
  | "available"
  | "issued"
  | "damaged"
  | "under_repair"
  | "repaired"
  | "retired"
  | "cross_hired";

const STATUS_META: Record<StatusPillValue, { label: string; chip: string }> = {
  available:    { label: "Available",    chip: "bg-status-green-light text-status-green" },
  issued:       { label: "Issued",       chip: "bg-brand-blue-light  text-brand-blue"   },
  damaged:      { label: "Damaged",      chip: "bg-status-red-light  text-status-red"   },
  under_repair: { label: "Under Repair", chip: "bg-status-amber-light text-status-amber" },
  repaired:     { label: "Repaired",     chip: "bg-status-teal-light text-status-teal"  },
  retired:      { label: "Retired",      chip: "bg-grey-mid          text-surface-dark" },
  cross_hired:  { label: "Cross Hired",  chip: "bg-violet-100        text-violet-700"   },
};

export function StatusPill({
  status,
  size = "md",
  className,
}: {
  status:    StatusPillValue;
  size?:     "sm" | "md";
  className?: string;
}) {
  const meta = STATUS_META[status];
  const pad  = size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-[12px]";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-semibold whitespace-nowrap",
        meta.chip,
        pad,
        className
      )}
    >
      {meta.label}
    </span>
  );
}

/**
 * Derive the correct status from raw Prisma fields.
 * Damage always takes precedence over availability.
 */
export function effectiveStatus(
  status: string | null | undefined,
  damageStatus: string | null | undefined
): StatusPillValue {
  if (damageStatus === "damaged")      return "damaged";
  if (damageStatus === "under_repair") return "under_repair";
  if (damageStatus === "repaired")     return "repaired";
  if (status === "checked_out")        return "issued";
  if (status === "retired")            return "retired";
  if (status === "cross_hired")        return "cross_hired";
  return "available";
}
