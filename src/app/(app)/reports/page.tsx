"use client";

/**
 * Reports page — Sprint 3
 *
 * Tabs: Overview | Checked Out | Damaged | By Location
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
import { downloadReportPdf } from "@/lib/pdf/ReportPdf";
import type { ColumnDef } from "@/components/shared/ReportTable";
import type { ReportPdfColumn } from "@/lib/pdf/ReportPdf";
import type { ReportFilters } from "@/components/shared/ReportFilterBar";
import type { EquipmentDetail } from "@/components/shared/EquipmentDetailPanel";

// ── Tab definition ────────────────────────────────────────────────────────

type TabId =
  | "available" | "issued"
  | "by-studio" | "by-stage" | "by-set" | "by-on-location"
  | "damaged"   | "repaired"
  | "custom";

interface TabItem { id: TabId; label: string }
interface TabGroup { label: string; items: TabItem[] }

const TAB_GROUPS: TabGroup[] = [
  {
    label: "Status",
    items: [
      { id: "available", label: "Available" },
      { id: "issued",    label: "Issued" },
    ],
  },
  {
    label: "Location",
    items: [
      { id: "by-studio",      label: "By Studio" },
      { id: "by-stage",       label: "By Stage" },
      { id: "by-set",         label: "By Set" },
      { id: "by-on-location", label: "By Location" },
    ],
  },
  {
    label: "Damage",
    items: [
      { id: "damaged",  label: "Damaged" },
      { id: "repaired", label: "Repaired" },
    ],
  },
  {
    label: "Custom",
    items: [
      { id: "custom", label: "Custom Report" },
    ],
  },
];

const TABS: TabItem[] = TAB_GROUPS.flatMap((g) => g.items);

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

const STANDARD_COLS: ColumnDef[] = [
  { key: "serial",   label: "Serial",   width: "w-28" },
  { key: "name",     label: "Name",     width: "w-full" },
  { key: "category", label: "Category", width: "w-40", render: (row) => categoryText(String(row.category ?? "")) },
  { key: "status",   label: "Status",   width: "w-36", render: (row) => statusPill(String(row.status ?? ""), String(row.damageStatus ?? "normal")) },
  { key: "added",    label: "Added",    width: "w-32" },
];

const ISSUED_COLS: ColumnDef[] = [
  { key: "serial",    label: "Serial",         width: "w-28" },
  { key: "name",      label: "Name",           width: "w-full" },
  { key: "category",  label: "Category",       width: "w-40", render: (row) => categoryText(String(row.category ?? "")) },
  { key: "location",  label: "Location",       width: "w-48" },
  { key: "checkedBy", label: "Checked Out By", width: "w-40" },
  { key: "since",     label: "Since",          width: "w-28" },
];

const DAMAGED_COLS: ColumnDef[] = [
  { key: "serial",       label: "Serial",      width: "w-28" },
  { key: "name",         label: "Name",        width: "w-full" },
  { key: "damageStatus", label: "Status",      width: "w-36", render: (row) => damagePill(String(row.damageStatus ?? "")) },
  { key: "reportedBy",   label: "Reported By", width: "w-40" },
  { key: "reportedAt",   label: "Reported",    width: "w-28" },
];

const LOCATION_COLS: ColumnDef[] = [
  { key: "serial",   label: "Serial",   width: "w-28" },
  { key: "name",     label: "Name",     width: "w-full" },
  { key: "status",   label: "Status",   width: "w-36", render: (row) => statusPill(String(row.status ?? ""), String(row.damageStatus ?? "normal")) },
  { key: "location", label: "Location", width: "w-48" },
  { key: "since",    label: "Since",    width: "w-28" },
];

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

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
  const { workspaceId, workspaceName } = useWorkspace();
  const { data: me } = trpc.user.me.useQuery();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("available");
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
    type CEType = {id:string;eventType:string;createdAt:string;user?:{displayName?:string;email?:string};studio?:{name?:string};stage?:{name?:string};set?:{name?:string};onLocation?:{name?:string};positionType?:string;exactLocationDescription?:string;};
    const events = eq.checkEvents as unknown as CEType[];
    const latest = events[0];
    const isCurrentlyIssued = eq.status === "checked_out" && latest?.eventType === "check_out";
    const currentLocation = isCurrentlyIssued && latest
      ? {
          studio:     latest.studio?.name ?? null,
          stage:      latest.stage?.name ?? null,
          set:        latest.set?.name ?? null,
          onLocation: latest.onLocation?.name ?? null,
          position:   latest.positionType ?? null,
          exact:      latest.exactLocationDescription ?? null,
        }
      : null;
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
        locationParts: {
          studio:     ce.studio?.name ?? null,
          stage:      ce.stage?.name ?? null,
          set:        ce.set?.name ?? null,
          onLocation: ce.onLocation?.name ?? null,
          position:   ce.positionType ?? null,
          exact:      ce.exactLocationDescription ?? null,
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

  // ── Overview (always loaded, shown statically at top) ────────────────

  const { data: overviewData } = trpc.reports.wrapSummary.useQuery(
    { workspaceId },
  );

  // ── Shared filter data ──────────────────────────────────────────────

  const { data: allCategories } = trpc.category.list.useQuery({ workspaceId });
  const { data: allStudios }    = trpc.location.studio.list.useQuery({ workspaceId });

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

  // ── Status: Available ────────────────────────────────────────────────

  const { data: availableData } = trpc.reports.equipmentStatus.useQuery(
    { workspaceId, status: "available", damageStatus: "normal", limit: 200 },
    { enabled: activeTab === "available" }
  );
  const availableRows = applyFilters((availableData?.items ?? []).map((e) => ({
    id:           e.id,
    serial:       e.serial,
    name:         e.name,
    category:     e.category?.name ?? "—",
    categoryId:   e.categoryId ?? undefined,
    status:       e.status,
    damageStatus: e.damageStatus,
    rawDate:      e.createdAt,
    added:        formatDate(e.createdAt),
  })));

  // ── Status: Issued ───────────────────────────────────────────────────

  const { data: issuedData } = trpc.reports.checkedOut.useQuery(
    { workspaceId },
    { enabled: activeTab === "issued" }
  );
  const issuedRows = applyFilters((issuedData ?? []).map((e) => {
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

  // ── Location: shared state + data ────────────────────────────────────

  const [locationStudioId,     setLocationStudioId]     = useState("");
  const [locationStageId,      setLocationStageId]      = useState("");
  const [locationSetId,        setLocationSetId]        = useState("");
  const [locationOnLocationId, setLocationOnLocationId] = useState("");

  const { data: stagesForStudio } = trpc.location.stage.list.useQuery(
    { workspaceId, studioId: locationStudioId },
    { enabled: !!locationStudioId && (activeTab === "by-stage" || activeTab === "by-set") }
  );
  const { data: setsForStage } = trpc.location.set.list.useQuery(
    { workspaceId, stageId: locationStageId },
    { enabled: !!locationStageId && activeTab === "by-set" }
  );
  const { data: onLocations } = trpc.location.onLocation.list.useQuery(
    { workspaceId },
    { enabled: activeTab === "by-on-location" }
  );

  const locationFilterInput = (() => {
    if (activeTab === "by-studio"      && locationStudioId)     return { studioId:     locationStudioId };
    if (activeTab === "by-stage"       && locationStageId)      return { stageId:      locationStageId };
    if (activeTab === "by-set"         && locationSetId)        return { setId:        locationSetId };
    if (activeTab === "by-on-location" && locationOnLocationId) return { onLocationId: locationOnLocationId };
    return null;
  })();

  const { data: locationData } = trpc.reports.byLocation.useQuery(
    { workspaceId, ...(locationFilterInput ?? {}) },
    { enabled: !!locationFilterInput }
  );

  const locationRows = applyFilters((locationData ?? []).map((e) => {
    const evt = e.checkEvents[0];
    const loc = evt?.onLocation?.name
      ? evt.onLocation.name + (evt?.set?.name ? ` → ${evt.set.name}` : "")
      : [evt?.studio?.name, evt?.stage?.name, evt?.set?.name].filter(Boolean).join(" → ");
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

  // ── Damage: Damaged ──────────────────────────────────────────────────

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

  // ── Damage: Repaired ─────────────────────────────────────────────────

  const { data: repairedData } = trpc.reports.equipmentStatus.useQuery(
    { workspaceId, damageStatus: "repaired", limit: 200 },
    { enabled: activeTab === "repaired" }
  );
  const repairedRows = applyFilters((repairedData?.items ?? []).map((e) => ({
    id:           e.id,
    serial:       e.serial,
    name:         e.name,
    category:     e.category?.name ?? "—",
    categoryId:   e.categoryId ?? undefined,
    status:       e.status,
    damageStatus: e.damageStatus,
    rawDate:      e.updatedAt,
    added:        formatDate(e.updatedAt),
  })));

  // ── Custom: full filter over all equipment ───────────────────────────

  const { data: customData } = trpc.reports.equipmentStatus.useQuery(
    { workspaceId, limit: 200 },
    { enabled: activeTab === "custom" }
  );
  const customRows = applyFilters((customData?.items ?? []).map((e) => ({
    id:           e.id,
    serial:       e.serial,
    name:         e.name,
    category:     e.category?.name ?? "—",
    categoryId:   e.categoryId ?? undefined,
    status:       e.status,
    damageStatus: e.damageStatus,
    rawDate:      e.createdAt,
    added:        formatDate(e.createdAt),
  })));

  // ── Active tab data / columns ─────────────────────────────────────────

  const tabConfig: Record<TabId, { columns: ColumnDef[]; rows: Record<string, unknown>[]; filename: string }> = {
    "available":       { columns: STANDARD_COLS, rows: availableRows, filename: "logitrak-available.csv" },
    "issued":          { columns: ISSUED_COLS,   rows: issuedRows,    filename: "logitrak-issued.csv" },
    "by-studio":       { columns: LOCATION_COLS, rows: locationRows,  filename: "logitrak-by-studio.csv" },
    "by-stage":        { columns: LOCATION_COLS, rows: locationRows,  filename: "logitrak-by-stage.csv" },
    "by-set":          { columns: LOCATION_COLS, rows: locationRows,  filename: "logitrak-by-set.csv" },
    "by-on-location":  { columns: LOCATION_COLS, rows: locationRows,  filename: "logitrak-by-location.csv" },
    "damaged":         { columns: DAMAGED_COLS,  rows: damagedRows,   filename: "logitrak-damaged.csv" },
    "repaired":        { columns: STANDARD_COLS, rows: repairedRows,  filename: "logitrak-repaired.csv" },
    "custom":          { columns: STANDARD_COLS, rows: customRows,    filename: "logitrak-custom.csv" },
  };

  const { columns, rows, filename } = tabConfig[activeTab];

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar title="Reports" />

      <div className="flex-1 overflow-y-auto">
        {/* Static overview — always visible at top */}
        <div className="p-6">
          <OverviewPanel data={overviewData} />
        </div>

        {/* Report selector + table area */}
        <div className="flex">
          {/* Sub-sidebar — report sections */}
          <aside className="w-[220px] shrink-0 bg-white border-r border-t border-grey-mid">
            <nav className="py-4 px-3 space-y-6">
              {TAB_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="px-2 mb-1.5 text-[10px] font-semibold text-grey uppercase tracking-wider">
                    {group.label}
                  </div>
                  <ul className="space-y-0.5">
                    {group.items.map((tab) => {
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
              ))}
            </nav>
          </aside>

          {/* Content column */}
          <div className="flex-1 p-6 pt-5 space-y-4 border-t border-grey-mid">
            <ReportFilterBar
              filters={filters}
              onChange={setFilters}
              showDateRange
              statusOptions={activeTab === "custom" ? statusOptions : undefined}
              categories={categoryOptions}
              locations={activeTab === "custom" ? locationOptions : undefined}
            />

            {/* Location pickers — cascading studio → stage → set, or flat on-location */}
            {(activeTab === "by-studio" || activeTab === "by-stage" || activeTab === "by-set") && (
              <div className="bg-white rounded-card border border-grey-mid px-4 py-3 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-caption text-grey uppercase">Studio</label>
                  <select
                    value={locationStudioId}
                    onChange={(e) => { setLocationStudioId(e.target.value); setLocationStageId(""); setLocationSetId(""); }}
                    className="bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue min-w-[180px]"
                  >
                    <option value="">Select a studio…</option>
                    {(allStudios ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {(activeTab === "by-stage" || activeTab === "by-set") && (
                  <div className="flex items-center gap-2">
                    <label className="text-caption text-grey uppercase">Stage</label>
                    <select
                      value={locationStageId}
                      onChange={(e) => { setLocationStageId(e.target.value); setLocationSetId(""); }}
                      disabled={!locationStudioId}
                      className="bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue min-w-[180px] disabled:opacity-50"
                    >
                      <option value="">Select a stage…</option>
                      {(stagesForStudio ?? []).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {activeTab === "by-set" && (
                  <div className="flex items-center gap-2">
                    <label className="text-caption text-grey uppercase">Set</label>
                    <select
                      value={locationSetId}
                      onChange={(e) => setLocationSetId(e.target.value)}
                      disabled={!locationStageId}
                      className="bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue min-w-[180px] disabled:opacity-50"
                    >
                      <option value="">Select a set…</option>
                      {(setsForStage ?? []).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {activeTab === "by-on-location" && (
              <div className="bg-white rounded-card border border-grey-mid px-4 py-3 flex items-center gap-4">
                <label className="text-caption text-grey uppercase">On Location</label>
                <select
                  value={locationOnLocationId}
                  onChange={(e) => setLocationOnLocationId(e.target.value)}
                  className="flex-1 max-w-xs bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
                >
                  <option value="">Select a venue…</option>
                  {(onLocations ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}{o.project?.name ? ` · ${o.project.name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <ReportTable
              columns={columns}
              rows={rows}
              title={TABS.find((t) => t.id === activeTab)?.label ?? ""}
              onExport={() => downloadCsv(filename, rows, columns)}
              onExportPdf={() => {
                const tabLabel = TABS.find((t) => t.id === activeTab)?.label ?? "Report";
                const pdfColumns: ReportPdfColumn[] = columns.map((c) => ({ key: c.key, label: c.label }));
                void downloadReportPdf(
                  {
                    title:         `${tabLabel} Report`,
                    subtitle:      workspaceName,
                    meta:          [{ label: "Rows", value: String(rows.length) }],
                    workspaceName,
                    generatedBy:   me?.displayName ?? me?.email ?? "Unknown",
                    generatedAt:   new Date(),
                    columns:       pdfColumns,
                    rows,
                  },
                  filename.replace(/\.csv$/, ".pdf"),
                );
              }}
              onRowClick={(row) => setDetailId(row.id as string)}
            />
          </div>
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
};

function OverviewPanel({ data }: { data: OverviewData | undefined }) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-card border border-grey-mid h-16" />
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
    { label: "Issued",          value: data.checkedOut,     sub: `${utilisationPct}% utilisation`, colour: "text-brand-blue" },
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
          <div key={s.label} className="bg-white rounded-card border border-grey-mid px-3 py-2">
            <div className="text-[10px] font-semibold text-grey uppercase tracking-wide">{s.label}</div>
            <div className={`text-[20px] font-semibold leading-tight ${s.colour}`}>{s.value}</div>
            <div className="text-[10px] text-grey">{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
