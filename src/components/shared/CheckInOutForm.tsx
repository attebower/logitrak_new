"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { ScanArea } from "@/components/shared/ScanArea";
import { LocationPicker } from "@/components/shared/LocationPicker";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { ScanWarningList } from "@/components/shared/ScanWarningBanner";
import { CheckInOutGuideSteps } from "@/components/shared/CheckInOutGuideSteps";
import type { ScanWarning } from "@/components/shared/ScanWarningBanner";
import type { LocationValue, StudioOption, ProjectOption } from "@/components/shared/LocationPicker";

const POSITION_MAP = {
  "Inside Prop Make":        "inside_prop_make",
  "In Prop Dressing":        "in_prop_dressing",
  "On Set":                  "on_set",
  "Rigged to Outside of Set": "rigged_to_outside_of_set",
} as const;

type DBPositionType = typeof POSITION_MAP[keyof typeof POSITION_MAP];
export type CheckInOutMode = "out" | "in";
type ConditionChoice = "good" | "damaged";

interface BatchEntry {
  serial:      string;
  name:        string;
  equipmentId: string;
  isCrossHire?: boolean;
  condition?:  ConditionChoice;
  damageReport?: {
    description:    string;
    itemLocation:   string;
    damageLocation: string;
  };
}

const TITLES: Record<CheckInOutMode, string> = {
  out: "Issue",
  in:  "Return",
};

