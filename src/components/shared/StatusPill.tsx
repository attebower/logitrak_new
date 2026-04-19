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
  | "retired";

const STATUS_META: Record<StatusPillValue, { label: string; colour: string; text: string }> = {
  available:    { label: "Available",    colour: "bg-status-green", text: "text-status-green" },
  issued:       { label: "Issued",       colour: "bg-status-amber", text: "text-status-amber" },
  damaged:      { label: "Damaged",      colour: "bg-status-red",   text: "text-status-red" },
  under_repair: { label: "Under Repair", colour: "bg-status-amber", text: "text-status-amber" },
  repaired:     { label: "Repaired",     colour: "bg-status-teal",  text: "text-status-teal" },
  retired:      { label: "Retired",      colour: "bg-grey",         text: "text-grey" },
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
        "inline-flex items-center rounded-md bg-grey-light border border-grey-mid font-semibold whitespace-nowrap",
        meta.text,
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
  return "available";
}
