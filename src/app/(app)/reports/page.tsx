"use client";

/**
 * Reports page — Sprint 3
 *
 * Tabs: Status | Checked Out | Damaged | By Location | Activity Log
 * Each tab: ReportFilterBar + ReportTable wired to trpc.reports.*
 * CSV export: downloads tRPC result as a CSV file client-side
 */

import { useState } from "react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { ReportTable } from "@/components/shared/ReportTable";
import { ReportFilterBar } from "@/components/shared/ReportFilterBar";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import type { ColumnDef } from "@/components/shared/ReportTable";
import type { ReportFilters } from "@/components/shared/ReportFilterBar";

// ── Tab definition ────────────────────────────────────────────────────────

const TABS = [
  { id: "status",      label: "Status" },
  { id: "checked-out", label: "Checked Out" },
  { id: "damaged",     label: "Damaged" },
  { id: "by-location", label: "By Location" },
  { id: "activity",    label: "Activity Log" },
] as const;

type TabId = typeof TABS[number]["id"];

// ── CSV export helper ─────────────────────────────────────────────────────

function downloadCsv(filename: string, rows: Record<string, unknown>[], columns: ColumnDef[]) {
  const headers = columns.map((c) => c.label).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => {
      const val = row[c.key];
      const str = val == null ? "" : String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(",")
  );
  const csv = [headers, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function relTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Column definitions ────────────────────────────────────────────────────

const STATUS_COLS: ColumnDef[] = [
  { key: "serial",       label: "Serial",   width: "w-28" },
  { key: "name",         label: "Name",     width: "w-full" },
  { key: "category",     label: "Category", width: "w-40",
    render: (row) => <span className="text-[13px] text-grey">{String(row.category ?? "—")}</span> },
  { key: "status",       label: "Status",   width: "w-36",
    render: (row) => {
      const s = String(row.status ?? "");
      const colour = s === "available" ? "text-status-green" : s === "checked_out" ? "text-status-amber" : "text-grey";
      return <span className={`text-[13px] font-medium ${colour}`}>{s.replace("_", " ")}</span>;
    }},
  { key: "damageStatus", label: "Damage",   width: "w-36",
    render: (row) => {
      const ds = String(row.damageStatus ?? "normal");
      if (ds === "normal") return <span className="text-[13px] text-grey">—</span>;
      const colour = ds === "damaged" ? "text-status-red" : ds === "under_repair" ? "text-status-amber" : "text-status-teal";
      return <span className={`text-[13px] font-medium ${colour}`}>{ds.replace("_", " ")}</span>;
    }},
];

const statusText = (s: string) => {
  const colour = s === "available" ? "text-status-green" : s === "checked_out" ? "text-status-amber" : "text-grey";
  return <span className={`text-[13px] font-medium ${colour}`}>{s.replace(/_/g, " ")}</span>;
};

const damageText = (ds: string) => {
  if (ds === "normal" || !ds) return <span className="text-[13px] text-grey">—</span>;
  const colour = ds === "damaged" ? "text-status-red" : ds === "under_repair" ? "text-status-amber" : "text-status-teal";
  return <span className={`text-[13px] font-medium ${colour}`}>{ds.replace(/_/g, " ")}</span>;
};

const categoryText = (c: string) => <span className="text-[13px] text-grey">{c || "—"}</span>;

const CHECKED_OUT_COLS: ColumnDef[] = [
  { key: "serial",    label: "Serial",         width: "w-28" },
  { key: "name",      label: "Name",           width: "w-full" },
  { key: "category",  label: "Category",       width: "w-40", render: (row) => categoryText(String(row.category ?? "")) },
  { key: "location",  label: "Location",       width: "w-48" },
  { key: "checkedBy", label: "Checked Out By",  width: "w-40" },
  { key: "since",     label: "Since",           width: "w-28" },
];

const DAMAGED_COLS: ColumnDef[] = [
  { key: "serial",       label: "Serial",      width: "w-28" },
  { key: "name",         label: "Name",        width: "w-full" },
  { key: "damageStatus", label: "Status",      width: "w-36", render: (row) => damageText(String(row.damageStatus ?? "")) },
  { key: "reportedBy",   label: "Reported By", width: "w-40" },
  { key: "reportedAt",   label: "Reported",    width: "w-28" },
];

const BY_LOCATION_COLS: ColumnDef[] = [
  { key: "serial",   label: "Serial",   width: "w-28" },
  { key: "name",     label: "Name",     width: "w-full" },
  { key: "status",   label: "Status",   width: "w-36", render: (row) => statusText(String(row.status ?? "")) },
  { key: "location", label: "Location", width: "w-48" },
  { key: "since",    label: "Since",    width: "w-28" },
];

const ACTIVITY_COLS: ColumnDef[] = [
  { key: "time",      label: "Time",      width: "w-28" },
  { key: "actor",     label: "User",      width: "w-40" },
  { key: "eventType", label: "Event",     width: "w-40" },
  { key: "entity",    label: "Equipment", width: "w-full" },
];

// ── Component ─────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { workspaceId } = useWorkspace();
  const [activeTab, setActiveTab] = useState<TabId>("status");
  const [filters, setFilters] = useState<ReportFilters>({});

  // ── Status tab ───────────────────────────────────────────────────────

  const { data: statusData } = trpc.reports.equipmentStatus.useQuery(
    { workspaceId, limit: 200 },
    { enabled: activeTab === "status" }
  );
  const statusRows = (statusData?.items ?? []).map((e) => ({
    id:          e.id,
    serial:      e.serial,
    name:        e.name,
    category:    e.category?.name ?? "—",
    status:      e.status,
    damageStatus: e.damageStatus,
  }));

  // ── Checked Out tab ──────────────────────────────────────────────────

  const { data: checkedOutData } = trpc.reports.checkedOut.useQuery(
    { workspaceId },
    { enabled: activeTab === "checked-out" }
  );
  const checkedOutRows = (checkedOutData ?? []).map((e) => {
    const evt = e.checkEvents[0];
    const loc = [evt?.studio?.name, evt?.stage?.name].filter(Boolean).join(" / ");
    return {
      id:         e.id,
      serial:     e.serial,
      name:       e.name,
      category:   e.category?.name ?? "—",
      location:   loc || "Unknown",
      checkedBy:  evt?.user?.displayName ?? "Unknown",
      since:      relTime(evt?.createdAt),
    };
  });

  // ── Damaged tab ──────────────────────────────────────────────────────

  const { data: damagedData } = trpc.reports.damaged.useQuery(
    { workspaceId },
    { enabled: activeTab === "damaged" }
  );
  const damagedRows = (damagedData ?? []).map((e) => {
    const report = e.damageReports[0];
    return {
      id:           e.id,
      serial:       e.serial,
      name:         e.name,
      damageStatus: e.damageStatus,
      reportedBy:   report?.reporter?.displayName ?? "Unknown",
      reportedAt:   relTime(report?.reportedAt),
    };
  });

  // ── By Location tab ──────────────────────────────────────────────────

  const { data: studios } = trpc.location.studio.list.useQuery(
    { workspaceId },
    { enabled: activeTab === "by-location" }
  );

  const [locationStudioId, setLocationStudioId] = useState("");

  const { data: byLocationData } = trpc.reports.byLocation.useQuery(
    { workspaceId, studioId: locationStudioId || undefined },
    { enabled: activeTab === "by-location" && !!locationStudioId }
  );

  const byLocationRows = (byLocationData ?? []).map((e) => {
    const evt = e.checkEvents[0];
    const loc = [evt?.studio?.name, evt?.stage?.name, evt?.set?.name].filter(Boolean).join(" → ");
    return {
      id:       e.id,
      serial:   e.serial,
      name:     e.name,
      location: loc || "—",
      since:    relTime(evt?.createdAt),
    };
  });

  // ── Activity Log tab ─────────────────────────────────────────────────

  const { data: activityData } = trpc.reports.activityLog.useQuery(
    {
      workspaceId,
      startDate: filters.dateFrom,
      endDate:   filters.dateTo,
      limit:     100,
    },
    { enabled: activeTab === "activity" }
  );
  const activityRows = (activityData?.items ?? []).map((e) => ({
    id:        e.id,
    time:      relTime(e.createdAt),
    actor:     e.actor?.displayName ?? e.actor?.email ?? "System",
    eventType: e.eventType.replace(/_/g, " "),
    entity:    e.entityType === "equipment" ? e.entityId : "—",
  }));

  // ── Active tab data / columns ─────────────────────────────────────────

  const tabConfig: Record<TabId, { columns: ColumnDef[]; rows: Record<string, unknown>[]; filename: string }> = {
    "status":      { columns: STATUS_COLS,      rows: statusRows,      filename: "logitrak-status.csv" },
    "checked-out": { columns: CHECKED_OUT_COLS, rows: checkedOutRows,  filename: "logitrak-checked-out.csv" },
    "damaged":     { columns: DAMAGED_COLS,     rows: damagedRows,     filename: "logitrak-damaged.csv" },
    "by-location": { columns: BY_LOCATION_COLS, rows: byLocationRows,  filename: "logitrak-by-location.csv" },
    "activity":    { columns: ACTIVITY_COLS,    rows: activityRows,    filename: "logitrak-activity.csv" },
  };

  const { columns, rows, filename } = tabConfig[activeTab];

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar title="Reports" />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Tab bar */}
        <div className="bg-white border-b border-grey-mid px-6 flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "px-4 py-3.5 text-[13px] font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-brand-blue text-brand-blue"
                  : "border-transparent text-grey hover:text-surface-dark",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-5 space-y-4">
          {/* Filter bar — date range on all tabs; location on activity */}
          {activeTab === "activity" && (
            <ReportFilterBar
              filters={filters}
              onChange={setFilters}
              showDateRange
            />
          )}

          {/* By-location studio picker */}
          {activeTab === "by-location" && (
            <div className="bg-white rounded-card border border-grey-mid px-4 py-3 flex items-center gap-4">
              <label className="text-caption text-grey uppercase">Studio / Venue</label>
              <select
                value={locationStudioId}
                onChange={(e) => setLocationStudioId(e.target.value)}
                className="flex-1 max-w-xs bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
              >
                <option value="">Select a studio…</option>
                {(studios ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <ReportTable
            columns={columns}
            rows={rows}
            title={TABS.find((t) => t.id === activeTab)?.label ?? ""}
            onExport={() => downloadCsv(filename, rows, columns)}
          />
        </div>
      </div>
    </>
  );
}