export function CheckInOutForm({ mode }: { mode: CheckInOutMode }) {
  const { workspaceId } = useWorkspace();

  // Out state
  const [outBatch,     setOutBatch]     = useState<BatchEntry[]>([]);
  const [outLocation,  setOutLocation]  = useState<LocationValue>({});
  const [outError,     setOutError]     = useState<string | null>(null);
  const [lastOutCount, setLastOutCount] = useState(0);
  const [justIssued,   setJustIssued]   = useState(false);

  // In state
  const [inBatch,     setInBatch]     = useState<BatchEntry[]>([]);
  const [inError,     setInError]     = useState<string | null>(null);
  const [lastInCount, setLastInCount] = useState(0);
  const [justReturned, setJustReturned] = useState(false);

  const [scanSearch,  setScanSearch]  = useState("");
  const [warnings,    setWarnings]    = useState<ScanWarning[]>([]);

  const [damageEditingSerial, setDamageEditingSerial] = useState<string | null>(null);
  const [damageDesc,       setDamageDesc]       = useState("");
  const [damageItemLoc,    setDamageItemLoc]    = useState("");
  const [damageNoticedLoc, setDamageNoticedLoc] = useState("");

  const [repairEditingSerial, setRepairEditingSerial] = useState<string | null>(null);
  const [repairDescription, setRepairDescription] = useState("");
  const [repairedBy,        setRepairedBy]        = useState("");
  const [repairLocation,    setRepairLocation]    = useState("");
  const [repairSubmitting,  setRepairSubmitting]  = useState(false);

  const utils = trpc.useUtils();

  const { data: projectsData } = trpc.project.list.useQuery({ workspaceId });
  const projectOptions: ProjectOption[] = (projectsData ?? [])
    .filter((p) => p.status === "active")
    .map((p) => ({ id: p.id, name: p.name, studioId: p.studio?.id ?? null }));

  const { data: studios } = trpc.location.studio.list.useQuery({ workspaceId });

  const { data: stagesData } = trpc.location.stage.list.useQuery(
    { workspaceId, studioId: outLocation.studioId! },
    { enabled: !!outLocation.studioId }
  );
  const { data: setsData } = trpc.location.set.list.useQuery(
    { workspaceId, stageId: outLocation.stageId! },
    { enabled: !!outLocation.stageId }
  );

  const studioOptions: StudioOption[] = (studios ?? []).map((s) => ({
    id:     s.id,
    name:   s.name,
    stages: (stagesData && outLocation.studioId === s.id ? stagesData : []).map((st) => ({
      id:   st.id,
      name: st.name,
      sets: (setsData && outLocation.stageId === st.id ? setsData : []).map((set) => ({
        id:   set.id,
        name: set.name,
      })),
    })),
  }));

  const checkOut = trpc.checkEvent.checkOut.useMutation({
    onSuccess: (_data, variables) => {
      void utils.equipment.list.invalidate();
      void utils.dashboard.stats.invalidate();
      void utils.activity.list.invalidate();
      setLastOutCount(variables.equipmentIds.length);
      setJustIssued(true);
      setTimeout(() => {
        setOutBatch([]);
        setOutLocation({});
        setOutError(null);
        setWarnings([]);
        setScanSearch("");
        setJustIssued(false);
        checkOut.reset();
      }, 1500);
    },
    onError: (err) => setOutError(err.message),
  });

  const checkIn = trpc.checkEvent.checkIn.useMutation({
    onSuccess: (_data, variables) => {
      // Cross-hired items get auto-reconciled server-side, so refresh the
      // cross-hire list/drawer along with equipment + dashboard stats.
      void utils.equipment.list.invalidate();
      void utils.dashboard.stats.invalidate();
      void utils.activity.list.invalidate();
      void utils.crossHire["crossHire.list"].invalidate();
      void utils.crossHire["crossHire.getById"].invalidate();
      setLastInCount(variables.equipmentIds.length);
      setJustReturned(true);
      setTimeout(() => {
        setInBatch([]);
        setInError(null);
        setWarnings([]);
        setScanSearch("");
        setDamageEditingSerial(null);
        setJustReturned(false);
        checkIn.reset();
      }, 1500);
    },
    onError: (err) => setInError(err.message),
  });

  const createDamageReport = trpc.damage.report.create.useMutation();
  const createRepairLog = trpc.damage.repairLog.create.useMutation();

  const handleSerialInput = useCallback(async (raw: string) => {
    const serial = raw.trim().toUpperCase();
    if (!/^[0-9]{5}$/.test(serial)) return;

    const currentBatch = mode === "out" ? outBatch : inBatch;

    if (currentBatch.find((i) => i.serial === serial)) {
      addWarning({ serial, kind: "duplicate", message: `${serial} is already in the batch.` });
      setScanSearch("");
      return;
    }

    let match: { id: string; serial: string; name: string; status: string; damageStatus: string } | undefined;
    try {
      const result = await utils.equipment.list.fetch({ workspaceId, search: serial, limit: 1 });
      match = result?.items?.find((i: { serial: string }) => i.serial.toUpperCase() === serial);
    } catch {
      addWarning({ serial, kind: "unknown", message: `Error looking up ${serial}.` });
      setScanSearch("");
      return;
    }

    setScanSearch("");

    if (!match) {
      addWarning({ serial, kind: "unknown", message: `${serial} not found in this workspace.` });
      return;
    }

    if (match.damageStatus === "damaged" || match.damageStatus === "under_repair") {
      const stateLabel = match.damageStatus === "damaged" ? "Damaged" : "Under Repair";
      if (mode === "out") {
        addWarning({
          serial,
          kind: "damaged",
          message: `${serial} — ${match.name} is ${stateLabel}`,
          detail: match.damageStatus === "damaged"
            ? "Active damage report — cannot be issued. Repair before checking out."
            : "Currently in the workshop — cannot be issued until repair is logged.",
          action: { label: "View damage report", href: `/damage?equipmentId=${match.id}` },
        });
        return;
      }
      const entry: BatchEntry = {
        serial:      match.serial,
        name:        match.name,
        equipmentId: match.id,
      };
      setInBatch((b) => [...b, entry]);
      setRepairEditingSerial(match.serial);
      setRepairDescription("");
      setRepairedBy("");
      setRepairLocation("");
      clearWarning(serial);
      addWarning({
        serial,
        kind: "wrong-state",
        message: `${serial} is ${stateLabel} — log the repair to mark it ready`,
      });
      return;
    }

    if (mode === "out") {
      if (match.status === "checked_out" || match.status === "issued") {
        addWarning({
          serial,
          kind: "wrong-state",
          message: `${serial} — ${match.name} is already Issued`,
          detail: "This item is currently checked out. Check it in first before issuing again.",
          action: { label: "View item", href: `/equipment?id=${match.id}` },
        });
        return;
      }
      if (match.status === "cross_hired") {
        addWarning({
          serial,
          kind: "wrong-state",
          message: `${serial} — ${match.name} is on Cross Hire`,
          detail: "This item is currently out on a cross hire and can't be issued internally. Return it from cross hire first.",
          action: { label: "Open Cross Hire", href: "/cross-hire" },
        });
        return;
      }
      if (match.status === "retired") {
        addWarning({
          serial,
          kind: "damaged",
          message: `${serial} — ${match.name} is Retired`,
          detail: "This item has been decommissioned.",
        });
        return;
      }
    } else {
      if (match.status === "available") {
        addWarning({
          serial,
          kind: "wrong-state",
          message: `${serial} — ${match.name} is already Available`,
          detail: "Not currently issued, so there's nothing to return.",
        });
        return;
      }
      if (match.status === "retired") {
        addWarning({
          serial,
          kind: "damaged",
          message: `${serial} — ${match.name} is Retired`,
          detail: "This item has been decommissioned.",
        });
        return;
      }
    }

    clearWarning(serial);
    const entry: BatchEntry = {
      serial:      match.serial,
      name:        match.name,
      equipmentId: match.id,
      isCrossHire: mode === "in" && match.status === "cross_hired" ? true : undefined,
    };
    if (mode === "out") setOutBatch((b) => [...b, entry]);
    else                setInBatch((b) => [...b, entry]);
  }, [mode, outBatch, inBatch, utils, workspaceId]);

  const handleScan = useCallback((serial: string) => {
    void handleSerialInput(serial);
  }, [handleSerialInput]);

  function addWarning(w: ScanWarning) {
    setWarnings([w]);
  }
  function clearWarning(serial: string) {
    setWarnings((prev) => prev.filter((x) => x.serial !== serial));
  }

  function handleOutConfirm() {
    const positionType = outLocation.positionType
      ? (POSITION_MAP[outLocation.positionType] as DBPositionType)
      : undefined;

    checkOut.mutate({
      workspaceId,
      equipmentIds:             outBatch.map((i) => i.equipmentId),
      productionName:           outLocation.projectName,
      studioId:                 outLocation.studioId,
      stageId:                  outLocation.stageId,
      onLocationId:             outLocation.onLocationId,
      setId:                    outLocation.setId,
      positionType,
      exactLocationDescription: outLocation.exactLocationDescription,
    });
  }

  function handleInConfirm() {
    const damagedItems = inBatch.filter((i) => i.condition === "damaged");

    checkIn.mutate(
      {
        workspaceId,
        equipmentIds: inBatch.map((i) => i.equipmentId),
      },
      {
        onSuccess: () => {
          for (const item of damagedItems) {
            createDamageReport.mutate({
              workspaceId,
              equipmentId:    item.equipmentId,
              description:    item.damageReport?.description    ?? `Damage noticed on check-in for ${item.serial}`,
              itemLocation:   item.damageReport?.itemLocation   || undefined,
              damageLocation: item.damageReport?.damageLocation || undefined,
            });
          }
        },
      }
    );
  }

  async function saveRepair(serial: string) {
    const item = inBatch.find((i) => i.serial === serial);
    if (!item || !repairDescription.trim()) return;
    setRepairSubmitting(true);
    try {
      await createRepairLog.mutateAsync({
        workspaceId,
        equipmentId: item.equipmentId,
        description: repairDescription.trim(),
        repairedByName: repairedBy.trim() || "Unknown",
        repairLocation: repairLocation.trim() || "Unknown",
      });
      await utils.equipment.list.invalidate();
      setRepairEditingSerial(null);
      clearWarning(serial);
      setRepairDescription("");
      setRepairedBy("");
      setRepairLocation("");
    } finally {
      setRepairSubmitting(false);
    }
  }

  const locationComplete =
    !!outLocation.projectId &&
    !!(outLocation.stageId || outLocation.onLocationId) &&
    !!outLocation.positionType &&
    (outLocation.positionType !== "Inside Prop Make" &&
     outLocation.positionType !== "In Prop Dressing"
      ? true
      : !!outLocation.exactLocationDescription?.trim());

  function studioName(id?: string) {
    return studios?.find((s) => s.id === id)?.name ?? "";
  }
  function stageName(id?: string) {
    return stagesData?.find((s) => s.id === id)?.name ?? "";
  }

  const destinationSummary = [
    studioName(outLocation.studioId),
    stageName(outLocation.stageId),
    outLocation.positionType,
    outLocation.exactLocationDescription,
  ].filter(Boolean).join(" → ");

  return (
    <>
      <AppTopbar title={TITLES[mode]} />

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4 relative">
          {(justIssued || justReturned) && (
            <SuccessCutaway
              kind={justIssued ? "out" : "in"}
              count={justIssued ? lastOutCount : lastInCount}
            />
          )}

          <CheckInOutGuideSteps />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
            <div className="space-y-4">
              <ScanPanel
                mode={mode}
                scanSearch={scanSearch}
                setScanSearch={setScanSearch}
                onSerialComplete={handleSerialInput}
                onScan={handleScan}
                warnings={warnings}
                onDismissWarning={clearWarning}
              />

              <BatchPanel
                mode={mode}
                items={mode === "out" ? outBatch : inBatch}
                onRemove={(s) => {
                  if (mode === "out") setOutBatch((b) => b.filter((i) => i.serial !== s));
                  else                setInBatch((b) => b.filter((i) => i.serial !== s));
                }}
                onClear={() => {
                  if (mode === "out") setOutBatch([]);
                  else                setInBatch([]);
                  setWarnings([]);
                }}
                onFlagDamage={(s) => {
                  setDamageDesc("");
                  setDamageItemLoc("");
                  setDamageNoticedLoc("");
                  setDamageEditingSerial(s);
                }}
                onUnflagDamage={(s) => {
                  setInBatch((b) => b.map((i) => i.serial === s ? { ...i, condition: undefined, damageReport: undefined } : i));
                  if (damageEditingSerial === s) setDamageEditingSerial(null);
                }}
                damageEditingSerial={damageEditingSerial}
                damageDesc={damageDesc} setDamageDesc={setDamageDesc}
                damageItemLoc={damageItemLoc} setDamageItemLoc={setDamageItemLoc}
                damageNoticedLoc={damageNoticedLoc} setDamageNoticedLoc={setDamageNoticedLoc}
                onSaveDamage={(s) => {
                  setInBatch((b) => b.map((i) => i.serial === s ? {
                    ...i,
                    condition: "damaged",
                    damageReport: {
                      description:    damageDesc.trim(),
                      itemLocation:   damageItemLoc.trim(),
                      damageLocation: damageNoticedLoc.trim(),
                    },
                  } : i));
                  setDamageEditingSerial(null);
                }}
                onCancelDamage={() => setDamageEditingSerial(null)}
                repairEditingSerial={repairEditingSerial}
                repairDescription={repairDescription} setRepairDescription={setRepairDescription}
                repairedBy={repairedBy} setRepairedBy={setRepairedBy}
                repairLocation={repairLocation} setRepairLocation={setRepairLocation}
                repairSubmitting={repairSubmitting}
                onSaveRepair={saveRepair}
                onCancelRepair={() => setRepairEditingSerial(null)}
              />
            </div>

            <div className="space-y-4">
              {mode === "out" ? (
                <DestinationPanel
                  value={outLocation}
                  onChange={setOutLocation}
                  projects={projectOptions}
                  studios={studioOptions}
                  summary={destinationSummary}
                />
              ) : (
                <ReturnSummaryPanel items={inBatch} />
              )}
            </div>
          </div>

          {(outError && mode === "out") && <ErrorBanner message={outError} />}
          {(inError  && mode === "in")  && <ErrorBanner message={inError} />}

          <div className="bg-white rounded-card border border-grey-mid p-4 flex items-center justify-between gap-4">
            <div className="text-[12px] text-grey">
              {mode === "out"
                ? outBatch.length === 0
                  ? "Scan items, pick a destination, then confirm."
                  : !locationComplete
                    ? `${outBatch.length} item${outBatch.length !== 1 ? "s" : ""} scanned — set destination to continue`
                    : `Ready to issue ${outBatch.length} item${outBatch.length !== 1 ? "s" : ""} to ${destinationSummary}`
                : inBatch.length === 0
                  ? "Scan returning items and flag any damage."
                  : `${inBatch.length} item${inBatch.length !== 1 ? "s" : ""} to return${inBatch.some((i) => i.condition === "damaged") ? ` — ${inBatch.filter((i) => i.condition === "damaged").length} flagged damaged` : ""}`}
            </div>
            <div className="flex items-center gap-2">
              {mode === "out" && outBatch.length > 0 && (
                <Button
                  variant="primary" size="lg"
                  disabled={!locationComplete || checkOut.isPending}
                  onClick={handleOutConfirm}
                >
                  {checkOut.isPending ? "Issuing…" : `Issue ${outBatch.length} item${outBatch.length !== 1 ? "s" : ""}`}
                </Button>
              )}
              {mode === "in" && inBatch.length > 0 && (
                <Button
                  variant="primary" size="lg"
                  disabled={checkIn.isPending}
                  onClick={handleInConfirm}
                >
                  {checkIn.isPending ? "Returning…" : `Return ${inBatch.length} item${inBatch.length !== 1 ? "s" : ""}`}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ScanPanel({
  mode, scanSearch, setScanSearch, onSerialComplete, onScan, warnings, onDismissWarning,
}: {
  mode: CheckInOutMode;
  scanSearch: string;
  setScanSearch: (s: string) => void;
  onSerialComplete: (s: string) => void;
  onScan: (s: string) => void;
  warnings: ScanWarning[];
  onDismissWarning: (s: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const prevLen = useRef(scanSearch.length);
  useEffect(() => {
    if (prevLen.current === 5 && scanSearch.length === 0) {
      const active = document.activeElement as HTMLElement | null;
      const shouldSteal = !active
        || active === document.body
        || active === inputRef.current;
      if (shouldSteal) inputRef.current?.focus();
    }
    prevLen.current = scanSearch.length;
  }, [scanSearch]);

  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      <div className="px-5 py-3.5 border-b border-grey-mid bg-white rounded-t-card">
        <h2 className="text-[13px] font-semibold text-surface-dark">
          {mode === "out" ? "Issue" : "Return"}
        </h2>
      </div>
      <div className="p-5">
        <div className="lg:hidden mb-4">
          <ScanArea onScan={onScan} onManualEntry={onScan} />
        </div>
        <div>
          <label className="block text-caption text-grey uppercase mb-1.5">Enter Serial</label>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              placeholder="Type or scan serial (5 digits)…"
              value={scanSearch}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 5);
                setScanSearch(v);
                if (v.length === 5) void onSerialComplete(v);
              }}
              className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
              autoComplete="off"
              autoFocus
            />
            {scanSearch.length > 0 && scanSearch.length < 5 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-grey">
                {5 - scanSearch.length} more
              </span>
            )}
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="mt-4">
            <ScanWarningList warnings={warnings} onDismiss={onDismissWarning} />
          </div>
        )}
      </div>
    </div>
  );
}

