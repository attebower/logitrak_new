"use client";

/**
 * Repair Log page — wired to live tRPC data.
 *
 * trpc.damage.report.listAll (resolved=true) → completed repairs
 * trpc.damage.repairLog.create               → log a new repair
 *
 * Accepts ?reportId=xxx from damage page to pre-fill the form.
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { RepairLogList } from "@/components/shared/RepairLogCard";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import type { RepairLog } from "@/components/shared/RepairLogCard";

export default function RepairLogPage() {
  const { workspaceId } = useWorkspace();
  const searchParams = useSearchParams();
  const prefillReportId = searchParams.get("reportId");

  const [showForm,        setShowForm]        = useState(!!prefillReportId);
  const [equipmentId,     setEquipmentId]     = useState("");
  const [damageReportId,  setDamageReportId]  = useState(prefillReportId ?? "");
  const [repairedByName,  setRepairedByName]  = useState("");
  const [repairLocation,  setRepairLocation]  = useState("");
  const [descriptionText, setDescriptionText] = useState("");
  const [formError,       setFormError]       = useState<string | null>(null);

  // ── Pre-fill from damage report ID ────────────────────────────────────

  const { data: activeReports } = trpc.damage.report.listActive.useQuery(
    { workspaceId },
    { enabled: !!prefillReportId }
  );

  useEffect(() => {
    if (prefillReportId && activeReports) {
      const report = activeReports.find((r) => r.id === prefillReportId);
      if (report) setEquipmentId(report.equipment.id);
    }
  }, [prefillReportId, activeReports]);

  // ── Queries ───────────────────────────────────────────────────────────

  const { data: resolvedReports, refetch } =
    trpc.damage.report.listAll.useQuery({ workspaceId, resolved: true });

  // ── Mutations ─────────────────────────────────────────────────────────

  const createRepairLog = trpc.damage.repairLog.create.useMutation({
    onSuccess: () => {
      void refetch();
      setShowForm(false);
      setEquipmentId("");
      setDamageReportId("");
      setRepairedByName("");
      setRepairLocation("");
      setDescriptionText("");
      setFormError(null);
    },
    onError: (err) => setFormError(err.message),
  });

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!equipmentId) { setFormError("Equipment ID required."); return; }
    setFormError(null);
    createRepairLog.mutate({
      workspaceId,
      equipmentId,
      damageReportId: damageReportId || undefined,
      repairedByName: repairedByName.trim(),
      repairLocation:  repairLocation.trim() || undefined,
      description:     descriptionText.trim(),
    });
  }

  // ── Map resolved reports → RepairLog display shape ──────────────────

  const logs: RepairLog[] = (resolvedReports ?? []).flatMap((r) =>
    r.repairLogs.map((rl) => ({
      id:             rl.id,
      damageReportId: r.id,
      serial:         r.equipment.serial,
      type:           r.equipment.name,
      workDone:       rl.description,
      repairedBy:     rl.repairedByName ?? rl.repairer?.displayName ?? rl.repairer?.email ?? "Unknown",
      returnedTo:     rl.repairLocation ?? undefined,
      repairedAt:     rl.repairedAt.toISOString(),
    }))
  );

  return (
    <>
      <AppTopbar
        title="Repair Log"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/damage">← Back to Damage</Link>
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "× Cancel" : "+ Log Repair"}
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Log repair form */}
        {showForm && (
          <form onSubmit={handleFormSubmit} className="bg-white rounded-card border border-grey-mid p-5 space-y-4">
            <h2 className="text-[14px] font-semibold text-surface-dark">Log a Repair</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-caption text-grey uppercase mb-1.5">Equipment ID</label>
                <input
                  required
                  value={equipmentId}
                  onChange={(e) => setEquipmentId(e.target.value)}
                  placeholder="cuid from equipment record"
                  className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[11px] font-mono text-surface-dark focus:outline-none focus:border-brand-blue"
                />
                <p className="text-[10px] text-grey mt-1">Pre-filled when opened from Damage page</p>
              </div>
              <div>
                <label className="block text-caption text-grey uppercase mb-1.5">Repaired By</label>
                <input
                  required
                  value={repairedByName}
                  onChange={(e) => setRepairedByName(e.target.value)}
                  placeholder="Technician name"
                  className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
                />
              </div>
              <div>
                <label className="block text-caption text-grey uppercase mb-1.5">Repair Location (optional)</label>
                <input
                  value={repairLocation}
                  onChange={(e) => setRepairLocation(e.target.value)}
                  placeholder="e.g. Workshop Bay 2"
                  className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
                />
              </div>
              <div>
                <label className="block text-caption text-grey uppercase mb-1.5">Damage Report ID (optional)</label>
                <input
                  value={damageReportId}
                  onChange={(e) => setDamageReportId(e.target.value)}
                  placeholder="Links repair to a report"
                  className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[11px] font-mono text-surface-dark focus:outline-none focus:border-brand-blue"
                />
              </div>
            </div>

            <div>
              <label className="block text-caption text-grey uppercase mb-1.5">Work Done</label>
              <textarea
                required
                value={descriptionText}
                onChange={(e) => setDescriptionText(e.target.value)}
                placeholder="Describe what was repaired and how…"
                rows={3}
                className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue resize-none"
              />
            </div>

            {formError && <p className="text-[12px] text-status-red">{formError}</p>}

            <div className="flex gap-2">
              <Button variant="primary" size="sm" type="submit" disabled={createRepairLog.isPending}>
                {createRepairLog.isPending ? "Saving…" : "Save Repair Log"}
              </Button>
              <Button variant="secondary" size="sm" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {/* Repair log list */}
        {logs.length === 0 && !showForm ? (
          <div className="py-16 text-center text-grey text-body">
            No repairs logged yet. Use the button above to log your first repair.
          </div>
        ) : (
          <RepairLogList logs={logs} />
        )}
      </div>
    </>
  );
}
