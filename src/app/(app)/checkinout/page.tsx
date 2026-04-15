"use client";

/**
 * Check In / Out page — Sprint 2
 *
 * QR scanning: react-qr-barcode-scanner via ScanArea.onScan
 * Audio: Web Audio beep (in ScanArea on successful scan)
 * Batch: add/remove/clear items
 * Validation: damaged → reject, duplicate → warn, wrong-state → amber warning
 * Location: LocationPicker (cascading dropdowns, exactLocationDescription conditional)
 *
 * tRPC stubs — wire when Sage's routers land:
 *   - trpc.location.studio.list
 *   - trpc.location.stage.list
 *   - trpc.location.set.list
 *   - trpc.checkEvent.checkOut (batch)
 *   - trpc.checkEvent.checkIn
 *   - trpc.equipment.getBySerial
 */

import { useState, useCallback } from "react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { ScanArea } from "@/components/shared/ScanArea";
import { BatchList } from "@/components/shared/BatchListItem";
import { ModeToggle } from "@/components/shared/ModeToggle";
import { LocationPicker } from "@/components/shared/LocationPicker";
import { Button } from "@/components/ui/button";
import type { BatchItem, BatchItemStatus } from "@/components/shared/BatchListItem";
import type { CheckMode } from "@/components/shared/ModeToggle";
import type { LocationValue, StudioOption } from "@/components/shared/LocationPicker";

// ── Mock equipment store — replace with trpc.equipment.getBySerial ─────────

type EquipmentRecord = {
  serial: string;
  type: string;
  status: "available" | "checked-out" | "damaged" | "repaired" | "under-repair";
};

const MOCK_EQUIPMENT: Record<string, EquipmentRecord> = {
  "SP-001": { serial: "SP-001", type: "Arri SkyPanel S60-C",  status: "available" },
  "SP-002": { serial: "SP-002", type: "Arri SkyPanel S60-C",  status: "checked-out" },
  "SP-003": { serial: "SP-003", type: "Arri SkyPanel S30",    status: "under-repair" },
  "AT-001": { serial: "AT-001", type: "Astera Titan Tube",    status: "available" },
  "AT-002": { serial: "AT-002", type: "Astera Titan Tube",    status: "damaged" },
  "CV-001": { serial: "CV-001", type: "Creamsource Vortex8",  status: "checked-out" },
  "DD-001": { serial: "DD-001", type: "Dedolight DLH4",       status: "available" },
  "KF-001": { serial: "KF-001", type: "Kinoflo Freestyle 21", status: "available" },
  "LA-001": { serial: "LA-001", type: "Litepanels Astra 6X",  status: "available" },
};

// ── Mock location data — replace with trpc.location.studio.list ───────────

const MOCK_STUDIOS: StudioOption[] = [
  {
    id: "1",
    name: "Pinewood — Stage 7",
    stages: [
      {
        id: "1-1",
        name: "Stage 7A",
        sets: [
          { id: "1-1-1", name: "Throne Room" },
          { id: "1-1-2", name: "Corridor B" },
        ],
      },
      {
        id: "1-2",
        name: "Stage 7B",
        sets: [{ id: "1-2-1", name: "Exterior — Market" }],
      },
    ],
  },
  {
    id: "2",
    name: "Shepperton — Stage 3",
    stages: [
      {
        id: "2-1",
        name: "Stage 3 Main",
        sets: [{ id: "2-1-1", name: "Castle Hall" }],
      },
    ],
  },
];

// ── Scan validation ────────────────────────────────────────────────────────

type ScanWarning = {
  serial: string;
  kind: "duplicate" | "damaged" | "wrong-state" | "unknown";
  message: string;
};

function validateScan(
  serial: string,
  mode: CheckMode,
  batch: BatchItem[]
): { ok: boolean; warning?: ScanWarning; item?: EquipmentRecord } {
  // Duplicate in batch
  if (batch.find((i) => i.serial === serial)) {
    return {
      ok: false,
      warning: { serial, kind: "duplicate", message: `${serial} is already in the batch.` },
    };
  }

  const equipment = MOCK_EQUIPMENT[serial]; // TODO: trpc.equipment.getBySerial

  // Unknown serial
  if (!equipment) {
    return {
      ok: false,
      warning: { serial, kind: "unknown", message: `Serial ${serial} not found in this workspace.` },
    };
  }

  // Damaged — always reject
  if (equipment.status === "damaged" || equipment.status === "under-repair") {
    return {
      ok: false,
      warning: {
        serial,
        kind: "damaged",
        message: `${serial} is ${equipment.status.replace("-", " ")} — cannot be checked out or in.`,
      },
    };
  }

  // Mode-specific state checks
  if (mode === "out" && equipment.status !== "available") {
    return {
      ok: false,
      warning: {
        serial,
        kind: "wrong-state",
        message: `${serial} is already checked out.`,
      },
    };
  }

  if (mode === "in" && equipment.status !== "checked-out") {
    return {
      ok: false,
      warning: {
        serial,
        kind: "wrong-state",
        message: `${serial} is not currently checked out.`,
      },
    };
  }

  return { ok: true, item: equipment };
}