function BatchPanel({
  mode, items, onRemove, onClear,
  onFlagDamage, onUnflagDamage, damageEditingSerial,
  damageDesc, setDamageDesc,
  damageItemLoc, setDamageItemLoc,
  damageNoticedLoc, setDamageNoticedLoc,
  onSaveDamage, onCancelDamage,
  repairEditingSerial,
  repairDescription, setRepairDescription,
  repairedBy, setRepairedBy,
  repairLocation, setRepairLocation,
  repairSubmitting,
  onSaveRepair, onCancelRepair,
}: {
  mode: CheckInOutMode;
  items: BatchEntry[];
  onRemove: (s: string) => void;
  onClear:  () => void;
  onFlagDamage:   (s: string) => void;
  onUnflagDamage: (s: string) => void;
  damageEditingSerial: string | null;
  damageDesc: string; setDamageDesc: (s: string) => void;
  damageItemLoc: string; setDamageItemLoc: (s: string) => void;
  damageNoticedLoc: string; setDamageNoticedLoc: (s: string) => void;
  onSaveDamage:   (s: string) => void;
  onCancelDamage: () => void;
  repairEditingSerial: string | null;
  repairDescription: string; setRepairDescription: (s: string) => void;
  repairedBy: string; setRepairedBy: (s: string) => void;
  repairLocation: string; setRepairLocation: (s: string) => void;
  repairSubmitting: boolean;
  onSaveRepair: (s: string) => void;
  onCancelRepair: () => void;
}) {
  const hasItems = items.length > 0;
  return (
    <div className={`relative bg-white rounded-card border border-grey-mid overflow-hidden`}>
      <div className="px-5 py-3.5 border-b border-grey-mid flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-surface-dark">
          Batch <span className="text-grey font-normal">({items.length})</span>
        </h2>
        {hasItems && (
          <button onClick={onClear} className="text-[11px] text-grey hover:text-status-red">
            Clear all
          </button>
        )}
      </div>
      <div>
        {items.length === 0 ? (
          <div className="px-5 py-10 text-center text-[12px] text-grey">
            No items yet — scan a serial to add.
          </div>
        ) : (
          <div className="divide-y divide-grey-mid">
            {items.map((item) => {
              const isDamaged = item.condition === "damaged";
              const isEditingDamage = damageEditingSerial === item.serial;
              const isEditingRepair = repairEditingSerial === item.serial;

              return (
                <div key={item.serial}>
                  <div className="px-5 py-3 flex items-center gap-3">
                    <span className="text-[13px] text-surface-dark">{item.serial}</span>
                    <span className="text-[13px] text-grey flex-1 truncate">{item.name}</span>
                    {item.isCrossHire && (
                      <span className="text-[10px] font-semibold uppercase text-violet-700 bg-violet-100 px-2 py-0.5 rounded">Cross Hire</span>
                    )}
                    {isDamaged && (
                      <span className="text-[10px] font-semibold uppercase text-status-red bg-status-red/10 px-2 py-0.5 rounded">Damaged</span>
                    )}
                    {mode === "in" && !isEditingRepair && !isEditingDamage && (
                      isDamaged ? (
                        <button onClick={() => onUnflagDamage(item.serial)} className="text-[11px] text-grey hover:text-status-red">
                          remove
                        </button>
                      ) : (
                        <button
                          onClick={() => onFlagDamage(item.serial)}
                          className="text-[11px] font-semibold text-grey hover:text-status-red px-2 py-1 border border-grey-mid rounded-btn hover:border-status-red"
                        >
                          Flag damage
                        </button>
                      )
                    )}
                    <button
                      onClick={() => onRemove(item.serial)}
                      className="text-grey hover:text-status-red text-[16px] leading-none"
                      aria-label={`Remove ${item.serial}`}
                    >
                      ×
                    </button>
                  </div>

                  {isEditingDamage && (
                    <InlineDamageEditor
                      serial={item.serial}
                      name={item.name}
                      desc={damageDesc} setDesc={setDamageDesc}
                      itemLoc={damageItemLoc} setItemLoc={setDamageItemLoc}
                      noticedLoc={damageNoticedLoc} setNoticedLoc={setDamageNoticedLoc}
                      onSave={() => onSaveDamage(item.serial)}
                      onCancel={onCancelDamage}
                    />
                  )}

                  {isEditingRepair && (
                    <InlineRepairEditor
                      serial={item.serial}
                      name={item.name}
                      description={repairDescription} setDescription={setRepairDescription}
                      repairedBy={repairedBy} setRepairedBy={setRepairedBy}
                      repairLocation={repairLocation} setRepairLocation={setRepairLocation}
                      submitting={repairSubmitting}
                      onSave={() => onSaveRepair(item.serial)}
                      onCancel={onCancelRepair}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DestinationPanel({
  value, onChange, projects, studios, summary,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  projects: ProjectOption[];
  studios:  StudioOption[];
  summary:  string;
}) {
  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      <div className="px-5 py-3.5 border-b border-grey-mid flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-surface-dark">Destination</h2>
        {summary && (
          <span className="text-[11px] text-grey truncate max-w-[50%]">{summary}</span>
        )}
      </div>
      <div className="p-5">
        <LocationPicker projects={projects} studios={studios} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function ReturnSummaryPanel({ items }: { items: BatchEntry[] }) {
  const good    = items.filter((i) => !i.condition).length;
  const damaged = items.filter((i) => i.condition === "damaged").length;
  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      <div className="px-5 py-3.5 border-b border-grey-mid">
        <h2 className="text-[13px] font-semibold text-surface-dark">Return Summary</h2>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-status-green/5 border border-status-green/20 rounded-card p-4">
            <div className="text-caption text-grey uppercase">Good</div>
            <div className="text-[22px] font-semibold text-status-green">{good}</div>
          </div>
          <div className="bg-status-red/5 border border-status-red/20 rounded-card p-4">
            <div className="text-caption text-grey uppercase">Damaged</div>
            <div className="text-[22px] font-semibold text-status-red">{damaged}</div>
          </div>
        </div>
        {items.length > 0 && (
          <p className="text-[11px] text-grey">
            Items will be marked returned. Damaged items will auto-file damage reports on confirm.
          </p>
        )}
        {items.length === 0 && (
          <p className="text-[11px] text-grey">Scan items as they come back. Flag any damage inline.</p>
        )}
      </div>
    </div>
  );
}

function InlineDamageEditor({
  serial, name, desc, setDesc, itemLoc, setItemLoc, noticedLoc, setNoticedLoc, onSave, onCancel,
}: {
  serial: string; name: string;
  desc: string; setDesc: (s: string) => void;
  itemLoc: string; setItemLoc: (s: string) => void;
  noticedLoc: string; setNoticedLoc: (s: string) => void;
  onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="mx-5 mb-4 bg-status-red/5 border border-status-red/20 rounded-card p-4 space-y-3">
      <p className="text-[12px] font-semibold text-status-red">Damage Report — {serial} — {name}</p>
      <Field label="Description" required>
        <textarea
          rows={2}
          autoFocus
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Describe the damage…"
          className="w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-status-red resize-none"
        />
      </Field>
      <Field label="Location on item" optional>
        <input
          value={itemLoc}
          onChange={(e) => setItemLoc(e.target.value)}
          placeholder="e.g. Front lens element, left handle"
          className="w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-status-red"
        />
      </Field>
      <Field label="Where was it noticed" optional>
        <input
          value={noticedLoc}
          onChange={(e) => setNoticedLoc(e.target.value)}
          placeholder="e.g. Stage 7A, loading bay"
          className="w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-status-red"
        />
      </Field>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-btn text-[12px] text-grey border border-grey-mid hover:bg-grey-light">
          Cancel
        </button>
        <button
          disabled={!desc.trim()}
          onClick={onSave}
          className="px-3 py-1.5 rounded-btn text-[12px] font-semibold bg-status-red text-white disabled:opacity-40"
        >
          Save Report
        </button>
      </div>
    </div>
  );
}

function InlineRepairEditor({
  serial, name, description, setDescription, repairedBy, setRepairedBy, repairLocation, setRepairLocation,
  submitting, onSave, onCancel,
}: {
  serial: string; name: string;
  description: string; setDescription: (s: string) => void;
  repairedBy: string; setRepairedBy: (s: string) => void;
  repairLocation: string; setRepairLocation: (s: string) => void;
  submitting: boolean;
  onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="mx-5 mb-4 bg-status-teal/5 border border-status-teal/20 rounded-card p-4 space-y-3">
      <p className="text-[12px] font-semibold text-status-teal">Log Repair — {serial} — {name}</p>
      <Field label="What was repaired" required>
        <textarea
          rows={2}
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the repair work done…"
          className="w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-status-teal resize-none"
        />
      </Field>
      <Field label="Repaired by" optional>
        <input
          value={repairedBy}
          onChange={(e) => setRepairedBy(e.target.value)}
          placeholder="Name or company"
          className="w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-status-teal"
        />
      </Field>
      <Field label="Repair location" optional>
        <input
          value={repairLocation}
          onChange={(e) => setRepairLocation(e.target.value)}
          placeholder="Workshop, on-set, manufacturer…"
          className="w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-status-teal"
        />
      </Field>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-btn text-[12px] text-grey border border-grey-mid hover:bg-grey-light">
          Cancel
        </button>
        <button
          disabled={!description.trim() || submitting}
          onClick={onSave}
          className="px-3 py-1.5 rounded-btn text-[12px] font-semibold bg-status-teal text-white disabled:opacity-40"
        >
          {submitting ? "Logging…" : "Log Repair"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, required, optional, children }: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-caption text-grey uppercase mb-1">
        {label}
        {required && <span className="text-status-red ml-1">*</span>}
        {optional && <span className="text-grey font-normal normal-case ml-1">(optional)</span>}
      </label>
      {children}
    </div>
  );
}

function SuccessCutaway({ kind, count }: { kind: "out" | "in"; count: number }) {
  const verb = kind === "out" ? "Checked out" : "Checked in";
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-md bg-white/30 animate-cutaway"
      aria-live="polite"
      role="status"
    >
      <div
        className="bg-white rounded-panel border border-grey-mid px-12 py-10 flex flex-col items-center gap-4 min-w-[320px]"
        style={{ boxShadow: "0 20px 50px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(15, 23, 42, 0.04)" }}
      >
        <div className="w-14 h-14 rounded-full bg-status-green flex items-center justify-center animate-check-pop">
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="text-center">
          <div className="text-[18px] font-bold text-surface-dark leading-tight">{verb}</div>
          <div className="text-[12px] text-grey mt-1">
            {count} item{count !== 1 ? "s" : ""} {kind === "out" ? "issued" : "returned"}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-status-red-light border border-status-red/20 rounded-card px-4 py-3 text-[12px] text-status-red">
      {message}
    </div>
  );
}
