"use client";

/**
 * Damage Reports — wired to live tRPC data.
 *
 * trpc.damage.report.listActive  → active damage cards
 * trpc.damage.report.listAll     → all reports (with filter)
 * trpc.damage.report.create      → report damage form
 * trpc.equipment.list            → serial/name search for report form
 */

import { useState } from "react";
import Link from "next/link";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/StatCard";
import { DamageCardList } from "@/components/shared/DamageCard";
import { FilterTabs } from "@/components/shared/FilterTabs";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import type { DamageReport } from "@/components/shared/DamageCard";

type FilterMode = "active" | "all" | "resolved";

export default function DamagePage() {
  const { workspaceId } = useWorkspace();

  const [showForm,      setShowForm]      = useState(false);
  const [filter,        setFilter]        = useState<FilterMode>("active");
  const [equipSearch,   setEquipSearch]   = useState("");
  const [selectedEqId,  setSelectedEqId]  = useState<string | null>(null);
  const [selectedSerial, setSelectedSerial] = useState("");
  const [description,   setDescription]   = useState("");
  const [damageLocation, setDamageLocation] = useState("");
  const [formError,     setFormError]     = useState<string | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────

  const { data: activeReports, refetch: refetchActive } =
    trpc.damage.report.listActive.useQuery({ workspaceId });

  const { data: allReports, refetch: refetchAll } =
    trpc.damage.report.listAll.useQuery(
      { workspaceId, resolved: filter === "resolved" ? true : filter === "active" ? false : undefined },
      { enabled: filter !== "active" }
    );

  const { data: equipSearch_results } = trpc.equipment.list.useQuery(
    { workspaceId, search: equipSearch, limit: 8 },
    { enabled: equipSearch.length >= 2 }
  );

  // ── Mutations ─────────────────────────────────────────────────────────

  const createReport = trpc.damage.report.create.useMutation({
    onSuccess: () => {
      void refetchActive();
      void refetchAll();
      setShowForm(false);
      setEquipSearch("");
      setSelectedEqId(null);
      setSelectedSerial("");
      setDescription("");
      setDamageLocation("");
      setFormError(null);
    },
    onError: (err) => setFormError(err.message),
  });

  // ── Derived display data ──────────────────────────────────────────────

  const source = filter === "active" ? activeReports : allReports;

  const cards: DamageReport[] = (source ?? []).map((r) => {
    const ds = r.equipment.damageStatus;
    const status: DamageReport["status"] =
      ds === "under_repair" ? "under-repair" :
      ds === "repaired"     ? "repaired"     : "damaged";
    return {
      id:          r.id,
      serial:      r.equipment.serial,
      type:        r.equipment.name,
      description: r.description,
      location:    r.damageLocation ?? undefined,
      reportedBy:  r.reporter?.displayName ?? r.reporter?.email ?? "Unknown",
      reportedAt:  r.reportedAt.toISOString(),
      status,
    };
  });

  const activeDamage  = activeReports?.filter((r) => r.equipment.damageStatus === "damaged").length     ?? 0;
  const underRepair   = activeReports?.filter((r) => r.equipment.damageStatus === "under_repair").length ?? 0;
  const repaired      = (allReports ?? activeReports ?? []).filter((r) => r.equipment.damageStatus === "repaired").length;

  // ── Handlers ─────────────────────────────────────────────────────────

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEqId) { setFormError("Please select an equipment item."); return; }
    setFormError(null);
    createReport.mutate({
      workspaceId,
      equipmentId:    selectedEqId,
      description:    description.trim(),
      damageLocation: damageLocation.trim() || undefined,
    });
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar
        title="Damage Reports"
        actions={
          <>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/damage/repair">Repair Log</Link>
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "× Cancel" : "+ Report Damage"}
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Mini stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard color="red"   icon="⚠" label="Active Damage"      value={activeDamage} />
          <StatCard color="amber" icon="🔧" label="Under Repair"       value={underRepair}  />
          <StatCard color="teal"  icon="✓" label="Repaired"           value={repaired}     />
        </div>

        {/* Report form */}
        {showForm && (
          <form onSubmit={handleFormSubmit} className="bg-white rounded-card border border-grey-mid p-5 space-y-4">
            <h2 className="text-[14px] font-semibold text-surface-dark">Report Damage</h2>

            {/* Equipment search */}
            <div className="relative">
              <label className="block text-caption text-grey uppercase mb-1.5">Equipment (search by serial or name)</label>
              <input
                type="text"
                value={selectedSerial || equipSearch}
                onChange={(e) => {
                  setEquipSearch(e.target.value);
                  setSelectedEqId(null);
                  setSelectedSerial("");
                }}
                placeholder="e.g. AT-002 or Astera"
                className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
              />
              {!selectedEqId && equipSearch.length >= 2 && equipSearch_results && equipSearch_results.items.length > 0 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-grey-mid rounded-card shadow-card overflow-hidden">
                  {equipSearch_results.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedEqId(item.id);
                        setSelectedSerial(`${item.serial} — ${item.name}`);
                        setEquipSearch("");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-grey-light border-b border-grey-mid last:border-b-0"
                    >
                      <span className="text-serial text-surface-dark">{item.serial}</span>
                      <span className="text-[12px] text-grey">{item.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-caption text-grey uppercase mb-1.5">Description</label>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the damage in detail…"
                rows={3}
                className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue resize-none"
              />
            </div>

            <div>
              <label className="block text-caption text-grey uppercase mb-1.5">Where was the damage noticed? (optional)</label>
              <input
                type="text"
                value={damageLocation}
                onChange={(e) => setDamageLocation(e.target.value)}
                placeholder="e.g. Stage 7A — Throne Room"
                className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
              />
            </div>

            {formError && <p className="text-[12px] text-status-red">{formError}</p>}

            <div className="flex gap-2">
              <Button variant="primary" size="sm" type="submit" disabled={createReport.isPending}>
                {createReport.isPending ? "Submitting…" : "Submit Report"}
              </Button>
              <Button variant="secondary" size="sm" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {/* Filter tabs */}
        <FilterTabs
          options={[
            { label: "Active",   value: "active"   },
            { label: "All",      value: "all"      },
            { label: "Resolved", value: "resolved" },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as FilterMode)}
        />

        <DamageCardList
          reports={cards}
          onLogRepair={(id) => {
            // Navigate to repair log page with pre-filled ID
            window.location.href = `/damage/repair?reportId=${id}`;
          }}
          onView={(id) => {
            // Find equipment ID from report
            const report = source?.find((r) => r.id === id);
            if (report) window.location.href = `/equipment?highlight=${report.equipment.id}`;
          }}
        />
      </div>
    </>
  );
}
