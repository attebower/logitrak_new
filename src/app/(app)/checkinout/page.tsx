"use client";

/**
 * Check In / Out page — Sprint 2
 * Uses Echo's ScanArea, BatchList, ModeToggle, LocationPicker components.
 *
 * Check-Out flow: Scan → Location → Confirm
 * Check-In flow:  Scan → Condition → Confirm
 *
 * Audio: TODO Sprint 2 — play Web Audio API cue on successful scan
 * Data:  TODO Sprint 2 — replace mock data with trpc.equipment.search.useQuery() etc.
 */

import { useState } from "react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { ScanArea } from "@/components/shared/ScanArea";
import { BatchList } from "@/components/shared/BatchListItem";
import { ModeToggle } from "@/components/shared/ModeToggle";
import { LocationPicker } from "@/components/shared/LocationPicker";
import { Button } from "@/components/ui/button";
import type { BatchItem } from "@/components/shared/BatchListItem";
import type { CheckMode } from "@/components/shared/ModeToggle";
import type { LocationValue, StudioOption } from "@/components/shared/LocationPicker";

// ── Mock data ──────────────────────────────────────────────────────────────

const MOCK_CHECKED_OUT: BatchItem[] = [
  { serial: "SP-002", type: "Arri SkyPanel S60-C" },
  { serial: "CV-001", type: "Creamsource Vortex8" },
];

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
        sets: [
          { id: "1-2-1", name: "Exterior — Market" },
        ],
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

// Simulated equipment lookup by serial
const MOCK_EQUIPMENT_BY_SERIAL: Record<string, string> = {
  "SP-001": "Arri SkyPanel S60-C",
  "SP-002": "Arri SkyPanel S60-C",
  "SP-003": "Arri SkyPanel S30",
  "AT-001": "Astera Titan Tube",
  "AT-002": "Astera Titan Tube",
  "CV-001": "Creamsource Vortex8",
  "DD-001": "Dedolight DLH4",
  "KF-001": "Kinoflo Freestyle 21",
  "LA-001": "Litepanels Astra 6X",
};

// ── Component ──────────────────────────────────────────────────────────────

type CheckOutStep = "scan" | "location" | "confirm";
type CheckInStep  = "scan" | "condition" | "confirm";

type ConditionChoice = "good" | "needs-attention" | "damaged";

interface BatchItemWithCondition extends BatchItem {
  condition?: ConditionChoice;
}

export default function CheckInOutPage() {
  const [mode, setMode] = useState<CheckMode>("out");

  // Check-out state
  const [outStep,    setOutStep]    = useState<CheckOutStep>("scan");
  const [outBatch,   setOutBatch]   = useState<BatchItem[]>([]);
  const [outLocation, setOutLocation] = useState<LocationValue>({});
  const [outSuccess, setOutSuccess] = useState(false);

  // Check-in state
  const [inStep,    setInStep]    = useState<CheckInStep>("scan");
  const [inBatch,   setInBatch]   = useState<BatchItemWithCondition[]>([]);
  const [inSuccess, setInSuccess] = useState(false);

  // ── Scan handlers ──────────────────────────────────────────────────────

  function handleScan(serial: string) {
    // TODO Sprint 2: validate against trpc.equipment.getBySerial.query()
    // TODO Sprint 2: play Web Audio API confirmation sound on success
    const type = MOCK_EQUIPMENT_BY_SERIAL[serial];
    if (!type) return; // unknown serial — ScanArea could show error state
    addToBatch(serial, type);
  }

  function addToBatch(serial: string, type: string) {
    if (mode === "out") {
      if (outBatch.find((i) => i.serial === serial)) return;
      setOutBatch((b) => [...b, { serial, type, status: "ok" }]);
    } else {
      if (inBatch.find((i) => i.serial === serial)) return;
      // For check-in: only show items that are actually checked out
      if (!MOCK_CHECKED_OUT.find((i) => i.serial === serial)) return;
      setInBatch((b) => [...b, { serial, type, status: "ok" }]);
    }
  }

  // ── Check-out confirm ──────────────────────────────────────────────────

  function handleOutConfirm() {
    // TODO Sprint 2: trpc.checkEvent.create.useMutation()
    setOutSuccess(true);
    setTimeout(() => {
      setOutBatch([]);
      setOutLocation({});
      setOutStep("scan");
      setOutSuccess(false);
    }, 2500);
  }

  // ── Check-in confirm ───────────────────────────────────────────────────

  function handleInConfirm() {
    // TODO Sprint 2: trpc.checkEvent.return.useMutation()
    // TODO Sprint 2: auto-create damage report for items with condition="damaged"
    setInSuccess(true);
    setTimeout(() => {
      setInBatch([]);
      setInStep("scan");
      setInSuccess(false);
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

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar title="Check In / Out" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Mode toggle */}
          <ModeToggle
            mode={mode}
            onChange={(m) => {
              setMode(m);
              setOutStep("scan");
              setInStep("scan");
            }}
          />

          {/* ── CHECK OUT FLOW ── */}
          {mode === "out" && (
            <>
              {outSuccess ? (
                <SuccessCard message={`${outBatch.length} item${outBatch.length !== 1 ? "s" : ""} checked out successfully.`} />
              ) : (
                <>
                  {/* Step 1: Scan */}
                  {outStep === "scan" && (
                    <div className="space-y-4">
                      <ScanArea onScan={handleScan} onManualEntry={handleScan} />
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
                              MOCK_STUDIOS.find((s) => s.id === outLocation.studioId)?.name,
                              MOCK_STUDIOS.find((s) => s.id === outLocation.studioId)
                                ?.stages.find((st) => st.id === outLocation.stageId)?.name,
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

          {/* ── CHECK IN FLOW ── */}
          {mode === "in" && (
            <>
              {inSuccess ? (
                <SuccessCard message={`${inBatch.length} item${inBatch.length !== 1 ? "s" : ""} returned successfully.`} />
              ) : (
                <>
                  {/* Step 1: Scan */}
                  {inStep === "scan" && (
                    <div className="space-y-4">
                      <ScanArea onScan={handleScan} onManualEntry={handleScan} />
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
                          <p className="text-[12px] text-grey mt-0.5">Check each item before confirming return</p>
                        </div>
                        <div className="divide-y divide-grey-mid">
                          {inBatch.map((item) => (
                            <div key={item.serial} className="px-5 py-4 flex items-center gap-4">
                              <div className="flex-1">
                                <span className="text-serial text-surface-dark">{item.serial}</span>
                                <span className="text-[12px] text-grey ml-2">{item.type}</span>
                              </div>
                              <div className="flex gap-2">
                                {(["good", "needs-attention", "damaged"] as ConditionChoice[]).map((c) => (
                                  <button
                                    key={c}
                                    onClick={() =>
                                      setInBatch((b) =>
                                        b.map((i) => i.serial === item.serial ? { ...i, condition: c } : i)
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

function SuccessCard({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-card border border-status-green/30 p-8 text-center">
      <div className="text-4xl mb-3">✅</div>
      <p className="text-[15px] font-semibold text-surface-dark">{message}</p>
    </div>
  );
}
