"use client";

/**
 * Reports page — Sprint 3
 *
 * Tabs: Status | Checked Out | Damaged | By Location | Activity Log
 * Each tab: ReportFilterBar + ReportTable wired to trpc.reports.*
 * CSV export: downloads tRPC result as a CSV file client-side
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { ReportTable } from "@/components/shared/ReportTable";
import { ReportFilterBar } from "@/components/shared/ReportFilterBar";
import { EquipmentDetailPanel } from "@/components/shared/EquipmentDetailPanel";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import type { ColumnDef } from "@/components/shared/ReportTable";
import type { ReportFilters } from "@/components/shared/ReportFilterBar";
import type { EquipmentDetail } from "@/components/shared/EquipmentDetailPanel";

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


// -- Equipment expanded detail --

function EquipmentExpandedDetail({ row, workspaceId }: { row: Record<string, unknown>; workspaceId: string }) {
  const equipmentId = row.id as string;
  const { data, isLoading } = trpc.equipment.getDetail.useQuery(
    { workspaceId, equipmentId },
    { enabled: !!equipmentId }
  );

  if (isLoading) return <p className="text-[12px] text-grey py-2">Loading...</p>;
  if (!data) return <p className="text-[12px] text-grey py-2">No details available.</p>;

  const isCheckedOut = data.status === "checked_out";

  type CheckEvent = { id: string; eventType: string; createdAt: string; user?: { displayName?: string }; studio?: { name?: string }; stage?: { name?: string }; set?: { name?: string }; positionType?: string; exactLocationDescription?: string };
  type DamageReport = { id: string; damageDescription?: string; damageLocation?: string; reportedAt: string; reporter?: { displayName?: string }; repairLogs: { id: string; description?: string; repairedByName?: string; repairLocation?: string; repairedAt?: string }[] };

  const lastCheckOut = (data.checkEvents as unknown as CheckEvent[]).find((e) => e.eventType === "check_out");

  function fmt(d: Date | string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function duration(from: Date | string | null | undefined) {
    if (!from) return "—";
    const ms = Date.now() - new Date(from).getTime();
    const days = Math.floor(ms / 86400000);
    const hrs = Math.floor((ms % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hrs}h`;
    return `${hrs}h`;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[12px]">

      {/* Current status */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-grey uppercase tracking-wider">Current Status</p>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-grey">Status</span>
            <span className={`font-medium ${isCheckedOut ? "text-status-amber" : data.status === "available" ? "text-status-green" : "text-status-red"}`}>
              {data.status.replace(/_/g, " ")}
            </span>
          </div>
          {isCheckedOut && lastCheckOut && (
            <>
              <div className="flex justify-between"><span className="text-grey">Checked out by</span><span className="font-medium text-surface-dark">{lastCheckOut.user?.displayName ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-grey">Out since</span><span className="text-surface-dark">{fmt(lastCheckOut.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-grey">Duration</span><span className="font-medium text-surface-dark">{duration(lastCheckOut.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-grey">Location</span>
                <span className="text-surface-dark text-right max-w-[180px]">
                  {[lastCheckOut.studio?.name, lastCheckOut.stage?.name, lastCheckOut.set?.name, lastCheckOut.positionType, lastCheckOut.exactLocationDescription].filter(Boolean).join(" → ") || "—"}
                </span>
              </div>
            </>
          )}
          <div className="flex justify-between"><span className="text-grey">Added</span><span className="text-surface-dark">{fmt(data.createdAt)}</span></div>
          {data.category && <div className="flex justify-between"><span className="text-grey">Category</span><span className="text-surface-dark">{data.category.name}</span></div>}
        </div>
      </div>

      {/* Checkout history */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-grey uppercase tracking-wider">Checkout History</p>
        {data.checkEvents.length === 0
          ? <p className="text-grey">Never checked out.</p>
          : <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {(data.checkEvents as unknown as CheckEvent[]).slice(0, 10).map((ev) => (
                <div key={ev.id} className="border-l-2 pl-3 py-0.5 space-y-0.5"
                  style={{ borderColor: ev.eventType === "check_out" ? "#D97706" : "#16A34A" }}>
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${ev.eventType === "check_out" ? "text-status-amber" : "text-status-green"}`}>
                      {ev.eventType === "check_out" ? "Checked out" : "Checked in"}
                    </span>
                    <span className="text-grey">{fmt(ev.createdAt)}</span>
                  </div>
                  {ev.eventType === "check_out" && (
                    <p className="text-grey">
                      {ev.user?.displayName ?? "Unknown"}
                      {[ev.studio?.name, ev.stage?.name, ev.set?.name].filter(Boolean).length > 0
                        ? " — " + [ev.studio?.name, ev.stage?.name, ev.set?.name].filter(Boolean).join(" → ")
                        : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
        }
      </div>

      {/* Damage & repair */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-grey uppercase tracking-wider">Damage & Repair</p>
        {data.damageReports.length === 0
          ? <p className="text-grey">No damage reported.</p>
          : <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
              {(data.damageReports as unknown as DamageReport[]).map((dr) => (
                <div key={dr.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-status-red">Damage</span>
                    <span className="text-grey">{fmt(dr.reportedAt)}</span>
                  </div>
                  <p className="text-surface-dark">{dr.damageDescription ?? "—"}</p>
                  <p className="text-grey">By {dr.reporter?.displayName ?? "Unknown"}{dr.damageLocation ? " — " + dr.damageLocation : ""}</p>
                  {dr.repairLogs.map((rl) => (
                    <div key={rl.id} className="pl-3 border-l-2 border-status-teal mt-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-status-teal">Repaired</span>
                        <span className="text-grey">{fmt(rl.repairedAt)}</span>
                      </div>
                      <p className="text-surface-dark">{rl.description ?? "—"}</p>
                      <p className="text-grey">By {rl.repairedByName ?? "Unknown"}{rl.repairLocation ? " — " + rl.repairLocation : ""}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
        }
      </div>

    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("status");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [detailId, setDetailId] = useState<string | null>(null);

  // Fetch full detail for drawer
  const { data: detailData } = trpc.equipment.getDetail.useQuery(
    { workspaceId, equipmentId: detailId! },
    { enabled: !!detailId }
  );

  const detail: EquipmentDetail | null = useMemo(() => {
    if (!detailData) return null;
    const eq = detailData;
    const mapStatus = (s: string) => s === "available" ? "available" : s === "checked_out" ? "checked-out" : "retired";
    const mapDmg = (d: string) => d === "damaged" ? "damaged" : d === "under_repair" ? "damaged" : d === "repaired" ? "available" : null;
    // Find the most recent check-out event for current location
      type CEType = {id:string;eventType:string;createdAt:string;user?:{displayName?:string;email?:string};studio?:{name?:string};stage?:{name?:string};set?:{name?:string};positionType?:string;exactLocationDescription?:string;};
      const events = eq.checkEvents as unknown as CEType[];
      const lastOut = events.find((e) => e.eventType === "check_out");
      const currentLocation = lastOut
        ? [lastOut.studio?.name, lastOut.stage?.name, lastOut.set?.name, lastOut.positionType, lastOut.exactLocationDescription].filter(Boolean).join(" → ")
        : undefined;
      return {
      id:       eq.id,
      serial:   eq.serial,
      type:     eq.name,
      category: (eq.category as {name?: string} | null)?.name ?? "Uncategorised",
      status:   (mapDmg(eq.damageStatus) ?? mapStatus(eq.status)) as EquipmentDetail["status"],
      notes:    (eq.notes as string | null) ?? undefined,
      location: currentLocation,
      addedAt:  new Date(eq.createdAt).toISOString(),
      checkHistory: events.map((ce) => ({
        id:        ce.id,
        type:      ce.eventType === "check_in" ? "in" as const : "out" as const,
        location:  [ce.studio?.name, ce.stage?.name, ce.set?.name].filter(Boolean).join(" → "),
        checkedBy: ce.user?.displayName ?? ce.user?.email ?? "Unknown",
        timestamp: new Date(ce.createdAt).toISOString(),
      })),
      damageHistory: (eq.damageReports as unknown as {id:string;damageDescription?:string;reportedAt:string;reporter?:{displayName?:string;email?:string};repairLogs:{id:string;description?:string;repairedByName?:string;repairedAt?:string}[];}[]).map((dr) => ({
        id:          dr.id,
        description: dr.damageDescription ?? "",
        reportedBy:  dr.reporter?.displayName ?? dr.reporter?.email ?? "Unknown",
        timestamp:   new Date(dr.reportedAt).toISOString(),
        status:      "damaged" as const,
        resolution:  dr.repairLogs[0]?.description,
        repairedBy:  dr.repairLogs[0]?.repairedByName,
        repairedAt:  dr.repairLogs[0]?.repairedAt ? new Date(dr.repairLogs[0].repairedAt).toISOString() : undefined,
      })),
    };
  }, [detailData]);

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
            onRowClick={activeTab !== "activity" ? (row) => setDetailId(row.id as string) : undefined}
          />
        </div>
      </div>

      {/* Equipment detail drawer */}
      <EquipmentDetailPanel
        equipment={detail}
        isOpen={!!detailId}
        onClose={() => setDetailId(null)}
        onReportDamage={() => {
          if (detailId) router.push(`/damage?equipmentId=${detailId}`);
          setDetailId(null);
        }}
      />
    </>
  );
}
