/**
 * LogiTrak ReportFilterBar Component
 * Compact filter bar for report pages — sits above ReportTable.
 *
 * Filters: date range, status, location, user.
 * Each filter is optional — only render what's relevant for the report type.
 *
 * Usage:
 *   <ReportFilterBar
 *     filters={filters}
 *     onChange={setFilters}
 *     users={userList}
 *     locations={locationList}
 *     statusOptions={["available", "checked-out", "damaged"]}
 *   />
 */

"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ── Filter value shape ────────────────────────────────────────────────────

export interface ReportFilters {
  /** ISO date string "YYYY-MM-DD" */
  dateFrom?:  string;
  dateTo?:    string;
  /** Status key — e.g. "available", "checked-out", "damaged" */
  status?:    string;
  /** Location ID */
  locationId?: string;
  /** User ID */
  userId?:    string;
}

// ── Option shapes ─────────────────────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
}

// ── Component ─────────────────────────────────────────────────────────────

export interface ReportFilterBarProps {
  filters:        ReportFilters;
  onChange:       (filters: ReportFilters) => void;
  /** Show date range pickers (default: true) */
  showDateRange?: boolean;
  /** Status filter options — omit to hide the filter */
  statusOptions?: FilterOption[];
  /** Location options — omit to hide the filter */
  locations?:     FilterOption[];
  /** User options — omit to hide the filter */
  users?:         FilterOption[];
  className?:     string;
}

export function ReportFilterBar({
  filters,
  onChange,
  showDateRange = true,
  statusOptions,
  locations,
  users,
  className,
}: ReportFilterBarProps) {
  function set(partial: Partial<ReportFilters>) {
    onChange({ ...filters, ...partial });
  }

  function reset() {
    onChange({});
  }

  const hasFilters =
    filters.dateFrom ||
    filters.dateTo ||
    filters.status ||
    filters.locationId ||
    filters.userId;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 mb-4",
        className
      )}
    >
      {/* ── Date range ── */}
      {showDateRange && (
        <>
          <FilterLabel>From</FilterLabel>
          <input
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(e) => set({ dateFrom: e.target.value || undefined })}
            className={filterInputClass}
            aria-label="Date from"
          />
          <FilterLabel>To</FilterLabel>
          <input
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(e) => set({ dateTo: e.target.value || undefined })}
            className={filterInputClass}
            aria-label="Date to"
          />
        </>
      )}

      {/* ── Status ── */}
      {statusOptions && statusOptions.length > 0 && (
        <select
          value={filters.status ?? ""}
          onChange={(e) => set({ status: e.target.value || undefined })}
          className={filterSelectClass}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {/* ── Location ── */}
      {locations && locations.length > 0 && (
        <select
          value={filters.locationId ?? ""}
          onChange={(e) => set({ locationId: e.target.value || undefined })}
          className={filterSelectClass}
          aria-label="Filter by location"
        >
          <option value="">All locations</option>
          {locations.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {/* ── User ── */}
      {users && users.length > 0 && (
        <select
          value={filters.userId ?? ""}
          onChange={(e) => set({ userId: e.target.value || undefined })}
          className={filterSelectClass}
          aria-label="Filter by user"
        >
          <option value="">All users</option>
          {users.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {/* ── Reset ── */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="text-grey hover:text-status-red"
        >
          ✕ Clear
        </Button>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

const filterInputClass =
  "bg-white border border-grey-mid rounded-[6px] px-2.5 py-[5px] text-[12px] text-surface-dark focus:outline-none focus:border-brand-blue";

const filterSelectClass =
  "bg-white border border-grey-mid rounded-[6px] px-2.5 py-[5px] text-[12px] text-surface-dark focus:outline-none focus:border-brand-blue";

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold text-grey">{children}</span>
  );
}
