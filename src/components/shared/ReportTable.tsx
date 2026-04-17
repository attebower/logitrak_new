/**
 * LogiTrak ReportTable Component
 * Generic sortable/filterable table for report pages.
 * Columns are fully configurable via props — used for Available, Checked Out,
 * Damaged, Activity, and Location reports.
 *
 * Usage:
 *   <ReportTable
 *     columns={EQUIPMENT_COLS}
 *     rows={reportData}
 *     title="Available Equipment"
 *     onExport={() => downloadCsv(reportData)}
 *   />
 */

"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Column definition ─────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc";

export interface ColumnDef<T = Record<string, unknown>> {
  /** Column key — must match a key in the row data */
  key:       string;
  /** Header label */
  label:     string;
  /** Sortable (default: true) */
  sortable?: boolean;
  /** Custom cell renderer — receives the row and the raw cell value */
  render?:   (row: T, value: unknown) => React.ReactNode;
  /** Column width hint — Tailwind class e.g. "w-32" or "w-full" */
  width?:    string;
  /** Align cell content */
  align?:    "left" | "right" | "center";
}

// ── Component ─────────────────────────────────────────────────────────────

export interface ReportTableProps<T extends Record<string, unknown>> {
  columns:      ColumnDef<T>[];
  rows:         T[];
  title:        string;
  onExport?:    () => void;
  exportLabel?: string;
  emptyMessage?: string;
  className?:   string;
  /** Optional: render expanded detail row. Receives the row. */
  expandedContent?: (row: T) => React.ReactNode;
}

export function ReportTable<T extends Record<string, unknown>>({
  columns,
  rows,
  title,
  onExport,
  exportLabel = "Export CSV",
  emptyMessage = "No data to display",
  className,
  expandedContent,
}: ReportTableProps<T>) {
  const [sortKey, setSortKey]   = useState<string | null>(null);
  const [sortDir, setSortDir]   = useState<SortDirection>("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  return (
    <div className={cn("bg-white rounded-card border border-grey-mid overflow-hidden", className)}>
      {/* ── Table header bar ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-grey-mid">
        <span className="text-[12px] font-semibold text-grey uppercase tracking-wider">{title}</span>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-grey">
            {rows.length} {rows.length === 1 ? "result" : "results"}
          </span>
          {onExport && (
            <Button variant="secondary" size="sm" onClick={onExport}>
              ↓ {exportLabel}
            </Button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr>
              {expandedContent && <th className="w-6 bg-grey-light border-b border-grey-mid" />}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "bg-grey-light px-4 py-3 text-left border-b border-grey-mid whitespace-nowrap",
                    "text-[11px] text-grey uppercase tracking-wider font-semibold",
                    col.sortable !== false && "cursor-pointer select-none hover:text-surface-dark",
                    col.width,
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center"
                  )}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === "asc" ? "ascending" : "descending"
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && sortKey === col.key && (
                      <span aria-hidden>{sortDir === "asc" ? "↑" : "↓"}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-[13px] text-grey"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedRows.map((row, i) => {
                const rowId = (row.id as string) ?? String(i);
                const isExpanded = expandedId === rowId;
                return (
                  <>
                    <tr
                      key={rowId}
                      className={cn(
                        "border-b border-grey-mid last:border-b-0 transition-colors",
                        expandedContent ? "cursor-pointer hover:bg-grey-light/70" : "hover:bg-grey-light/70",
                        isExpanded && "bg-grey-light/50"
                      )}
                      onClick={() => expandedContent && setExpandedId(isExpanded ? null : rowId)}
                    >
                      {expandedContent && (
                        <td className="pl-3 pr-0 py-3 w-6">
                          {isExpanded
                            ? <ChevronDown size={14} className="text-grey" />
                            : <ChevronRight size={14} className="text-grey" />}
                        </td>
                      )}
                      {columns.map((col) => {
                        const value = row[col.key];
                        return (
                          <td
                            key={col.key}
                            className={cn(
                              "px-4 py-3 text-[13px] text-surface-dark",
                              col.key !== "name" && col.key !== "description" && col.key !== "location" && "whitespace-nowrap",
                              col.align === "right" && "text-right",
                              col.align === "center" && "text-center"
                            )}
                          >
                            {col.render ? col.render(row, value) : String(value ?? "—")}
                          </td>
                        );
                      })}
                    </tr>
                    {isExpanded && expandedContent && (
                      <tr key={`${rowId}-expanded`} className="border-b border-grey-mid bg-grey-light/30">
                        <td colSpan={columns.length + 1} className="px-6 py-4">
                          {expandedContent(row)}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
