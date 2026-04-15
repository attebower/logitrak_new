/**
 * LogiTrak RepairLogCard Component
 * Displays a completed repair — used in the repair history section of the Damage page
 * and in the EquipmentDetailPanel damage history.
 *
 * Shows: what was done, repaired by, location returned to, date, serial reference.
 *
 * Usage:
 *   <RepairLogCard log={repairLog} onView={(id) => openEquipmentDetail(id)} />
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── Data shape ────────────────────────────────────────────────────────────

export interface RepairLog {
  id:             string;
  /** The damage report this repair resolves */
  damageReportId: string;
  serial:         string;
  type:           string;
  /** Description of what was done */
  workDone:       string;
  repairedBy:     string;
  /** Location the item was returned to after repair */
  returnedTo?:    string;
  repairedAt:     string; // ISO string
}

// ── Component ─────────────────────────────────────────────────────────────

export interface RepairLogCardProps {
  log:      RepairLog;
  onView?:  (serial: string) => void;
}

export function RepairLogCard({ log, onView }: RepairLogCardProps) {
  return (
    <div className="bg-white rounded-card border border-grey-mid p-5 space-y-3">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-serial text-surface-dark text-[14px]">
            #{log.serial}
          </span>
          <span className="text-body text-grey">{log.type}</span>
          {/* Teal repaired badge */}
          <Badge variant="repaired">Repaired</Badge>
        </div>
        <span className="text-[11px] text-grey flex-shrink-0">
          {formatDate(log.repairedAt)}
        </span>
      </div>

      {/* ── Work done ── */}
      <div>
        <p className="text-caption text-grey uppercase mb-1">Work Done</p>
        <p className="text-[13px] text-surface-dark leading-snug">{log.workDone}</p>
      </div>

      {/* ── Meta ── */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-grey">
        <span>
          Repaired by{" "}
          <span className="font-semibold text-surface-dark">{log.repairedBy}</span>
        </span>
        {log.returnedTo && (
          <span>
            Returned to{" "}
            <span className="font-semibold text-surface-dark">{log.returnedTo}</span>
          </span>
        )}
      </div>

      {/* ── Action ── */}
      {onView && (
        <div className="pt-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onView(log.serial)}
          >
            View Equipment
          </Button>
        </div>
      )}
    </div>
  );
}

// ── List wrapper ──────────────────────────────────────────────────────────

export function RepairLogList({
  logs,
  onView,
}: {
  logs:     RepairLog[];
  onView?:  (serial: string) => void;
}) {
  if (logs.length === 0) {
    return (
      <div className="py-10 text-center text-grey text-body">
        No repairs logged yet
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <RepairLogCard key={log.id} log={log} onView={onView} />
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day:    "numeric",
      month:  "short",
      year:   "numeric",
      hour:   "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
