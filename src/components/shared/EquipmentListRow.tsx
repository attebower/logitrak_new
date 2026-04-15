/**
 * LogiTrak EquipmentListRow Component
 * A single row in the Equipment Registry table — Screen 03.
 *
 * Columns: checkbox, serial, type, category chip, status badge, location, last activity, View button.
 *
 * Usage:
 *   <table>
 *     <EquipmentTableHead onSelectAll={...} allSelected={...} />
 *     <tbody>
 *       {equipment.map(item => (
 *         <EquipmentListRow key={item.id} item={item} onView={...} />
 *       ))}
 *     </tbody>
 *   </table>
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BadgeProps } from "@/components/ui/badge";

// ── Data shape ────────────────────────────────────────────────────────────

export type EquipmentStatus = "available" | "checked-out" | "damaged" | "repaired" | "under-repair";

export interface EquipmentItem {
  id:           string;
  serial:       string;
  type:         string;
  category:     string;
  status:       EquipmentStatus;
  location?:    string;  // e.g. "Stage 7B / Throne Room" or "In Stock"
  lastActivity?: string; // human-readable, e.g. "2h ago"
}

// ── Status → Badge variant map ────────────────────────────────────────────

const statusVariant: Record<EquipmentStatus, BadgeProps["variant"]> = {
  available:     "available",
  "checked-out": "checked-out",
  damaged:       "damaged",
  repaired:      "repaired",
  "under-repair": "under-repair",
};

const statusLabel: Record<EquipmentStatus, string> = {
  available:     "Available",
  "checked-out": "Checked Out",
  damaged:       "Damaged",
  repaired:      "Repaired",
  "under-repair": "Under Repair",
};

// ── Table Head ────────────────────────────────────────────────────────────

export interface EquipmentTableHeadProps {
  onSelectAll?:  (checked: boolean) => void;
  allSelected?:  boolean;
}

export function EquipmentTableHead({ onSelectAll, allSelected }: EquipmentTableHeadProps) {
  return (
    <thead>
      <tr>
        <th className="w-10 bg-grey-light px-4 py-2.5 border-b border-grey-mid">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAll?.(e.target.checked)}
            className="w-3.5 h-3.5"
            aria-label="Select all"
          />
        </th>
        {["Serial", "Type", "Category", "Status", "Location", "Last Activity", ""].map((h) => (
          <th
            key={h}
            className="bg-grey-light px-4 py-2.5 text-left text-caption text-grey uppercase tracking-[0.03125rem] border-b border-grey-mid font-bold"
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────

export interface EquipmentListRowProps {
  item:        EquipmentItem;
  selected?:   boolean;
  onSelect?:   (id: string, checked: boolean) => void;
  onView?:     (id: string) => void;
}

export function EquipmentListRow({
  item,
  selected,
  onSelect,
  onView,
}: EquipmentListRowProps) {
  return (
    <tr className="border-b border-grey-mid hover:bg-grey-light/80 transition-colors">
      {/* Checkbox */}
      <td className="px-4 py-[11px]">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect?.(item.id, e.target.checked)}
          className="w-3.5 h-3.5"
          aria-label={`Select ${item.serial}`}
        />
      </td>

      {/* Serial */}
      <td className="px-4 py-[11px]">
        <span className="text-serial text-surface-dark">{item.serial}</span>
      </td>

      {/* Type */}
      <td className="px-4 py-[11px] text-body text-surface-dark">{item.type}</td>

      {/* Category chip — blue pill, no dot */}
      <td className="px-4 py-[11px]">
        <Badge variant="category">{item.category}</Badge>
      </td>

      {/* Status badge */}
      <td className="px-4 py-[11px]">
        <Badge variant={statusVariant[item.status]}>
          {statusLabel[item.status]}
        </Badge>
      </td>

      {/* Location */}
      <td className="px-4 py-[11px] text-[11px] text-grey">
        {item.location ?? "—"}
      </td>

      {/* Last activity */}
      <td className="px-4 py-[11px] text-[11px] text-grey">
        {item.lastActivity ?? "—"}
      </td>

      {/* View button */}
      <td className="px-4 py-[11px]">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onView?.(item.id)}
        >
          View
        </Button>
      </td>
    </tr>
  );
}
