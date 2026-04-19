"use client";

/**
 * Check In / Out — wired to live tRPC data.
 *
 * Check-Out: trpc.checkEvent.checkOut (with forceCheckOut for Manager+)
 * Check-In:  trpc.checkEvent.checkIn
 * Location:  trpc.location.studio.list → stage.list → set.list (cascading)
 * Equipment search: trpc.equipment.list (serial/name search)
 *
 * Audio: Web Audio API beep fires in ScanArea on scan.
 * Validation: damaged → red reject, duplicate → grey, already-out → amber
 *             (server also validates; client-side is UX-only pre-flight).
 */

import { useState, useCallback } from "react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { ScanArea } from "@/components/shared/ScanArea";
import { BatchList } from "@/components/shared/BatchListItem";
import { ModeToggle } from "@/components/shared/ModeToggle";
import { LocationPicker } from "@/components/shared/LocationPicker";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { ScanWarningList } from "@/components/shared/ScanWarningBanner";
import type { ScanWarning } from "@/components/shared/ScanWarningBanner";
import type { BatchItem, BatchItemStatus } from "@/components/shared/BatchListItem";
import type { CheckMode } from "@/components/shared/ModeToggle";
import type { LocationValue, StudioOption, ProjectOption } from "@/components/shared/LocationPicker";

// ── Prisma positionType enum → LocationPicker PositionType ────────────────

const POSITION_MAP = {
  "Inside Prop Make":        "inside_prop_make",
  "In Prop Dressing":        "in_prop_dressing",
  "On Set":                  "on_set",
  "Rigged to Outside of Set": "rigged_to_outside_of_set",
} as const;

type DBPositionType = typeof POSITION_MAP[keyof typeof POSITION_MAP];

// ── Types ─────────────────────────────────────────────────────────────────

type CheckOutStep = "scan" | "location" | "confirm";
type CheckInStep  = "scan" | "condition" | "confirm";
type ConditionChoice = "good" | "needs-attention" | "damaged";

interface BatchEntry extends BatchItem {
  equipmentId: string;
}
interface DamageReportDraft {
  description:    string;
  itemLocation:   string;
  damageLocation: string;
}

