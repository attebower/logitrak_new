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
import { StatusPill, effectiveStatus as sharedEffectiveStatus } from "@/components/shared/StatusPill";
import { locationChain } from "@/lib/format";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import type { ColumnDef } from "@/components/shared/ReportTable";
import type { ReportFilters } from "@/components/shared/ReportFilterBar";
import type { EquipmentDetail } from "@/components/shared/EquipmentDetailPanel";

// ── Tab definition ────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",    label: "Overview" },
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

const statusPill = (s: string, ds?: string) => (
  <StatusPill size="sm" status={sharedEffectiveStatus(s, ds ?? "normal")} />
);

const damagePill = (ds: string) => {
  if (!ds || ds === "normal") return <span className="text-[13px] text-grey">—</span>;
  const status = ds === "damaged" ? "damaged" : ds === "under_repair" ? "under_repair" : "repaired";
  return <StatusPill size="sm" status={status} />;
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
  { key: "damageStatus", label: "Status",      width: "w-36", render: (row) => damagePill(String(row.damageStatus ?? "")) },
  { key: "reportedBy",   label: "Reported By", width: "w-40" },
  { key: "reportedAt",   label: "Reported",    width: "w-28" },
];

const BY_LOCATION_COLS: ColumnDef[] = [
  { key: "serial",   label: "Serial",   width: "w-28" },
  { key: "name",     label: "Name",     width: "w-full" },
  { key: "status",   label: "Status",   width: "w-36", render: (row) => statusPill(String(row.status ?? ""), String(row.damageStatus ?? "normal")) },
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

function _EquipmentExpandedDetail({ row, workspaceId }: { row: Record<string, unknown>; workspaceId: string }) {
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
  const [activeTab, setActiveTab] = useState<TabId>("overview");
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
    type CEType = {id:string;eventType:string;createdAt:string;user?:{displayName?:string;email?:string};studio?:{name?:string};stage?:{name?:string};set?:{name?:string};positionType?:string;exactLocationDescription?:string;};
    const events = eq.checkEvents as unknown as CEType[];
    const latest = events[0];
    const isCurrentlyIssued = eq.status === "checked_out" && latest?.eventType === "check_out";
    const currentLocation = isCurrentlyIssued && latest
      ? locationChain([latest.studio?.name, latest.stage?.name, latest.set?.name, latest.positionType, latest.exactLocationDescription])
      : undefined;
    return {
      id:       eq.id,
      serial:   eq.serial,
      type:     eq.name,
      category: (eq.category as {name?: string} | null)?.name ?? "Uncategorised",
      status:   sharedEffectiveStatus(eq.status, eq.damageStatus),
      notes:    (eq.notes as string | null) ?? undefined,
      location: currentLocation,
      addedAt:  new Date(eq.createdAt).toISOString(),
      issuedAt: isCurrentlyIssued && latest ? new Date(latest.createdAt).toISOString() : null,
      checkHistory: events.map((ce) => ({
        id:        ce.id,
        type:      ce.eventType === "check_in" ? "in" as const : "out" as const,
        location:  locationChain([ce.studio?.name, ce.stage?.name, ce.set?.name, ce.positionType, ce.exactLocationDescription]),
        locationParts: {
          studio:   ce.studio?.name ?? null,
          stage:    ce.stage?.name ?? null,
          set:      ce.set?.name ?? null,
          position: ce.positionType ?? null,
          exact:    ce.exactLocationDescription ?? null,
        },
        checkedBy: ce.user?.displayName ?? ce.user?.email ?? "Unknown",
        timestamp: new Date(ce.createdAt).toISOString(),
      })),
      damageHistory: (eq.damageReports as unknown as {id:string;description?:string;reportedAt:string;reporter?:{displayName?:string;email?:string};repairLogs:{id:string;description?:string;repairedByName?:string;repairedAt?:string}[];}[]).map((dr) => ({
        id:          dr.id,
        description: dr.description ?? "",
        reportedBy:  dr.reporter?.displayName ?? dr.reporter?.email ?? "Unknown",
        timestamp:   new Date(dr.reportedAt).toISOString(),
        status:      (dr.repairLogs[0] ? "repaired" : "damaged") as "damaged" | "repaired",
        resolution:  dr.repairLogs[0]?.description,
        repairedBy:  dr.repairLogs[0]?.repairedByName,
        repairedAt:  dr.repairLogs[0]?.repairedAt ? new Date(dr.repairLogs[0].repairedAt).toISOString() : undefined,
      })),
    };
  }, [detailData]);

  // ── Overview tab (analytics) ──────────────────────────────────────────

  const { data: overviewData } = trpc.reports.wrapSummary.useQuery(
    { workspaceId },
    { enabled: activeTab === "overview" }
  );

  // ── Shared filter data ──────────────────────────────────────────────

  const { data: allCategories } = trpc.category.list.useQuery(
    { workspaceId },
    { enabled: activeTab !== "overview" }
  );
  const { data: allStudios } = trpc.location.studio.list.useQuery(
    { workspaceId },
    { enabled: activeTab !== "overview" }
  );

  const categoryOptions = (allCategories ?? []).map((c) => ({ value: c.id, label: c.name }));
  const locationOptions = (allStudios    ?? []).map((s) => ({ value: s.id, label: s.name }));
  const statusOptions = [
    { value: "available",    label: "Available" },
    { value: "issued",       label: "Issued" },
    { value: "damaged",      label: "Damaged" },
    { value: "under_repair", label: "Under Repair" },
    { value: "repaired",     label: "Repaired" },
    { value: "retired",      label: "Retired" },
  ];

  // Generic row filter — accepts rich rows with optional fields used for filtering
  function applyFilters<T extends { categoryId?: string; studioId?: string; rawDate?: Date | string | null; status?: string; damageStatus?: string }>(rows: T[]): T[] {
    return rows.filter((r) => {
      if (filters.status) {
        const f  = filters.status;
        const ds = r.damageStatus ?? "normal";
        const s  = r.status ?? "";
        const matches =
          (f === "available"    && s === "available"   && ds === "normal") ||
          (f === "issued"       && s === "checked_out" && ds === "normal") ||
          (f === "damaged"      && ds === "damaged") ||
          (f === "under_repair" && ds === "under_repair") ||
          (f === "repaired"     && ds === "repaired") ||
          (f === "retired"      && s === "retired");
        if (!matches) return false;
      }
      if (filters.locationId && r.studioId !== filters.locationId) return false;
      const f2 = filters as ReportFilters & { categoryId?: string };
      if (f2.categoryId && r.categoryId !== f2.categoryId) return false;
      if (filters.dateFrom || filters.dateTo) {
        if (!r.rawDate) return false;
        const d = new Date(r.rawDate).getTime();
        if (filters.dateFrom && d < new Date(filters.dateFrom).getTime())             return false;
        if (filters.dateTo   && d > new Date(filters.dateTo + "T23:59:59").getTime()) return false;
      }
      return true;
    });
  }

  // ── Checked Out tab ──────────────────────────────────────────────────

  const { data: checkedOutData } = trpc.reports.checkedOut.useQuery(
    { workspaceId },
    { enabled: activeTab === "checked-out" }
  );
  const checkedOutRows = applyFilters((checkedOutData ?? []).map((e) => {
    const evt = e.checkEvents[0];
    const loc = [evt?.studio?.name, evt?.stage?.name].filter(Boolean).join(" / ");
    return {
      id:           e.id,
      serial:       e.serial,
      name:         e.name,
      category:     e.category?.name ?? "—",
      categoryId:   e.categoryId ?? undefined,
      status:       e.status,
      damageStatus: e.damageStatus,
      studioId:     evt?.studioId ?? undefined,
      rawDate:      evt?.createdAt ?? null,
      location:     loc || "Unknown",
      checkedBy:    evt?.user?.displayName ?? "Unknown",
      since:        relTime(evt?.createdAt),
    };
  }));

  // ── Damaged tab ──────────────────────────────────────────────────────

  const { data: damagedData } = trpc.reports.damaged.useQuery(
    { workspaceId },
    { enabled: activeTab === "damaged" }
  );
  const damagedRows = applyFilters((damagedData ?? []).map((e) => {
    const report = e.damageReports[0];
    return {
      id:           e.id,
      serial:       e.serial,
      name:         e.name,
      status:       e.status,
      damageStatus: e.damageStatus,
      categoryId:   e.categoryId ?? undefined,
      rawDate:      report?.reportedAt ?? null,
      reportedBy:   report?.reporter?.displayName ?? "Unknown",
      reportedAt:   relTime(report?.reportedAt),
    };
  }));

  // ── By Location tab ──────────────────────────────────────────────────

  const [locationStudioId, setLocationStudioId] = useState("");

  const { data: byLocationData } = trpc.reports.byLocation.useQuery(
    { workspaceId, studioId: locationStudioId || undefined },
    { enabled: activeTab === "by-location" && !!locationStudioId }
  );

  const byLocationRows = applyFilters((byLocationData ?? []).map((e) => {
    const evt = e.checkEvents[0];
    const loc = [evt?.studio?.name, evt?.stage?.name, evt?.set?.name].filter(Boolean).join(" → ");
    return {
      id:           e.id,
      serial:       e.serial,
      name:         e.name,
      status:       e.status,
      damageStatus: e.damageStatus,
      categoryId:   e.categoryId ?? undefined,
      studioId:     evt?.studioId ?? undefined,
      rawDate:      evt?.createdAt ?? null,
      location:     loc || "—",
      since:        relTime(evt?.createdAt),
    };
  }));

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
    "overview":    { columns: [],                rows: [],              filename: "logitrak-overview.csv" },
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

      <div className="flex-1 overflow-hidden flex">
        {/* Sub-sidebar — report sections */}
        <aside className="w-[220px] shrink-0 bg-white border-r border-grey-mid overflow-y-auto">
          <nav className="py-4 px-3 space-y-6">
            <div>
              <div className="px-2 mb-1.5 text-[10px] font-semibold text-grey uppercase tracking-wider">
                Reports
              </div>
              <ul className="space-y-0.5">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <li key={tab.id}>
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        className={[
                          "w-full text-left px-2 py-1.5 rounded-btn text-[13px] transition-colors",
                          isActive
                            ? "bg-brand-blue/10 text-brand-blue font-semibold"
                            : "text-surface-dark hover:bg-grey-light",
                        ].join(" ")}
                      >
                        {tab.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
        </aside>

        {/* Content column */}
        <div className="flex-1 overflow-y-auto p-6 pt-5 space-y-4">
          {/* Universal filter bar — applies to all table tabs */}
          {activeTab !== "overview" && (
            <ReportFilterBar
              filters={filters}
              onChange={setFilters}
              showDateRange
              statusOptions={activeTab !== "damaged" ? statusOptions : undefined}
              categories={categoryOptions}
              locations={activeTab !== "by-location" ? locationOptions : undefined}
            />
          )}

          {/* By-location studio picker — this tab needs a studio selected to load data */}
          {activeTab === "by-location" && (
            <div className="bg-white rounded-card border border-grey-mid px-4 py-3 flex items-center gap-4">
              <label className="text-caption text-grey uppercase">Studio / Venue</label>
              <select
                value={locationStudioId}
                onChange={(e) => setLocationStudioId(e.target.value)}
                className="flex-1 max-w-xs bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
              >
                <option value="">Select a studio…</option>
                {(allStudios ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Overview tab — analytics stat cards */}
          {activeTab === "overview" && (
            <OverviewPanel data={overviewData} />
          )}

          {/* Table-based tabs */}
          {activeTab !== "overview" && (
            <ReportTable
              columns={columns}
              rows={rows}
              title={TABS.find((t) => t.id === activeTab)?.label ?? ""}
              onExport={() => downloadCsv(filename, rows, columns)}
              onRowClick={activeTab !== "activity" ? (row) => setDetailId(row.id as string) : undefined}
            />
          )}
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

// ── Overview panel (analytics) ────────────────────────────────

type OverviewData = {
  totalEquipment: number;
  checkedOut: number;
  damaged: number;
  underRepair: number;
  repaired: number;
  retiredCount: number;
  recentActivity: Array<{
    id: string;
    eventType: string;
    description?: string | null;
    createdAt: Date | string;
    actor?: { displayName?: string | null; email?: string | null } | null;
  }>;
};

function OverviewPanel({ data }: { data: OverviewData | undefined }) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-card border border-grey-mid h-24" />
        ))}
      </div>
    );
  }

  const total = data.totalEquipment || 1; // avoid div-by-zero
  const utilisationPct = Math.round((data.checkedOut / total) * 100);
  const damageRatePct  = Math.round(((data.damaged + data.underRepair) / total) * 100);
  const available = Math.max(0, total - data.checkedOut - data.damaged - data.underRepair);

  const stats = [
    { label: "Total Equipment", value: data.totalEquipment, sub: "active items",                 colour: "text-surface-dark" },
    { label: "Available",       value: available,           sub: "ready to issue",                colour: "text-status-green" },
    { label: "Issued",          value: data.checkedOut,     sub: `${utilisationPct}% utilisation`, colour: "text-status-amber" },
    { label: "Damaged",         value: data.damaged,        sub: `${damageRatePct}% damage rate`,  colour: "text-status-red" },
    { label: "Under Repair",    value: data.underRepair,    sub: "in workshop",                   colour: "text-status-amber" },
    { label: "Repaired",        value: data.repaired,       sub: "awaiting return",               colour: "text-status-teal" },
    { label: "Retired",         value: data.retiredCount,   sub: "decommissioned",                colour: "text-grey" },
    { label: "Utilisation",     value: `${utilisationPct}%`, sub: "of active fleet",              colour: "text-brand-blue" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-card border border-grey-mid p-4">
            <div className="text-caption text-grey uppercase tracking-wide">{s.label}</div>
            <div className={`text-[28px] font-semibold mt-1 ${s.colour}`}>{s.value}</div>
            <div className="text-[11px] text-grey mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-card border border-grey-mid">
        <div className="px-4 py-3 border-b border-grey-mid flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-surface-dark">Recent Activity</h3>
          <span className="text-[11px] text-grey">Last 10 events</span>
        </div>
        <div className="divide-y divide-grey-mid">
          {data.recentActivity.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-grey">No activity yet</div>
          ) : (
            data.recentActivity.map((ev) => (
              <div key={ev.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-[13px] text-surface-dark">
                    <span className="font-medium">{ev.actor?.displayName ?? ev.actor?.email ?? "System"}</span>
                    <span className="text-grey ml-1">{ev.eventType.replace(/_/g, " ")}</span>
                  </div>
                  {ev.description && (
                    <div className="text-[11px] text-grey mt-0.5">{ev.description}</div>
                  )}
                </div>
                <span className="text-[11px] text-grey whitespace-nowrap">
                  {new Date(ev.createdAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
