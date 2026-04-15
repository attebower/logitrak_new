"use client";

/**
 * Equipment Registry page — Sprint 2
 * Uses Echo's EquipmentListRow, EquipmentTableHead, EquipmentDetailPanel components.
 *
 * TODO Sprint 2: replace MOCK_EQUIPMENT with trpc.equipment.list.useQuery()
 * TODO Sprint 2: replace detail fetch with trpc.equipment.getById.useQuery()
 */

import { useState, useMemo } from "react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { EquipmentListRow, EquipmentTableHead } from "@/components/shared/EquipmentListRow";
import { EquipmentDetailPanel } from "@/components/shared/EquipmentDetailPanel";
import type { EquipmentItem, EquipmentStatus } from "@/components/shared/EquipmentListRow";
import type { EquipmentDetail } from "@/components/shared/EquipmentDetailPanel";

// ── Mock data ──────────────────────────────────────────────────────────────

const MOCK_EQUIPMENT: EquipmentItem[] = [
  { id: "1", serial: "SP-001", type: "Arri SkyPanel S60-C",   category: "Fixtures",     status: "available",    location: "Lighting Store",       lastActivity: "2h ago" },
  { id: "2", serial: "SP-002", type: "Arri SkyPanel S60-C",   category: "Fixtures",     status: "checked-out",  location: "Stage 7A — Throne Room", lastActivity: "45m ago" },
  { id: "3", serial: "AT-001", type: "Astera Titan Tube",     category: "LED",          status: "available",    location: "Lighting Store",       lastActivity: "1d ago" },
  { id: "4", serial: "AT-002", type: "Astera Titan Tube",     category: "LED",          status: "damaged",      location: "Repairs Bench",        lastActivity: "3h ago" },
  { id: "5", serial: "CV-001", type: "Creamsource Vortex8",   category: "Fixtures",     status: "checked-out",  location: "Stage 3 — Castle Hall", lastActivity: "2h ago" },
  { id: "6", serial: "DD-001", type: "Dedolight DLH4",        category: "Tungsten",     status: "available",    location: "Lighting Store",       lastActivity: "5d ago" },
  { id: "7", serial: "KF-001", type: "Kinoflo Freestyle 21",  category: "Fluorescent",  status: "repaired",     location: "Lighting Store",       lastActivity: "1h ago" },
  { id: "8", serial: "LA-001", type: "Litepanels Astra 6X",   category: "LED",          status: "available",    location: "Lighting Store",       lastActivity: "3d ago" },
];

const MOCK_DETAIL: EquipmentDetail = {
  id: "1",
  serial: "SP-001",
  type: "Arri SkyPanel S60-C",
  category: "Fixtures",
  status: "available",
  location: "Lighting Store",
  notes: "Rigging adapter attached. Handle with care.",
  addedAt: "2026-01-15T09:00:00Z",
  checkHistory: [
    { id: "c1", type: "out", location: "Stage 7A — Throne Room", checkedBy: "Sarah K.", timestamp: "2026-04-13T10:30:00Z" },
    { id: "c2", type: "in",  checkedBy: "Tom R.", timestamp: "2026-04-13T19:00:00Z" },
    { id: "c3", type: "out", location: "Stage 3 Main", checkedBy: "James O.", timestamp: "2026-04-10T08:15:00Z" },
    { id: "c4", type: "in",  checkedBy: "James O.", timestamp: "2026-04-10T20:00:00Z" },
  ],
  damageHistory: [],
};

const STATUS_FILTERS: { label: string; value: EquipmentStatus | "all" }[] = [
  { label: "All",         value: "all" },
  { label: "Available",   value: "available" },
  { label: "Checked Out", value: "checked-out" },
  { label: "Damaged",     value: "damaged" },
  { label: "Repaired",    value: "repaired" },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function EquipmentPage() {
  const [search,      setSearch]      = useState("");
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | "all">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailId,    setDetailId]    = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const filtered = useMemo(() => {
    return MOCK_EQUIPMENT.filter((item) => {
      const matchesSearch =
        !search ||
        item.serial.toLowerCase().includes(search.toLowerCase()) ||
        item.type.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const detailItem = detailId ? { ...MOCK_DETAIL, id: detailId } : null;

  function handleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(filtered.map((i) => i.id)) : new Set());
  }

  return (
    <>
      <AppTopbar
        title="Equipment Registry"
        actions={
          <>
            <Button variant="secondary" size="sm">Import CSV</Button>
            <Button variant="secondary" size="sm">QR Labels</Button>
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
          <div className="flex gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={[
                  "px-3 py-1.5 rounded-btn text-[11px] font-semibold transition-colors",
                  statusFilter === f.value
                    ? "bg-brand-blue text-white"
                    : "bg-grey-light text-grey hover:bg-grey-mid",
                ].join(" ")}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Add equipment form */}
        {showAddForm && (
          <div className="mx-6 mt-4 bg-white rounded-card border border-grey-mid p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold text-surface-dark">Add Equipment</h2>
              <button onClick={() => setShowAddForm(false)} className="text-grey hover:text-surface-dark text-lg">×</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Serial Number", placeholder: "e.g. SP-009" },
                { label: "Equipment Type", placeholder: "e.g. Arri SkyPanel S60-C" },
                { label: "Category", placeholder: "e.g. Fixtures" },
                { label: "Location", placeholder: "e.g. Lighting Store" },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-caption text-grey uppercase mb-1.5">{f.label}</label>
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              {/* TODO Sprint 2: trpc.equipment.create.useMutation() */}
              <Button variant="primary" size="sm">Save Equipment</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-grey text-body">
              No equipment matches your search.
            </div>
          ) : (
            <div className="bg-white rounded-card border border-grey-mid overflow-hidden shadow-card">
              <table className="w-full">
                <EquipmentTableHead
                  allSelected={selectedIds.size === filtered.length && filtered.length > 0}
                  onSelectAll={handleSelectAll}
                />
                <tbody>
                  {filtered.map((item) => (
                    <EquipmentListRow
                      key={item.id}
                      item={item}
                      selected={selectedIds.has(item.id)}
                      onSelect={(_id, checked) =>
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (checked) { next.add(item.id); } else { next.delete(item.id); }
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

      {/* Detail drawer */}
      <EquipmentDetailPanel
        equipment={detailItem}
        isOpen={!!detailId}
        onClose={() => setDetailId(null)}
        onReportDamage={() => {
          setDetailId(null);
          // TODO Sprint 2: navigate to damage report form or open modal
        }}
      />
    </>
  );
}
