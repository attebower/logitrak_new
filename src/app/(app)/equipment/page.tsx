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
import { FormInput, FormSelect } from "@/components/shared/FormField";
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
  const [selectedIds,  setSelectedIds] = useState<Set<string>>(new Set());
  const [detailId,     setDetailId]    = useState<string | null>(null);
  const [showAddForm,  setShowAddForm] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const router = useRouter();

  // Add form state
  const [newSerial,   setNewSerial]   = useState("");
  const [newName,     setNewName]     = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [addError,    setAddError]    = useState<string | null>(null);

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

  const { data: categories } = trpc.category.list.useQuery({ workspaceId });

  // ── Mutations ────────────────────────────────────────────────────────────

  const importCsv = trpc.equipment.importCsv.useMutation();

  const createEquipment = trpc.equipment.create.useMutation({
    onSuccess: () => {
      void refetch();
      setShowAddForm(false);
      setNewSerial("");
      setNewName("");
      setNewCategory("");
      setAddError(null);
    },
    onError: (err) => {
      setAddError(err.message);
    },
  });

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

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    createEquipment.mutate({
      workspaceId,
      serial:     newSerial.trim(),
      name:       newName.trim(),
      categoryId: newCategory || undefined,
    });
  }

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

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Filter tab bar — same style as Reports page */}
        <div className="bg-white border-b border-grey-mid px-6 flex gap-0 overflow-x-auto">
          {FILTER_TABS.map((tab) => {
            const count = statusCounts[tab.id] ?? 0;
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={[
                  "px-4 py-3.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-brand-blue text-brand-blue"
                    : "border-transparent text-grey hover:text-surface-dark",
                ].join(" ")}
              >
                {tab.label}
                <span className={`ml-1.5 text-[11px] ${isActive ? "text-brand-blue" : "text-grey"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

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

        {/* Add equipment form — kept for backwards compatibility, now hidden */}
        {showAddForm && (
          <form onSubmit={handleAddSubmit} className="mx-6 mt-4 bg-white rounded-card border border-grey-mid p-5 hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold text-surface-dark">Add Equipment</h2>
              <button type="button" onClick={() => setShowAddForm(false)} className="text-grey hover:text-surface-dark text-lg">×</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Serial (5 digits)"
                required
                pattern="\d{5}"
                value={newSerial}
                onChange={(e) => setNewSerial(e.target.value)}
                placeholder="00001"
              />
              <FormInput
                label="Equipment Name"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Arri SkyPanel S60-C"
              />
              <FormSelect
                label="Category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                <option value="">No category</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </FormSelect>
            </div>
            {addError && (
              <p className="mt-3 text-[12px] text-status-red">{addError}</p>
            )}
            <div className="flex gap-2 mt-4">
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={createEquipment.isPending}
              >
                {createEquipment.isPending ? "Saving…" : "Save Equipment"}
              </Button>
              <Button variant="secondary" size="sm" type="button" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

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
