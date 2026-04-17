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
import type { LocationValue, StudioOption } from "@/components/shared/LocationPicker";

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
interface BatchEntryWithCondition extends BatchEntry {
  condition?: ConditionChoice;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function CheckInOutPage() {
  const { workspaceId, userRole } = useWorkspace();
  const isManager = ["owner", "admin", "manager"].includes(userRole);

  const [mode,       setMode]       = useState<CheckMode>("out");

  // Check-out state
  const [outStep,     setOutStep]     = useState<CheckOutStep>("scan");
  const [outBatch,    setOutBatch]    = useState<BatchEntry[]>([]);
  const [outLocation, setOutLocation] = useState<LocationValue>({});
  const [forceOut,    setForceOut]    = useState(false);
  const [outError,    setOutError]    = useState<string | null>(null);

  // Check-in state
  const [inStep,  setInStep]  = useState<CheckInStep>("scan");
  const [inBatch, setInBatch] = useState<BatchEntryWithCondition[]>([]);
  const [inError, setInError] = useState<string | null>(null);

  // Scan state
  const [warnings,    setWarnings]    = useState<ScanWarning[]>([]);
  const [scanSearch,  setScanSearch]  = useState("");

  // ── Live data ─────────────────────────────────────────────────────────

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
    onSuccess: () => {
      setOutBatch([]);
      setOutLocation({});
      setOutStep("scan");
      setOutError(null);
      setForceOut(false);
    },
    onError: (err) => setOutError(err.message),
  });

  const checkIn = trpc.checkEvent.checkIn.useMutation({
    onSuccess: () => {
      setInBatch([]);
      setInStep("scan");
      setInError(null);
    },
    onError: (err) => setInError(err.message),
  });

  // ── Scan handler ──────────────────────────────────────────────────────

  const handleScan = useCallback((serial: string) => {
    const currentBatch = mode === "out" ? outBatch : inBatch;

    // Client-side duplicate check
    if (currentBatch.find((i) => i.serial === serial)) {
      addWarning({ serial, kind: "duplicate", message: `${serial} is already in the batch.` });
      return;
    }

    // Look up in search results or trigger a search
    const match = searchResults?.items.find(
      (i) => i.serial.toUpperCase() === serial.toUpperCase()
    );

    if (!match) {
      // Try setting the search to trigger a query
      setScanSearch(serial);
      addWarning({ serial, kind: "unknown", message: `${serial} not found — searching…` });
      return;
    }

    // Client-side damage pre-flight
    if (match.damageStatus === "damaged" || match.damageStatus === "under_repair") {
      addWarning({
        serial,
        kind: "damaged",
        message: `${serial} is ${match.damageStatus.replace("_", " ")} and cannot be checked ${mode === "out" ? "out" : "in"}.`,
      });
      return;
    }

    // Mode-specific state warning
    if (mode === "out" && match.status === "checked_out" && !forceOut) {
      addWarning({
        serial,
        kind: "wrong-state",
        message: isManager
          ? `${serial} is already checked out. Enable force check-out to override.`
          : `${serial} is already checked out.`,
      });
      return;
    }
    if (mode === "in" && match.status !== "checked_out") {
      addWarning({
        serial,
        kind: "wrong-state",
        message: `${serial} is not currently checked out.`,
      });
      return;
    }

    clearWarning(serial);

    const entry: BatchEntry = {
      serial:      match.serial,
      type:        match.name,
      status:      "ok" as BatchItemStatus,
      equipmentId: match.id,
    };

    if (mode === "out") setOutBatch((b) => [...b, entry]);
    else                setInBatch((b) => [...b, entry]);
  }, [mode, outBatch, inBatch, searchResults, forceOut, isManager]);

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

  function handleInConfirm() {
    const damagedItems = inBatch.filter((i) => i.condition === "damaged");

    checkIn.mutate(
      {
        workspaceId,
        equipmentIds: inBatch.map((i) => i.equipmentId),
      },
      {
        onSuccess: () => {
          // Auto-create damage reports for items flagged as damaged during check-in
          for (const item of damagedItems) {
            createDamageReport.mutate({
              workspaceId,
              equipmentId:  item.equipmentId,
              description:  `Damage noticed on check-in for ${item.serial}`,
            });
          }
        },
      }
    );
  }

  // ── Location validation ────────────────────────────────────────────────

  const locationComplete =
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
                <SuccessCard message={`${outBatch.length} item${outBatch.length !== 1 ? "s" : ""} checked out successfully.`} />
              ) : (
                <>
                  {/* Step 1: Scan */}
                  {outStep === "scan" && (
                    <div className="space-y-4">
                      <div className="lg:hidden"><ScanArea onScan={handleScan} onManualEntry={handleScan} /></div>

                      {/* Manual search */}
                      <div className="relative">
                        <input
                          type="search"
                          placeholder="Or search by name / serial…"
                          value={scanSearch}
                          onChange={(e) => setScanSearch(e.target.value)}
                          className="w-full bg-white border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
                        />
                        {scanSearch.length >= 2 && searchResults && searchResults.items.length > 0 && (
                          <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-grey-mid rounded-card shadow-card overflow-hidden">
                            {searchResults.items.slice(0, 6).map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  handleScan(item.serial);
                                  setScanSearch("");
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-grey-light border-b border-grey-mid last:border-b-0"
                              >
                                <span className="text-serial text-surface-dark">{item.serial}</span>
                                <span className="text-[12px] text-grey flex-1">{item.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Scan warnings */}
                      <ScanWarningList warnings={warnings} onDismiss={(serial) => clearWarning(serial)} />

                      {/* Force checkout toggle (manager+) */}
                      {isManager && (
                        <label className="flex items-center gap-2.5 text-[12px] text-grey cursor-pointer">
                          <input
                            type="checkbox"
                            checked={forceOut}
                            onChange={(e) => setForceOut(e.target.checked)}
                            className="w-3.5 h-3.5"
                          />
                          Force check-out (override already-checked-out items)
                        </label>
                      )}

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
                          production="Series 4 — Episode 7"
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
                        {forceOut && (
                          <p className="text-[11px] text-status-amber">
                            ⚠ Force check-out enabled — some items may already be checked out.
                          </p>
                        )}
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
                <SuccessCard message={`${inBatch.length} item${inBatch.length !== 1 ? "s" : ""} returned successfully.`} />
              ) : (
                <>
                  {/* Step 1: Scan */}
                  {inStep === "scan" && (
                    <div className="space-y-4">
                      <div className="lg:hidden"><ScanArea onScan={handleScan} onManualEntry={handleScan} /></div>

                      <div className="relative">
                        <input
                          type="search"
                          placeholder="Or search by name / serial…"
                          value={scanSearch}
                          onChange={(e) => setScanSearch(e.target.value)}
                          className="w-full bg-white border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
                        />
                        {scanSearch.length >= 2 && searchResults && searchResults.items.length > 0 && (
                          <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-grey-mid rounded-card shadow-card overflow-hidden">
                            {searchResults.items.filter((i) => i.status === "checked_out").slice(0, 6).map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => { handleScan(item.serial); setScanSearch(""); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-grey-light border-b border-grey-mid last:border-b-0"
                              >
                                <span className="text-serial text-surface-dark">{item.serial}</span>
                                <span className="text-[12px] text-grey flex-1">{item.name}</span>
                              </button>
                            ))}
                          </div>
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
                          <p className="text-[12px] text-grey mt-0.5">Check each item before confirming return</p>
                        </div>
                        <div className="divide-y divide-grey-mid">
                          {inBatch.map((item) => (
                            <div key={item.serial} className="px-5 py-4 flex items-center gap-4 flex-wrap">
                              <div className="flex-1 min-w-[120px]">
                                <span className="text-serial text-surface-dark">{item.serial}</span>
                                <span className="text-[12px] text-grey ml-2">{item.type}</span>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                {(["good", "needs-attention", "damaged"] as ConditionChoice[]).map((c) => (
                                  <button
                                    key={c} type="button"
                                    onClick={() =>
                                      setInBatch((b) =>
                                        b.map((i) => i.serial === item.serial ? { ...i, condition: c } : i)
                                      )
                                    }
                                    className={[
                                      "px-2.5 py-1 rounded-btn text-[11px] font-semibold border transition-colors",
                                      item.condition === c
                                        ? c === "good" ? "bg-status-green text-white border-status-green"
                                          : c === "needs-attention" ? "bg-status-amber text-white border-status-amber"
                                          : "bg-status-red text-white border-status-red"
                                        : "bg-white text-grey border-grey-mid hover:border-grey",
                                    ].join(" ")}
                                  >
                                    {c === "good" ? "Good" : c === "needs-attention" ? "Needs Attention" : "Damaged"}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {inBatch.some((i) => i.condition === "damaged") && (
                        <div className="bg-status-red-light border border-status-red/20 rounded-card px-4 py-3 text-[12px] text-status-red">
                          ⚠ A damage report will be created automatically for damaged items.
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
                          disabled={inBatch.some((i) => !i.condition) || checkIn.isPending}
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


