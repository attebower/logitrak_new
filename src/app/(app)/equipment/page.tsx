"use client";

/**
 * Equipment Register — wired to live tRPC data.
 *
 * trpc.equipment.list   → table (search, status filter, pagination)
 * trpc.equipment.create → add equipment form
 * trpc.equipment.get    → detail panel (check history, damage history)
 * trpc.category.list    → category filter dropdown
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { ReportTable } from "@/components/shared/ReportTable";
import { EquipmentDetailPanel } from "@/components/shared/EquipmentDetailPanel";
import { StatusPill, effectiveStatus } from "@/components/shared/StatusPill";
import { locationChain } from "@/lib/format";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { CsvImportModal } from "@/components/shared/CsvImportModal";
import type { ImportResult } from "@/components/shared/CsvImportModal";
import type { ColumnDef } from "@/components/shared/ReportTable";
import type { EquipmentDetail } from "@/components/shared/EquipmentDetailPanel";

// ── Column definitions (matches reports page style) ───────────────────────

const EQUIPMENT_COLS: ColumnDef[] = [
  { key: "serial",   label: "Serial",   width: "w-28" },
  { key: "name",     label: "Name",     width: "w-full" },
  { key: "category", label: "Category", width: "w-40",
    render: (row) => <span className="text-[13px] text-grey">{String(row.category ?? "—")}</span> },
  { key: "status",   label: "Status",   width: "w-36",
    render: (row) => <StatusPill size="sm" status={effectiveStatus(String(row.status ?? ""), String(row.damageStatus ?? "normal"))} /> },
];

type StatusFilter = "all" | "available" | "issued" | "damaged" | "under_repair" | "repaired" | "retired";

const FILTER_TABS: { id: StatusFilter; label: string }[] = [
  { id: "all",          label: "All"          },
  { id: "available",    label: "Available"    },
  { id: "issued",       label: "Issued"       },
  { id: "damaged",      label: "Damaged"      },
  { id: "under_repair", label: "Under Repair" },
  { id: "repaired",     label: "Repaired"     },
  { id: "retired",      label: "Retired"      },
];

export default function EquipmentPage() {
  const { workspaceId } = useWorkspace();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIds] = useState<Set<string>>(new Set());
  const [detailId,     setDetailId]    = useState<string | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const router = useRouter();

  // ── Queries ─────────────────────────────────────────────────────────────

  const { data: listData, isLoading, refetch } = trpc.equipment.list.useQuery({
    workspaceId,
    search: search || undefined,
    limit: 100,
    offset: 0,
  });

  const { data: detailData } = trpc.equipment.getDetail.useQuery(
    { workspaceId, equipmentId: detailId! },
    { enabled: !!detailId }
  );

  // ── Mutations ────────────────────────────────────────────────────────────

  const importCsv = trpc.equipment.importCsv.useMutation();

  // ── Derived data ─────────────────────────────────────────────────────────

  const items = useMemo(() => {
    if (!listData?.items) return [];
    const mapped = listData.items.map((eq) => ({
      id:           eq.id,
      serial:       eq.serial,
      name:         eq.name,
      category:     eq.category?.name ?? "Uncategorised",
      status:       eq.status,
      damageStatus: eq.damageStatus,
    }));
    if (statusFilter === "all") return mapped;
    return mapped.filter((r) => {
      const ds = r.damageStatus;
      const s  = r.status;
      if (statusFilter === "available")    return s === "available" && (!ds || ds === "normal");
      if (statusFilter === "issued")       return s === "checked_out" && (!ds || ds === "normal");
      if (statusFilter === "damaged")      return ds === "damaged";
      if (statusFilter === "under_repair") return ds === "under_repair";
      if (statusFilter === "repaired")     return ds === "repaired";
      if (statusFilter === "retired")      return s === "retired";
      return true;
    });
  }, [listData, statusFilter]);

  // Count items per filter for chip badges
  const statusCounts = useMemo(() => {
    const all = listData?.items ?? [];
    const count = (pred: (e: typeof all[number]) => boolean) => all.filter(pred).length;
    return {
      all: all.length,
      available:    count((e) => e.status === "available" && (!e.damageStatus || e.damageStatus === "normal")),
      issued:       count((e) => e.status === "checked_out" && (!e.damageStatus || e.damageStatus === "normal")),
      damaged:      count((e) => e.damageStatus === "damaged"),
      under_repair: count((e) => e.damageStatus === "under_repair"),
      repaired:     count((e) => e.damageStatus === "repaired"),
      retired:      count((e) => e.status === "retired"),
    };
  }, [listData]);

  const detail: EquipmentDetail | null = useMemo(() => {
    if (!detailData) return null;
    const eq = detailData;
    // Most recent event (checkEvents ordered desc by createdAt)
    const latest = eq.checkEvents[0];
    const isCurrentlyIssued = eq.status === "checked_out" && latest?.eventType === "check_out";
    const currentLocation = isCurrentlyIssued && latest
      ? locationChain([latest.studio?.name, latest.stage?.name, latest.set?.name, latest.positionType, latest.exactLocationDescription])
      : undefined;
    return {
      id:       eq.id,
      serial:   eq.serial,
      type:     eq.name,
      category: eq.category?.name ?? "Uncategorised",
      status:   effectiveStatus(eq.status, eq.damageStatus),
      notes:    eq.notes ?? undefined,
      location: currentLocation,
      addedAt:  eq.createdAt.toISOString(),
      issuedAt: isCurrentlyIssued && latest ? new Date(latest.createdAt).toISOString() : null,
      checkHistory: eq.checkEvents.map((ce) => ({
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
      damageHistory: eq.damageReports.map((dr) => ({
        id:          dr.id,
        description: dr.description ?? "",
        reportedBy:  dr.reporter?.displayName ?? dr.reporter?.email ?? "Unknown",
        timestamp:   new Date(dr.reportedAt).toISOString(),
        status:      (dr.repairLogs?.[0] ? "repaired" : "damaged") as "damaged" | "repaired",
        resolution:  dr.repairLogs?.[0]?.description,
        repairedBy:  dr.repairLogs?.[0]?.repairedByName,
        repairedAt:  dr.repairLogs?.[0]?.repairedAt ? new Date(dr.repairLogs[0].repairedAt).toISOString() : undefined,
      })),
    };
  }, [detailData]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar
        title="Equipment Register"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowCsvModal(true)}>Import CSV</Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => {
                const ids = Array.from(selectedIds).join(",");
                router.push(`/equipment/labels?ids=${ids}`);
              }}
            >
              🖨 QR Labels{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
            <Button variant="primary" size="sm" onClick={() => router.push("/equipment/new")}>
              + New Entry
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-hidden flex">
        {/* Sub-sidebar — status filter rail */}
        <aside className="w-[220px] shrink-0 bg-white border-r border-grey-mid overflow-y-auto">
          <nav className="py-4 px-3 space-y-6">
            <div>
              <div className="px-2 mb-1.5 text-[10px] font-semibold text-grey uppercase tracking-wider">
                Status
              </div>
              <ul className="space-y-0.5">
                {FILTER_TABS.map((tab) => {
                  const count = statusCounts[tab.id] ?? 0;
                  const isActive = statusFilter === tab.id;
                  return (
                    <li key={tab.id}>
                      <button
                        onClick={() => setStatusFilter(tab.id)}
                        className={[
                          "w-full flex items-center justify-between px-2 py-1.5 rounded-btn text-[13px] transition-colors text-left",
                          isActive
                            ? "bg-brand-blue/10 text-brand-blue font-semibold"
                            : "text-surface-dark hover:bg-grey-light",
                        ].join(" ")}
                      >
                        <span>{tab.label}</span>
                        <span className={`text-[11px] ${isActive ? "text-brand-blue" : "text-grey"}`}>
                          {count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
        </aside>

        {/* Content column */}
        <div className="flex-1 overflow-hidden flex flex-col">
        {/* Search */}
        <div className="px-6 py-4 bg-white border-b border-grey-mid">
          <input
            type="search"
            placeholder="Search serial, type, or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
          />
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <ReportTable
              columns={EQUIPMENT_COLS}
              rows={items}
              title="Equipment Register"
              emptyMessage={search ? "No equipment matches your search." : "No equipment yet — add your first item above."}
              onRowClick={(row) => setDetailId(row.id as string)}
            />
          )}
        </div>
        </div>
      </div>

      {/* CSV import modal */}
      <CsvImportModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        templateUrl="/equipment-import-template.csv"
        onImport={async (file): Promise<ImportResult> => {
          const csv = await file.text();
          const result = await importCsv.mutateAsync({ workspaceId, csv });
          void refetch();
          return {
            imported: result.imported,
            errors: result.errors.map((e) => ({
              row:     e.row,
              field:   e.serial ? "serial" : undefined,
              message: e.error,
            })),
          };
        }}
      />

      {/* Detail drawer */}
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

function TableSkeleton() {
  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-grey-mid">
          <div className="w-4 h-4 bg-grey-mid rounded" />
          <div className="w-20 h-3 bg-grey-mid rounded" />
          <div className="flex-1 h-3 bg-grey-mid rounded" />
          <div className="w-16 h-5 bg-grey-mid rounded-badge" />
          <div className="w-16 h-5 bg-grey-mid rounded-badge" />
        </div>
      ))}
    </div>
  );
}
