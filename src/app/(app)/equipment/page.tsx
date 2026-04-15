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
import { EquipmentListRow, EquipmentTableHead } from "@/components/shared/EquipmentListRow";
import { EquipmentDetailPanel } from "@/components/shared/EquipmentDetailPanel";
import { FilterTabs } from "@/components/shared/FilterTabs";
import { FormInput, FormSelect } from "@/components/shared/FormField";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { CsvImportModal } from "@/components/shared/CsvImportModal";
import type { ImportResult } from "@/components/shared/CsvImportModal";
import type { EquipmentItem } from "@/components/shared/EquipmentListRow";
import type { EquipmentDetail } from "@/components/shared/EquipmentDetailPanel";

const STATUS_FILTERS = [
  { label: "All",         value: "" },
  { label: "Available",   value: "available" },
  { label: "Checked Out", value: "checked_out" },
  { label: "Damaged",     value: "damaged" },
] as const;

type StatusFilter = typeof STATUS_FILTERS[number]["value"];

// ── Map Prisma EquipmentStatus → EquipmentItem status ──────────────────────

function mapStatus(prismaStatus: string): EquipmentItem["status"] {
  const map: Record<string, EquipmentItem["status"]> = {
    available:   "available",
    checked_out: "checked-out",
    retired:     "available", // fallback
  };
  return map[prismaStatus] ?? "available";
}

function mapDamageStatus(ds: string): EquipmentItem["status"] | null {
  if (ds === "damaged")      return "damaged";
  if (ds === "under_repair") return "under-repair";
  if (ds === "repaired")     return "repaired";
  return null;
}

export default function EquipmentPage() {
  const { workspaceId } = useWorkspace();

  const [search,       setSearch]      = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
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

  const { data: detailData } = trpc.equipment.get.useQuery(
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

  const items: EquipmentItem[] = useMemo(() => {
    if (!listData?.items) return [];
    return listData.items.map((eq) => ({
      id:           eq.id,
      serial:       eq.serial,
      type:         eq.name,
      category:     eq.category?.name ?? "Uncategorised",
      status:       mapDamageStatus(eq.damageStatus) ?? mapStatus(eq.status),
      location:     undefined, // TODO: join location once checkEvent.latest is included
      lastActivity: undefined,
    }));
  }, [listData]);

  const detail: EquipmentDetail | null = useMemo(() => {
    if (!detailData) return null;
    const eq = detailData;
    return {
      id:       eq.id,
      serial:   eq.serial,
      type:     eq.name,
      category: eq.category?.name ?? "Uncategorised",
      status:   mapDamageStatus(eq.damageStatus) ?? mapStatus(eq.status),
      notes:    eq.notes ?? undefined,
      addedAt:  eq.createdAt.toISOString(),
      checkHistory: eq.checkEvents.map((ce) => ({
        id:        ce.id,
        type:      ce.eventType === "check_in" ? "in" as const : "out" as const,
        location:  ce.set?.name ?? ce.stage?.name ?? ce.studio?.name,
        checkedBy: ce.user?.email ?? "Unknown",
        timestamp: ce.createdAt.toISOString(),
      })),
      damageHistory: eq.damageReports.map((dr) => ({
        id:          dr.id,
        description: dr.description,
        reportedBy:  dr.reporter?.email ?? "Unknown",
        timestamp:   dr.reportedAt.toISOString(),
        // DamageReport has no status field; status lives on Equipment.damageStatus.
        // Show as "damaged" — repair state is tracked separately via RepairLog.
        status: "damaged" as const,
      })),
    };
  }, [detailData]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(items.map((i) => i.id)) : new Set());
  }

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
        {/* Search + filter bar */}
        <div className="px-6 py-4 bg-white border-b border-grey-mid flex items-center gap-4 flex-wrap">
          <input
            type="search"
            placeholder="Search serial, type, or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
          />
          <FilterTabs
            options={STATUS_FILTERS.map((f) => ({ label: f.label, value: f.value }))}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />
          {listData && (
            <span className="text-[11px] text-grey">
              {listData.total} item{listData.total !== 1 ? "s" : ""}
            </span>
          )}
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
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-grey text-body">
              {search ? "No equipment matches your search." : "No equipment yet — add your first item above."}
            </div>
          ) : (
            <div className="bg-white rounded-card border border-grey-mid overflow-hidden shadow-card">
              <table className="w-full">
                <EquipmentTableHead
                  allSelected={selectedIds.size === items.length && items.length > 0}
                  onSelectAll={handleSelectAll}
                />
                <tbody>
                  {items.map((item) => (
                    <EquipmentListRow
                      key={item.id}
                      item={item}
                      selected={selectedIds.has(item.id)}
                      onSelect={(id, checked) =>
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (checked) { next.add(id); } else { next.delete(id); }
                          return next;
                        })
                      }
                      onView={setDetailId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
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
          setDetailId(null);
          // TODO: open damage report modal pre-filled with detailId
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
