/**
 * LogiTrak DamageCard Component
 * Displays a single damage report — used on the Damage Reports page (Screen 04).
 *
 * Shows: serial, type, description, location where damage occurred,
 * reported by, date, current damage status, and action buttons.
 *
 * Usage:
 *   <DamageCard
 *     report={damageReport}
 *     onLogRepair={(id) => openRepairModal(id)}
 *     onView={(id) => openEquipmentDetail(id)}
 *   />
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BadgeProps } from "@/components/ui/badge";

// ── Data shape ────────────────────────────────────────────────────────────

export type DamageStatus = "damaged" | "under-repair" | "repaired";

export interface DamageReport {
  id:          string;
  serial:      string;
  type:        string;
  description: string;
  location?:   string;  // where the item was when damaged
  reportedBy:  string;
  reportedAt:  string;  // ISO string
  status:      DamageStatus;
}

// ── Status display map ────────────────────────────────────────────────────

const statusVariant: Record<DamageStatus, BadgeProps["variant"]> = {
  damaged:      "damaged",
  "under-repair": "under-repair",
  repaired:     "repaired",
};

const statusLabel: Record<DamageStatus, string> = {
  damaged:       "Damaged",
  "under-repair": "Under Repair",
  repaired:      "Repaired",
};

// ── Component ─────────────────────────────────────────────────────────────

export interface DamageCardProps {
  report:        DamageReport;
  onLogRepair?:  (id: string) => void;
  onView?:       (id: string) => void;
}

export function DamageCard({ report, onLogRepair, onView }: DamageCardProps) {
  const date = formatDate(report.reportedAt);

  return (
    <div className="bg-white rounded-card border border-grey-mid p-5 space-y-3">
      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-serial text-surface-dark text-[14px]">
            #{report.serial}
          </span>
          <span className="text-body text-grey">{report.type}</span>
          <Badge variant={statusVariant[report.status]}>
            {statusLabel[report.status]}
          </Badge>
        </div>
        <span className="text-[11px] text-grey flex-shrink-0">{date}</span>
      </div>

      {/* ── Description ── */}
      <p className="text-[13px] text-surface-dark leading-snug">{report.description}</p>

      {/* ── Meta ── */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-grey">
        {report.location && (
          <span>📍 {report.location}</span>
        )}
        <span>Reported by <span className="font-semibold text-surface-dark">{report.reportedBy}</span></span>
      </div>

      {/* ── Actions ── */}
      {(onLogRepair || onView) && (
        <div className="flex gap-2 pt-1">
          {report.status !== "repaired" && onLogRepair && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onLogRepair(report.id)}
            >
              Log Repair
            </Button>
          )}
          {onView && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onView(report.id)}
            >
              View Equipment
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Damage card list wrapper ──────────────────────────────────────────────

export function DamageCardList({
  reports,
  onLogRepair,
  onView,
}: {
  reports:       DamageReport[];
  onLogRepair?:  (id: string) => void;
  onView?:       (id: string) => void;
}) {
  if (reports.length === 0) {
    return (
      <div className="py-10 text-center text-grey text-body">
        No damage reports to show
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <DamageCard key={r.id} report={r} onLogRepair={onLogRepair} onView={onView} />
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day:   "numeric",
      month: "short",
      year:  "numeric",
      hour:  "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
