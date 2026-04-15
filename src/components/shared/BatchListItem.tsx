/**
 * LogiTrak BatchListItem Component
 * A single row in the check-in/out batch list.
 *
 * Shows: status dot (green = scan OK, red = error), serial, equipment type, remove button.
 * The parent renders these inside a white rounded card with a "Batch (N items)" header.
 *
 * Usage:
 *   <BatchList items={batchItems} onRemove={(serial) => removFromBatch(serial)} />
 */

import { cn } from "@/lib/utils";

export type BatchItemStatus = "ok" | "error" | "pending";

export interface BatchItem {
  serial:    string;
  type:      string;
  /** Scan validation status */
  status?:   BatchItemStatus;
}

// ── Single item row ────────────────────────────────────────────────────────

const statusDotClass: Record<BatchItemStatus, string> = {
  ok:      "bg-status-green",
  error:   "bg-status-red",
  pending: "bg-grey",
};

export interface BatchListItemProps extends BatchItem {
  onRemove?: (serial: string) => void;
}

export function BatchListItem({
  serial,
  type,
  status = "ok",
  onRemove,
}: BatchListItemProps) {
  return (
    <div className="flex items-center px-4 py-2.5 border-b border-grey-mid last:border-b-0 gap-3">
      {/* Status dot */}
      <div
        className={cn("w-2 h-2 rounded-full flex-shrink-0", statusDotClass[status])}
        aria-label={status === "ok" ? "Scan successful" : status === "error" ? "Scan error" : "Pending"}
      />

      {/* Serial + type */}
      <div className="flex-1 min-w-0">
        <div className="text-serial text-surface-dark">{serial}</div>
        <div className="text-[11px] text-grey truncate">{type}</div>
      </div>

      {/* Remove button */}
      {onRemove && (
        <button
          onClick={() => onRemove(serial)}
          className="text-status-red text-[14px] leading-none hover:text-red-700 transition-colors flex-shrink-0 px-1"
          aria-label={`Remove ${serial} from batch`}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── Batch list wrapper ─────────────────────────────────────────────────────

export interface BatchListProps {
  items:    BatchItem[];
  onRemove?: (serial: string) => void;
  onClear?:  () => void;
}

export function BatchList({ items, onRemove, onClear }: BatchListProps) {
  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-grey-mid">
        <span className="text-caption text-grey uppercase">
          Batch ({items.length} {items.length === 1 ? "item" : "items"})
        </span>
        {onClear && items.length > 0 && (
          <button
            onClick={onClear}
            className="text-[12px] text-status-red hover:text-red-700 cursor-pointer transition-colors"
            aria-label="Clear all items from batch"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-grey">
          Scan or type a serial to add items
        </div>
      ) : (
        items.map((item) => (
          <BatchListItem
            key={item.serial}
            {...item}
            onRemove={onRemove}
          />
        ))
      )}
    </div>
  );
}