// ── Types ─────────────────────────────────────────────────────────────────

type CheckOutStep = "scan" | "location" | "confirm";
type CheckInStep  = "scan" | "condition" | "confirm";
type ConditionChoice = "good" | "needs-attention" | "damaged";

interface BatchItemWithCondition extends BatchItem {
  condition?: ConditionChoice;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function CheckInOutPage() {
  const [mode, setMode] = useState<CheckMode>("out");

  // Check-out state
  const [outStep,      setOutStep]      = useState<CheckOutStep>("scan");
  const [outBatch,     setOutBatch]     = useState<BatchItem[]>([]);
  const [outLocation,  setOutLocation]  = useState<LocationValue>({});
  const [outSuccess,   setOutSuccess]   = useState(false);

  // Check-in state
  const [inStep,    setInStep]    = useState<CheckInStep>("scan");
  const [inBatch,   setInBatch]   = useState<BatchItemWithCondition[]>([]);
  const [inSuccess, setInSuccess] = useState(false);

  // Scan warnings (shown below ScanArea)
  const [warnings, setWarnings] = useState<ScanWarning[]>([]);

  // ── Scan handler ───────────────────────────────────────────────────────

  const handleScan = useCallback((serial: string) => {
    const currentBatch = mode === "out" ? outBatch : inBatch;
    const { ok, warning, item } = validateScan(serial, mode, currentBatch);

    if (!ok && warning) {
      setWarnings((prev) => {
        // Replace any existing warning for this serial
        const filtered = prev.filter((w) => w.serial !== serial);
        return [warning, ...filtered].slice(0, 3); // max 3 warnings visible
      });
      return;
    }

    if (!item) return;

    // Clear any warning for this serial on success
    setWarnings((prev) => prev.filter((w) => w.serial !== serial));

    const batchItem: BatchItem = {
      serial: item.serial,
      type: item.type,
      status: "ok" as BatchItemStatus,
    };

    if (mode === "out") {
      setOutBatch((b) => [...b, batchItem]);
    } else {
      setInBatch((b) => [...b, batchItem]);
    }
  }, [mode, outBatch, inBatch]);

  // ── Check-out confirm ──────────────────────────────────────────────────

  function handleOutConfirm() {
    // TODO Sprint 2: trpc.checkEvent.checkOut.mutate({ items: outBatch, location: outLocation })
    setOutSuccess(true);
    setTimeout(() => {
      setOutBatch([]);
      setOutLocation({});
      setOutStep("scan");
      setOutSuccess(false);
      setWarnings([]);
    }, 2500);
  }

  // ── Check-in confirm ───────────────────────────────────────────────────

  function handleInConfirm() {
    // TODO Sprint 2: trpc.checkEvent.checkIn.mutate({ items: inBatch })
    // TODO Sprint 2: auto-create damage report for items with condition="damaged"
    setInSuccess(true);
    setTimeout(() => {
      setInBatch([]);
      setInStep("scan");
      setInSuccess(false);
      setWarnings([]);
    }, 2500);
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

  // ── Helpers ────────────────────────────────────────────────────────────

  function studioName(id?: string) {
    return MOCK_STUDIOS.find((s) => s.id === id)?.name ?? "";
  }
  function stageName(studioId?: string, stageId?: string) {
    return MOCK_STUDIOS.find((s) => s.id === studioId)
      ?.stages.find((st) => st.id === stageId)?.name ?? "";
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar title="Check In / Out" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Mode toggle (disabled mid-flow) */}
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
              {outSuccess ? (
                <SuccessCard
                  message={`${outBatch.length} item${outBatch.length !== 1 ? "s" : ""} checked out successfully.`}
                />
              ) : (
                <>
                  {/* Step 1: Scan */}
                  {outStep === "scan" && (
                    <div className="space-y-4">
                      <ScanArea onScan={handleScan} onManualEntry={handleScan} />

                      {/* Scan warnings */}
                      {warnings.length > 0 && (
                        <div className="space-y-2">
                          {warnings.map((w) => (
                            <ScanWarningBanner key={w.serial} warning={w} onDismiss={() =>
                              setWarnings((p) => p.filter((x) => x.serial !== w.serial))
                            } />
                          ))}
                        </div>
                      )}

                      <BatchList
                        items={outBatch}
                        onRemove={(s) => setOutBatch((b) => b.filter((i) => i.serial !== s))}
                        onClear={() => setOutBatch([])}
                      />
                      <Button
                        variant="primary"
                        size="lg"
                        className="w-full"
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
                          studios={MOCK_STUDIOS}
                          value={outLocation}
                          onChange={setOutLocation}
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setOutStep("scan")} className="flex-1">
                          ← Back
                        </Button>
                        <Button
                          variant="primary"
                          disabled={!locationComplete}
                          onClick={() => setOutStep("confirm")}
                          className="flex-1"
                        >
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
                          <p className="text-caption text-grey uppercase mb-2">
                            Items ({outBatch.length})
                          </p>
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
                              stageName(outLocation.studioId, outLocation.stageId),
                              outLocation.positionType,
                              outLocation.exactLocationDescription,
                            ]
                              .filter(Boolean)
                              .join(" → ")}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setOutStep("location")} className="flex-1">
                          ← Back
                        </Button>
                        <Button variant="primary" size="lg" onClick={handleOutConfirm} className="flex-1">
                          Confirm Check Out ({outBatch.length})
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
              {inSuccess ? (
                <SuccessCard
                  message={`${inBatch.length} item${inBatch.length !== 1 ? "s" : ""} returned successfully.`}
                />
              ) : (
                <>
                  {/* Step 1: Scan */}
                  {inStep === "scan" && (
                    <div className="space-y-4">
                      <ScanArea onScan={handleScan} onManualEntry={handleScan} />

                      {warnings.length > 0 && (
                        <div className="space-y-2">
                          {warnings.map((w) => (
                            <ScanWarningBanner key={w.serial} warning={w} onDismiss={() =>
                              setWarnings((p) => p.filter((x) => x.serial !== w.serial))
                            } />
                          ))}
                        </div>
                      )}

                      <BatchList
                        items={inBatch}
                        onRemove={(s) => setInBatch((b) => b.filter((i) => i.serial !== s))}
                        onClear={() => setInBatch([])}
                      />
                      <Button
                        variant="primary"
                        size="lg"
                        className="w-full"
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
                          <p className="text-[12px] text-grey mt-0.5">
                            Check each item before confirming return
                          </p>
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
                                    key={c}
                                    type="button"
                                    onClick={() =>
                                      setInBatch((b) =>
                                        b.map((i) =>
                                          i.serial === item.serial ? { ...i, condition: c } : i
                                        )
                                      )
                                    }
                                    className={[
                                      "px-2.5 py-1 rounded-btn text-[11px] font-semibold border transition-colors",
                                      item.condition === c
                                        ? c === "good"
                                          ? "bg-status-green text-white border-status-green"
                                          : c === "needs-attention"
                                          ? "bg-status-amber text-white border-status-amber"
                                          : "bg-status-red text-white border-status-red"
                                        : "bg-white text-grey border-grey-mid hover:border-grey",
                                    ].join(" ")}
                                  >
                                    {c === "good"
                                      ? "Good"
                                      : c === "needs-attention"
                                      ? "Needs Attention"
                                      : "Damaged"}
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

                      <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setInStep("scan")} className="flex-1">
                          ← Back
                        </Button>
                        <Button
                          variant="primary"
                          size="lg"
                          disabled={inBatch.some((i) => !i.condition)}
                          onClick={handleInConfirm}
                          className="flex-1"
                        >
                          Confirm Return ({inBatch.length})
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
    </div>
  );
}

const warningStyles: Record<ScanWarning["kind"], string> = {
  duplicate:    "bg-grey-light border-grey-mid text-grey",
  damaged:      "bg-status-red-light border-status-red/20 text-status-red",
  "wrong-state": "bg-status-amber-light border-status-amber/20 text-status-amber",
  unknown:      "bg-grey-light border-grey-mid text-grey",
};

function ScanWarningBanner({
  warning,
  onDismiss,
}: {
  warning: ScanWarning;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-card border text-[12px] font-medium ${warningStyles[warning.kind]}`}
    >
      <span className="flex-1">{warning.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-inherit opacity-60 hover:opacity-100 text-base leading-none"
        aria-label="Dismiss warning"
      >
        ×
      </button>
    </div>
  );
}