interface BatchEntryWithCondition extends BatchEntry {
  condition?:    ConditionChoice;
  damageReport?: DamageReportDraft;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function CheckInOutPage() {
  const { workspaceId, userRole } = useWorkspace();
  const isManager = ["owner", "admin", "manager"].includes(userRole);

  const [mode,       setMode]       = useState<CheckMode>("out");

  // Check-out state
  const [outStep,        setOutStep]        = useState<CheckOutStep>("scan");
  const [outBatch,       setOutBatch]       = useState<BatchEntry[]>([]);
  const [outLocation,    setOutLocation]    = useState<LocationValue>({});
  const [forceOut,       setForceOut]       = useState(false);
  const [outError,       setOutError]       = useState<string | null>(null);
  const [lastOutCount,   setLastOutCount]   = useState(0); // count snapshot before batch reset

  // Check-in state
  const [inStep,       setInStep]       = useState<CheckInStep>("scan");
  const [inBatch,      setInBatch]      = useState<BatchEntryWithCondition[]>([]);
  const [inError,      setInError]      = useState<string | null>(null);
  const [lastInCount,  setLastInCount]  = useState(0);

  // Damage report card — serial of item currently being filled in
  const [damageCardSerial, setDamageCardSerial] = useState<string | null>(null);
  const [damageDesc,       setDamageDesc]       = useState("");
  const [damageItemLoc,    setDamageItemLoc]    = useState("");
  const [damageNoticedLoc, setDamageNoticedLoc] = useState("");

  // Scan state
  const [warnings,    setWarnings]    = useState<ScanWarning[]>([]);
  const [scanSearch,  setScanSearch]  = useState("");
  const utils = trpc.useUtils();

  // Repair prompt — shown when checking in a damaged/under-repair item
  const [repairPrompt, setRepairPrompt] = useState<{
    serial: string;
    name: string;
    equipmentId: string;
    damageStatus: string;
  } | null>(null);
  const [repairDescription, setRepairDescription] = useState("");
  const [repairedBy, setRepairedBy] = useState("");
  const [repairLocation, setRepairLocation] = useState("");
  const [repairSubmitting, setRepairSubmitting] = useState(false);

  // ── Live data ─────────────────────────────────────────────────────────

  // Projects for LocationPicker (active only)
  const { data: projectsData } = trpc.project.list.useQuery({ workspaceId });
  const projectOptions: ProjectOption[] = (projectsData ?? [])
    .filter((p) => p.status === "active")
    .map((p) => ({ id: p.id, name: p.name, studioId: p.studio?.id ?? null }));

  // Studios for LocationPicker (load once)
  const { data: studios } = trpc.location.studio.list.useQuery({ workspaceId });

  // Stages loaded when studio selected
  const { data: stagesData } = trpc.location.stage.list.useQuery(
    { workspaceId, studioId: outLocation.studioId! },
    { enabled: !!outLocation.studioId }
  );

  // Sets loaded when stage selected
  const { data: setsData } = trpc.location.set.list.useQuery(
    { workspaceId, stageId: outLocation.stageId! },
    { enabled: !!outLocation.stageId }
  );

  // Equipment search for batch building
  const { data: searchResults } = trpc.equipment.list.useQuery(
    { workspaceId, search: scanSearch, limit: 10 },
    { enabled: scanSearch.length >= 2 }
  );

  // ── Build StudioOption tree for LocationPicker ─────────────────────────

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

  // ── Mutations ─────────────────────────────────────────────────────────

  const checkOut = trpc.checkEvent.checkOut.useMutation({
    onSuccess: (_data, variables) => {
      // Capture the count BEFORE clearing the batch
      setLastOutCount(variables.equipmentIds.length);
      // Show success briefly then full reset — clear batch, location, warnings, errors
      setTimeout(() => {
        setOutBatch([]);
        setOutLocation({});
        setOutStep("scan");
        setOutError(null);
        setForceOut(false);
        setWarnings([]);
        setScanSearch("");
        checkOut.reset();
      }, 2000);
    },
    onError: (err) => setOutError(err.message),
  });

  const checkIn = trpc.checkEvent.checkIn.useMutation({
    onSuccess: (_data, variables) => {
      setLastInCount(variables.equipmentIds.length);
      setTimeout(() => {
        setInBatch([]);
        setInStep("scan");
        setInError(null);
        setWarnings([]);
        setScanSearch("");
        setDamageCardSerial(null);
        setDamageDesc("");
        setDamageItemLoc("");
        setDamageNoticedLoc("");
        checkIn.reset();
      }, 2000);
    },
    onError: (err) => setInError(err.message),
  });

  // ── Serial auto-validate: fires as soon as a complete serial is entered ──

  const handleSerialInput = useCallback(async (raw: string) => {
    const serial = raw.trim().toUpperCase();
    if (!/^[0-9]{5}$/.test(serial)) return; // not a complete 5-digit serial yet

    const currentBatch = mode === "out" ? outBatch : inBatch;

    // Duplicate in current batch
    if (currentBatch.find((i) => i.serial === serial)) {
      addWarning({ serial, kind: "duplicate", message: `${serial} is already in the batch.` });
      setScanSearch("");
      return;
    }

    // Fetch fresh from server — don't rely on stale search cache
    let match: { id: string; serial: string; name: string; status: string; damageStatus: string } | undefined;
    try {
      const result = await utils.equipment.list.fetch({ workspaceId, search: serial, limit: 1 });
      match = result?.items?.find((i: { serial: string }) => i.serial.toUpperCase() === serial);
    } catch {
      addWarning({ serial, kind: "unknown", message: `Error looking up ${serial}.` });
      setScanSearch("");
      return;
    }

    setScanSearch(""); // clear input regardless of outcome

    if (!match) {
      addWarning({ serial, kind: "unknown", message: `${serial} not found in this workspace.` });
      return;
    }

    // Damage checks
    if (match.damageStatus === "damaged") {
      if (mode === "out") {
        addWarning({ serial, kind: "damaged", message: `${serial} is damaged and cannot be checked out.` });
        return;
      } else {
        // Check-in: offer repair prompt
        setRepairPrompt({ serial: match.serial, name: match.name, equipmentId: match.id, damageStatus: match.damageStatus });
        return;
      }
    }
    if (match.damageStatus === "under_repair") {
      if (mode === "out") {
        addWarning({ serial, kind: "damaged", message: `${serial} is under repair and cannot be checked out.` });
        return;
      } else {
        setRepairPrompt({ serial: match.serial, name: match.name, equipmentId: match.id, damageStatus: match.damageStatus });
        return;
      }
    }

    // Status checks
    if (mode === "out") {
      if (match.status === "checked_out") {
        addWarning({ serial, kind: "wrong-state", message: `${serial} is already checked out.` });
        return;
      }
      if (match.status === "retired") {
        addWarning({ serial, kind: "damaged", message: `${serial} is retired and cannot be checked out.` });
        return;
      }
    }
    if (mode === "in") {
      if (match.status === "available") {
        addWarning({ serial, kind: "wrong-state", message: `${serial} is already checked in.` });
        return;
      }
      if (match.status === "retired") {
        addWarning({ serial, kind: "damaged", message: `${serial} is retired.` });
        return;
      }
    }

    // All good — add to batch instantly
    clearWarning(serial);
    const entry: BatchEntry = {
      serial:      match.serial,
      type:        match.name,
      status:      "ok" as BatchItemStatus,
      equipmentId: match.id,
    };
    if (mode === "out") setOutBatch((b) => [...b, entry]);
    else                setInBatch((b) => [...b, entry]);
  }, [mode, outBatch, inBatch, utils, workspaceId]);

  // ── Scan handler (QR / barcode scanner path) ──────────────────────────

  const handleScan = useCallback((serial: string) => {
    // Scanners fire a complete serial — route through the same auto-validate path
    void handleSerialInput(serial);
  }, [handleSerialInput]);

  function addWarning(w: ScanWarning) {
    setWarnings((prev) => [w, ...prev.filter((x) => x.serial !== w.serial)].slice(0, 3));
  }
  function clearWarning(serial: string) {
    setWarnings((prev) => prev.filter((x) => x.serial !== serial));
  }

  // ── Confirm check-out ──────────────────────────────────────────────────

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
      setId:                    outLocation.setId,
      positionType,
      exactLocationDescription: outLocation.exactLocationDescription,
      forceCheckOut:            forceOut ? true : undefined,
    });
  }

  // ── Confirm check-in ───────────────────────────────────────────────────

  const createDamageReport = trpc.damage.report.create.useMutation();
  const createRepairLog = trpc.damage.repairLog.create.useMutation();

  function handleInConfirm() {
    const damagedItems = inBatch.filter((i) => i.condition === "damaged");

    checkIn.mutate(
      {
        workspaceId,
        equipmentIds: inBatch.map((i) => i.equipmentId),
      },
      {
        onSuccess: () => {
          // Submit damage reports using the filled-in report data
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

  // ── Location validation ────────────────────────────────────────────────

  const locationComplete =
    !!outLocation.projectId &&
    !!outLocation.studioId &&
    !!outLocation.stageId &&
    !!outLocation.positionType &&
    (outLocation.positionType !== "Inside Prop Make" &&
     outLocation.positionType !== "In Prop Dressing"
      ? true
      : !!outLocation.exactLocationDescription?.trim());

  // ── Studio/stage name helpers ──────────────────────────────────────────

  function studioName(id?: string) {
    return studios?.find((s) => s.id === id)?.name ?? "";
  }
  function stageName(id?: string) {
    return stagesData?.find((s) => s.id === id)?.name ?? "";
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar title="Check In / Out" />

      {/* ── Repair prompt modal ── */}
      {repairPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-[17px] font-bold text-surface-dark mb-1">
              This item is {repairPrompt.damageStatus.replace("_", " ")}
            </h2>
            <p className="text-[13px] text-grey mb-5">
              <span className="font-semibold text-surface-dark">{repairPrompt.serial}</span> — {repairPrompt.name}<br />
              Has this item been repaired and is it ready to go back into service?
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[11px] font-semibold text-grey uppercase tracking-wider mb-1">What was repaired? *</label>
                <textarea
                  value={repairDescription}
                  onChange={(e) => setRepairDescription(e.target.value)}
                  placeholder="Describe the repair work done…"
                  rows={3}
                  className="w-full border border-grey-mid rounded-lg px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:ring-1 focus:ring-brand-blue resize-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-grey uppercase tracking-wider mb-1">Repaired by</label>
                <input
                  value={repairedBy}
                  onChange={(e) => setRepairedBy(e.target.value)}
                  placeholder="Name or company"
                  className="w-full border border-grey-mid rounded-lg px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:ring-1 focus:ring-brand-blue"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-grey uppercase tracking-wider mb-1">Repair location</label>
                <input
                  value={repairLocation}
                  onChange={(e) => setRepairLocation(e.target.value)}
                  placeholder="Workshop, on-set, manufacturer…"
                  className="w-full border border-grey-mid rounded-lg px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:ring-1 focus:ring-brand-blue"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                disabled={!repairDescription.trim() || repairSubmitting}
                onClick={async () => {
                  if (!repairDescription.trim()) return;
                  setRepairSubmitting(true);
                  try {
                    await createRepairLog.mutateAsync({
                      workspaceId,
                      equipmentId: repairPrompt.equipmentId,
                      description: repairDescription.trim(),
                      repairedByName: repairedBy.trim() || "Unknown",
                      repairLocation: repairLocation.trim() || "Unknown",
                    });
                    // Invalidate cache so the item shows as repaired
                    await utils.equipment.list.invalidate();
                    // Add directly to batch — skip handleScan to avoid stale cache check
                    const entry: BatchEntryWithCondition = {
                      serial: repairPrompt.serial,
                      type: repairPrompt.name,
                      status: "ok" as BatchItemStatus,
                      equipmentId: repairPrompt.equipmentId,
                      condition: "good",
                    };
                    setInBatch((b) => [...b, entry]);
                    setRepairPrompt(null);
                    setRepairDescription("");
                    setRepairedBy("");
                    setRepairLocation("");
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setRepairSubmitting(false);
                  }
                }}
                className="flex-1 bg-brand-blue text-white rounded-lg py-2.5 text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {repairSubmitting ? "Logging repair…" : "Yes, log repair & check in"}
              </button>
              <button
                onClick={() => {
                  setRepairPrompt(null);
                  setRepairDescription("");
                  setRepairedBy("");
                  setRepairLocation("");
                }}
                className="flex-1 bg-grey-light text-surface-dark rounded-lg py-2.5 text-[13px] font-semibold border border-grey-mid"
              >
                No, keep as damaged
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">

          <ModeToggle
            mode={mode}
            onChange={(m) => {
              setMode(m);
              setOutStep("scan");
              setInStep("scan");
              setWarnings([]);
            }}
            disabled={outStep !== "scan" || inStep !== "scan"}
          />

          {/* ── CHECK OUT ── */}
          {mode === "out" && (
            <>
              {checkOut.isSuccess ? (
                <SuccessCard message={`${lastOutCount} item${lastOutCount !== 1 ? "s" : ""} checked out successfully.`} />
              ) : (
                <>
                  {/* Step 1: Scan */}
                  {outStep === "scan" && (
                    <div className="space-y-4">
                      <div className="lg:hidden"><ScanArea onScan={handleScan} onManualEntry={handleScan} /></div>

                      {/* Serial input — auto-validates on 5-digit complete entry */}
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Type serial number…"
                          value={scanSearch}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 5);
                            setScanSearch(v);
                            if (v.length === 5) void handleSerialInput(v);
                          }}
                          className="w-full bg-white border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue font-mono tracking-widest"
                          autoComplete="off"
                          autoFocus
                        />
                        {scanSearch.length > 0 && scanSearch.length < 5 && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-grey">
                            {5 - scanSearch.length} more digit{5 - scanSearch.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Scan warnings */}
                      <ScanWarningList warnings={warnings} onDismiss={(serial) => clearWarning(serial)} />

                      

                      <BatchList
                        items={outBatch}
                        onRemove={(s) => setOutBatch((b) => b.filter((i) => i.serial !== s))}
                        onClear={() => setOutBatch([])}
                      />
                      <Button
                        variant="primary" size="lg" className="w-full"
                        disabled={outBatch.length === 0}
                        onClick={() => setOutStep("location")}
                      >
                        Continue → Set Location
                      </Button>
                    </div>
                  )}

                  {/* Step 2: Location */}
                  {outStep === "location" && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-card border border-grey-mid p-5">
                        <h2 className="text-[14px] font-semibold text-surface-dark mb-4">
                          Where is this equipment going?
                        </h2>
                        <LocationPicker
                          projects={projectOptions}
                          studios={studioOptions}
                          value={outLocation}
                          onChange={setOutLocation}
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setOutStep("scan")} className="flex-1">← Back</Button>
                        <Button variant="primary" disabled={!locationComplete} onClick={() => setOutStep("confirm")} className="flex-1">
                          Continue → Confirm
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Confirm */}
                  {outStep === "confirm" && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-card border border-grey-mid p-5 space-y-4">
                        <h2 className="text-[14px] font-semibold text-surface-dark">Confirm Check Out</h2>
                        <div>
                          <p className="text-caption text-grey uppercase mb-2">Items ({outBatch.length})</p>
                          <div className="space-y-1">
                            {outBatch.map((item) => (
                              <div key={item.serial} className="flex items-center gap-2 text-[13px]">
                                <span className="text-serial text-surface-dark">{item.serial}</span>
                                <span className="text-grey">{item.type}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-caption text-grey uppercase mb-1">Destination</p>
                          <p className="text-[13px] text-surface-dark">
                            {[
                              studioName(outLocation.studioId),
                              stageName(outLocation.stageId),
                              outLocation.positionType,
                              outLocation.exactLocationDescription,
                            ].filter(Boolean).join(" → ")}
                          </p>
                        </div>

                      </div>

                      {outError && (
                        <div className="bg-status-red-light border border-status-red/20 rounded-card px-4 py-3 text-[12px] text-status-red">
                          {outError}
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setOutStep("location")} className="flex-1">← Back</Button>
                        <Button
                          variant="primary" size="lg" className="flex-1"
                          disabled={checkOut.isPending}
                          onClick={handleOutConfirm}
                        >
                          {checkOut.isPending ? "Checking out…" : `Confirm Check Out (${outBatch.length})`}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── CHECK IN ── */}
          {mode === "in" && (
            <>
              {checkIn.isSuccess ? (
                <SuccessCard message={`${lastInCount} item${lastInCount !== 1 ? "s" : ""} returned successfully.`} />
              ) : (
                <>
                  {/* Step 1: Scan */}
                  {inStep === "scan" && (
                    <div className="space-y-4">
                      <div className="lg:hidden"><ScanArea onScan={handleScan} onManualEntry={handleScan} /></div>

                      {/* Serial input — auto-validates on 5-digit complete entry */}
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Type serial number…"
                          value={scanSearch}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 5);
                            setScanSearch(v);
                            if (v.length === 5) void handleSerialInput(v);
                          }}
                          className="w-full bg-white border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue font-mono tracking-widest"
                          autoComplete="off"
                          autoFocus
                        />
                        {scanSearch.length > 0 && scanSearch.length < 5 && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-grey">
                            {5 - scanSearch.length} more digit{5 - scanSearch.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      <ScanWarningList warnings={warnings} onDismiss={(serial) => clearWarning(serial)} />

                      <BatchList
                        items={inBatch}
                        onRemove={(s) => setInBatch((b) => b.filter((i) => i.serial !== s))}
                        onClear={() => setInBatch([])}
                      />
                      <Button
                        variant="primary" size="lg" className="w-full"
                        disabled={inBatch.length === 0}
                        onClick={() => setInStep("condition")}
                      >
                        Continue → Condition Check
                      </Button>
                    </div>
                  )}

                  {/* Step 2: Condition */}
                  {inStep === "condition" && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
                        <div className="px-5 py-4 border-b border-grey-mid">
                          <h2 className="text-[14px] font-semibold text-surface-dark">Item Condition</h2>
                          <p className="text-[12px] text-grey mt-0.5">Flag anything damaged before confirming return.</p>
                        </div>
                        <div className="divide-y divide-grey-mid">
                          {inBatch.map((item) => (
                            <div key={item.serial}>
                              <div className="px-5 py-4 flex items-center gap-4">
                                <div className="flex-1 min-w-[120px]">
                                  <span className="text-serial text-surface-dark">{item.serial}</span>
                                  <span className="text-[12px] text-grey ml-2">{item.type}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {item.condition === "damaged" ? (
                                    <>
                                      <span className="text-[11px] font-semibold text-status-red">Damaged</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          // Clear damage flag
                                          setInBatch((b) => b.map((i) => i.serial === item.serial
                                            ? { ...i, condition: undefined, damageReport: undefined } : i));
                                          if (damageCardSerial === item.serial) setDamageCardSerial(null);
                                        }}
                                        className="text-[11px] text-grey hover:text-status-red underline"
                                      >
                                        remove
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDamageDesc("");
                                        setDamageItemLoc("");
                                        setDamageNoticedLoc("");
                                        setDamageCardSerial(item.serial);
                                      }}
                                      className="px-2.5 py-1 rounded-btn text-[11px] font-semibold border border-grey-mid text-grey hover:border-status-red hover:text-status-red transition-colors"
                                    >
                                      Flag Damaged
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Inline damage report card */}
                              {damageCardSerial === item.serial && (
                                <div className="mx-4 mb-4 bg-status-red/5 border border-status-red/20 rounded-lg p-4 space-y-3">
                                  <p className="text-[12px] font-semibold text-status-red">Damage Report — {item.serial} — {item.type}</p>
                                  <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                      Description <span className="text-status-red">*</span>
                                    </label>
                                    <textarea
                                      rows={3}
                                      autoFocus
                                      value={damageDesc}
                                      onChange={(e) => setDamageDesc(e.target.value)}
                                      placeholder="Describe the damage in detail…"
                                      className="w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-status-red resize-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                      Location on item <span className="text-slate-400 font-normal normal-case">(optional)</span>
                                    </label>
                                    <input
                                      type="text"
                                      value={damageItemLoc}
                                      onChange={(e) => setDamageItemLoc(e.target.value)}
                                      placeholder="e.g. Front lens element, left handle, top panel"
                                      className="w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-status-red"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                      Where was the damage noticed? <span className="text-slate-400 font-normal normal-case">(optional)</span>
                                    </label>
                                    <input
                                      type="text"
                                      value={damageNoticedLoc}
                                      onChange={(e) => setDamageNoticedLoc(e.target.value)}
                                      placeholder="e.g. Stage 7A — Throne Room, loading bay"
                                      className="w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-status-red"
                                    />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => setDamageCardSerial(null)}
                                      className="px-3 py-1.5 rounded-btn text-[12px] text-grey border border-grey-mid hover:bg-grey-light"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!damageDesc.trim()}
                                      onClick={() => {
                                        setInBatch((b) => b.map((i) => i.serial === item.serial
                                          ? { ...i, condition: "damaged", damageReport: {
                                              description:    damageDesc.trim(),
                                              itemLocation:   damageItemLoc.trim(),
                                              damageLocation: damageNoticedLoc.trim(),
                                            }}
                                          : i
                                        ));
                                        setDamageCardSerial(null);
                                      }}
                                      className="px-3 py-1.5 rounded-btn text-[12px] font-semibold bg-status-red text-white disabled:opacity-40"
                                    >
                                      Save Report
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {inBatch.some((i) => i.condition === "damaged") && (
                        <div className="bg-status-red-light border border-status-red/20 rounded-card px-4 py-3 text-[12px] text-status-red">
                          ⚠ Damage reports will be submitted when you confirm the return.
                        </div>
                      )}

                      {inError && (
                        <div className="bg-status-red-light border border-status-red/20 rounded-card px-4 py-3 text-[12px] text-status-red">
                          {inError}
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setInStep("scan")} className="flex-1">← Back</Button>
                        <Button
                          variant="primary" size="lg" className="flex-1"
                          disabled={checkIn.isPending}
                          onClick={handleInConfirm}
                        >
                          {checkIn.isPending ? "Returning…" : `Confirm Return (${inBatch.length})`}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SuccessCard({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-card border border-status-green/30 p-8 text-center">
      <div className="text-4xl mb-3">✅</div>
      <p className="text-[15px] font-semibold text-surface-dark">{message}</p>
      <p className="text-[12px] text-grey mt-1">Dashboard stats will update shortly.</p>
    </div>
  );
}


