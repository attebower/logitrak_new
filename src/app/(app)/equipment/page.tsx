"use client";

/**
 * Equipment Registry — wired to live tRPC data.
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
import { FormInput, FormSelect } from "@/components/shared/FormField";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { CsvImportModal } from "@/components/shared/CsvImportModal";
import type { ImportResult } from "@/components/shared/CsvImportModal";
import type { ColumnDef } from "@/components/shared/ReportTable";
import type { EquipmentDetail } from "@/components/shared/EquipmentDetailPanel";

// ── Column definitions (matches reports page style) ───────────────────────

// Derive a single display status — damage always takes precedence over availability.
function effectiveStatus(status: string, damageStatus: string): { label: string; colour: string } {
  if (damageStatus === "damaged")      return { label: "Damaged",      colour: "text-status-red" };
  if (damageStatus === "under_repair") return { label: "Under Repair", colour: "text-status-amber" };
  if (damageStatus === "repaired")     return { label: "Repaired",     colour: "text-status-teal" };
  if (status === "checked_out")        return { label: "Issued",       colour: "text-status-amber" };
  if (status === "retired")            return { label: "Retired",      colour: "text-grey" };
  return { label: "Available", colour: "text-status-green" };
}

const EQUIPMENT_COLS: ColumnDef[] = [
  { key: "serial",   label: "Serial",   width: "w-28" },
  { key: "name",     label: "Name",     width: "w-full" },
  { key: "category", label: "Category", width: "w-40",
    render: (row) => <span className="text-[13px] text-grey">{String(row.category ?? "—")}</span> },
  { key: "status",   label: "Status",   width: "w-36",
    render: (row) => {
      const { label, colour } = effectiveStatus(String(row.status ?? ""), String(row.damageStatus ?? "normal"));
      return <span className={`text-[13px] font-medium ${colour}`}>{label}</span>;
    }},
];

export default function EquipmentPage() {
  const { workspaceId } = useWorkspace();

  const [search, setSearch] = useState("");
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
    return listData.items.map((eq) => ({
      id:           eq.id,
      serial:       eq.serial,
      name:         eq.name,
      category:     eq.category?.name ?? "Uncategorised",
      status:       eq.status,
      damageStatus: eq.damageStatus,
    }));
  }, [listData]);

  const detail: EquipmentDetail | null = useMemo(() => {
    if (!detailData) return null;
    const eq = detailData;
    const lastOut = eq.checkEvents.find((ce) => ce.eventType === "check_out");
    const currentLocation = lastOut
      ? [lastOut.studio?.name, lastOut.stage?.name, lastOut.set?.name, lastOut.positionType, lastOut.exactLocationDescription].filter(Boolean).join(" → ")
      : undefined;
    return {
      id:       eq.id,
      serial:   eq.serial,
      type:     eq.name,
      category: eq.category?.name ?? "Uncategorised",
      status:   (eq.damageStatus === "damaged" ? "damaged" : eq.damageStatus === "under_repair" ? "under-repair" : eq.damageStatus === "repaired" ? "repaired" : eq.status === "checked_out" ? "checked-out" : "available") as EquipmentDetail["status"],
      notes:    eq.notes ?? undefined,
      location: currentLocation,
      addedAt:  eq.createdAt.toISOString(),
      checkHistory: eq.checkEvents.map((ce) => ({
        id:        ce.id,
        type:      ce.eventType === "check_in" ? "in" as const : "out" as const,
        location:  [ce.studio?.name, ce.stage?.name, ce.set?.name, ce.positionType, ce.exactLocationDescription].filter(Boolean).join(" → "),
        checkedBy: ce.user?.displayName ?? ce.user?.email ?? "Unknown",
        timestamp: new Date(ce.createdAt).toISOString(),
      })),
      damageHistory: eq.damageReports.map((dr) => ({
        id:          dr.id,
        description: dr.description ?? "",
        reportedBy:  dr.reporter?.displayName ?? dr.reporter?.email ?? "Unknown",
        timestamp:   new Date(dr.reportedAt).toISOString(),
        status:      "damaged" as const,
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
        title="Equipment Registry"
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
            <Button variant="primary" size="sm" onClick={() => setShowAddForm(true)}>
              + Add Equipment
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Search bar */}
        <div className="px-6 py-4 bg-white border-b border-grey-mid flex items-center gap-4">
          <input
            type="search"
            placeholder="Search serial, type, or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
          />
        </div>

        {/* Add equipment form */}
        {showAddForm && (
          <form onSubmit={handleAddSubmit} className="mx-6 mt-4 bg-white rounded-card border border-grey-mid p-5">
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
              title="Equipment Registry"
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
