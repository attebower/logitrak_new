"use client";

import { useState } from "react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// TODO Sprint 2: wire QR scanner + trpc.equipment.search.useQuery()
const MOCK_EQUIPMENT = [
  { id: "1", name: "Arri SkyPanel S60-C",  serial: "SP-001", status: "available"   as const },
  { id: "2", name: "Arri SkyPanel S60-C",  serial: "SP-002", status: "checked-out" as const },
  { id: "3", name: "Astera Titan Tube",    serial: "AT-001", status: "available"   as const },
  { id: "4", name: "Astera Titan Tube",    serial: "AT-002", status: "damaged"     as const },
  { id: "5", name: "Creamsource Vortex8",  serial: "CV-001", status: "checked-out" as const },
  { id: "6", name: "Dedolight DLH4",       serial: "DD-001", status: "available"   as const },
  { id: "7", name: "Kinoflo Freestyle 21", serial: "KF-001", status: "available"   as const },
  { id: "8", name: "Litepanels Astra 6X",  serial: "LA-001", status: "available"   as const },
];

type EquipmentItem = typeof MOCK_EQUIPMENT[number];

// Atlas confirmed position types
const POSITION_OPTIONS = [
  "Inside Prop Make",
  "In Prop Dressing",
  "On Set",
  "Rigged to Outside of Set",
] as const;

type Position = typeof POSITION_OPTIONS[number];

type CheckOutStep = 1 | 2 | 3;
type CheckInStep = 1 | 2;
type Condition = "Good" | "Needs Attention" | "Damaged";

// ─── Check-Out Flow ──────────────────────────────────────────────────────────

function CheckOutFlow() {
  const [step, setStep]     = useState<CheckOutStep>(1);
  const [search, setSearch] = useState("");
  const [batch, setBatch]   = useState<EquipmentItem[]>([]);
  const [success, setSuccess] = useState(false);

  // Step 2 fields
  const [position, setPosition]         = useState<Position | "">("");
  const [exactLocation, setExactLocation] = useState("");
  const [production, setProduction]     = useState("");
  const [studio, setStudio]             = useState("");
  const [stage, setStage]               = useState("");
  const [set, setSet]                   = useState("");

  const showExactLocation =
    position === "Inside Prop Make" || position === "In Prop Dressing";

  const step2Valid =
    position !== "" &&
    (!showExactLocation || exactLocation.trim() !== "");

  const searchResults = search.trim()
    ? MOCK_EQUIPMENT.filter(
        (e) =>
          (e.name.toLowerCase().includes(search.toLowerCase()) ||
            e.serial.toLowerCase().includes(search.toLowerCase())) &&
          !batch.find((b) => b.id === e.id)
      )
    : [];

  function addToBatch(item: EquipmentItem) {
    setBatch((prev) => [...prev, item]);
    // TODO Sprint 2: play confirmation sound via Web Audio API on scan success
  }

  function removeFromBatch(id: string) {
    setBatch((prev) => prev.filter((b) => b.id !== id));
  }

  function reset() {
    setStep(1);
    setSearch("");
    setBatch([]);
    setPosition("");
    setExactLocation("");
    setProduction("");
    setStudio("");
    setStage("");
    setSet("");
    setSuccess(false);
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-[18px] font-bold text-surface-dark mb-2">Check Out Complete</h2>
        <p className="text-[13px] text-grey mb-6">{batch.length} item{batch.length !== 1 ? "s" : ""} checked out successfully.</p>
        <Button variant="primary" onClick={reset}>Check Out More Equipment</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-6">
        {([1, 2, 3] as CheckOutStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div className={[
              "w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold",
              step === s
                ? "bg-brand-blue text-white"
                : step > s
                  ? "bg-status-green text-white"
                  : "bg-grey-mid text-grey",
            ].join(" ")}>
              {step > s ? "✓" : s}
            </div>
            <span className={["text-[12px] font-medium", step >= s ? "text-surface-dark" : "text-grey"].join(" ")}>
              {s === 1 ? "Scan / Search" : s === 2 ? "Location" : "Confirm"}
            </span>
            {i < 2 && <div className="w-8 h-px bg-grey-mid" />}
          </div>
        ))}
      </div>

      {/* Step 1: Scan / Search */}
      {step === 1 && (
        <div className="bg-white rounded-card border border-grey-mid shadow-card p-6">
          <h2 className="text-[15px] font-bold text-surface-dark mb-4">Scan / Search Equipment</h2>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Scan QR code or search by serial/name"
            className="w-full rounded-btn border border-grey-mid bg-white px-3 py-2 text-[13px] text-surface-dark placeholder:text-grey focus:outline-none focus:ring-2 focus:ring-brand-blue/30 mb-3"
          />

          {searchResults.length > 0 && (
            <div className="border border-grey-mid rounded-btn divide-y divide-grey-mid mb-4">
              {searchResults.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-[13px] font-medium text-surface-dark">{item.name}</p>
                    <p className="text-[11px] text-grey font-mono">{item.serial}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.status}>
                      {item.status === "checked-out" ? "Checked Out" : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Badge>
                    <Button variant="secondary" size="sm" onClick={() => addToBatch(item)}>
                      Add to batch
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Batch tray */}
          {batch.length > 0 && (
            <div className="mb-4 border border-brand-blue/20 bg-brand-blue-light rounded-btn p-3">
              <p className="text-[11px] font-semibold text-brand-blue uppercase mb-2">Batch ({batch.length})</p>
              <div className="flex flex-wrap gap-2">
                {batch.map((item) => (
                  <div key={item.id} className="flex items-center gap-1.5 bg-white rounded-badge px-2 py-1 border border-grey-mid text-[12px]">
                    <span className="font-medium text-surface-dark">{item.name}</span>
                    <span className="text-grey font-mono">{item.serial}</span>
                    <button
                      onClick={() => removeFromBatch(item.id)}
                      className="text-grey hover:text-status-red transition-colors ml-0.5"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            variant="primary"
            className="w-full"
            disabled={batch.length === 0}
            onClick={() => setStep(2)}
          >
            Continue
          </Button>
        </div>
      )}

      {/* Step 2: Location */}
      {step === 2 && (
        <div className="bg-white rounded-card border border-grey-mid shadow-card p-6">
          <h2 className="text-[15px] font-bold text-surface-dark mb-4">Where is this equipment going?</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase text-grey mb-1.5">Position</label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as Position)}
                className="w-full rounded-btn border border-grey-mid bg-white px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              >
                <option value="" disabled>Select position…</option>
                {POSITION_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {showExactLocation && (
              <div>
                <label className="block text-[11px] font-semibold uppercase text-grey mb-1.5">
                  Exact Location <span className="text-status-red">*</span>
                </label>
                <input
                  type="text"
                  value={exactLocation}
                  onChange={(e) => setExactLocation(e.target.value)}
                  placeholder="e.g. Rack 3, shelf 2 / drawer B"
                  className="w-full rounded-btn border border-grey-mid bg-white px-3 py-2 text-[13px] text-surface-dark placeholder:text-grey focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold uppercase text-grey mb-1.5">Production</label>
              <input
                type="text"
                value={production}
                onChange={(e) => setProduction(e.target.value)}
                placeholder="Production name"
                className="w-full rounded-btn border border-grey-mid bg-white px-3 py-2 text-[13px] text-surface-dark placeholder:text-grey focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase text-grey mb-1.5">Studio</label>
              <input
                type="text"
                value={studio}
                onChange={(e) => setStudio(e.target.value)}
                placeholder="Studio name"
                className="w-full rounded-btn border border-grey-mid bg-white px-3 py-2 text-[13px] text-surface-dark placeholder:text-grey focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase text-grey mb-1.5">Stage / Location</label>
              <input
                type="text"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                placeholder="Stage or location"
                className="w-full rounded-btn border border-grey-mid bg-white px-3 py-2 text-[13px] text-surface-dark placeholder:text-grey focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase text-grey mb-1.5">Set</label>
              <input
                type="text"
                value={set}
                onChange={(e) => setSet(e.target.value)}
                placeholder="Set name"
                className="w-full rounded-btn border border-grey-mid bg-white px-3 py-2 text-[13px] text-surface-dark placeholder:text-grey focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button
              variant="primary"
              className="flex-1"
              disabled={!step2Valid}
              onClick={() => setStep(3)}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="bg-white rounded-card border border-grey-mid shadow-card p-6">
          <h2 className="text-[15px] font-bold text-surface-dark mb-4">Confirm Check Out</h2>

          <div className="space-y-3 mb-6">
            <div className="rounded-btn border border-grey-mid p-3">
              <p className="text-[11px] font-semibold uppercase text-grey mb-2">Items ({batch.length})</p>
              <div className="space-y-1.5">
                {batch.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-surface-dark">{item.name}</span>
                    <span className="text-[12px] text-grey font-mono">{item.serial}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-btn border border-grey-mid p-3">
              <p className="text-[11px] font-semibold uppercase text-grey mb-1">Destination</p>
              <p className="text-[13px] text-surface-dark">{position}</p>
              {exactLocation && <p className="text-[12px] text-grey mt-0.5">{exactLocation}</p>}
              {production && <p className="text-[12px] text-grey mt-0.5">Production: {production}</p>}
              {stage && <p className="text-[12px] text-grey mt-0.5">Stage: {stage}</p>}
            </div>

            <div className="rounded-btn border border-grey-mid p-3">
              <p className="text-[11px] font-semibold uppercase text-grey mb-1">Checked Out By</p>
              <p className="text-[13px] text-surface-dark">Current user</p>
            </div>
          </div>

          {/* TODO Sprint 2: trpc.checkEvent.create.useMutation() */}
          <Button
            variant="primary"
            size="lg"
            className="w-full mb-3"
            onClick={() => setSuccess(true)}
          >
            Confirm Check Out
          </Button>

          <button
            onClick={() => setStep(2)}
            className="w-full text-center text-[13px] text-grey hover:text-surface-dark transition-colors"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Check-In Flow ───────────────────────────────────────────────────────────

type ConditionMap = Record<string, Condition>;

function CheckInFlow() {
  const [step, setStep]     = useState<CheckInStep>(1);
  const [search, setSearch] = useState("");
  const [batch, setBatch]   = useState<EquipmentItem[]>([]);
  const [conditions, setConditions] = useState<ConditionMap>({});
  const [success, setSuccess] = useState(false);

  const checkedOutItems = MOCK_EQUIPMENT.filter((e) => e.status === "checked-out");

  const searchResults = search.trim()
    ? checkedOutItems.filter(
        (e) =>
          (e.name.toLowerCase().includes(search.toLowerCase()) ||
            e.serial.toLowerCase().includes(search.toLowerCase())) &&
          !batch.find((b) => b.id === e.id)
      )
    : [];

  function addToBatch(item: EquipmentItem) {
    setBatch((prev) => [...prev, item]);
    setConditions((prev) => ({ ...prev, [item.id]: "Good" }));
  }

  function removeFromBatch(id: string) {
    setBatch((prev) => prev.filter((b) => b.id !== id));
    setConditions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const anyDamaged = Object.values(conditions).some((c) => c === "Damaged");

  function reset() {
    setStep(1);
    setSearch("");
    setBatch([]);
    setConditions({});
    setSuccess(false);
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-[18px] font-bold text-surface-dark mb-2">Return Complete</h2>
        <p className="text-[13px] text-grey mb-6">{batch.length} item{batch.length !== 1 ? "s" : ""} returned successfully.</p>
        <Button variant="primary" onClick={reset}>Check In More Equipment</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-6">
        {([1, 2] as CheckInStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div className={[
              "w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold",
              step === s
                ? "bg-brand-blue text-white"
                : step > s
                  ? "bg-status-green text-white"
                  : "bg-grey-mid text-grey",
            ].join(" ")}>
              {step > s ? "✓" : s}
            </div>
            <span className={["text-[12px] font-medium", step >= s ? "text-surface-dark" : "text-grey"].join(" ")}>
              {s === 1 ? "Scan / Search" : "Confirm"}
            </span>
            {i < 1 && <div className="w-8 h-px bg-grey-mid" />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="bg-white rounded-card border border-grey-mid shadow-card p-6">
          <h2 className="text-[15px] font-bold text-surface-dark mb-1">Scan / Search Equipment</h2>
          <p className="text-[12px] text-grey mb-4">Only showing items currently checked out.</p>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Scan QR code or search by serial/name"
            className="w-full rounded-btn border border-grey-mid bg-white px-3 py-2 text-[13px] text-surface-dark placeholder:text-grey focus:outline-none focus:ring-2 focus:ring-brand-blue/30 mb-3"
          />

          {searchResults.length > 0 && (
            <div className="border border-grey-mid rounded-btn divide-y divide-grey-mid mb-4">
              {searchResults.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-[13px] font-medium text-surface-dark">{item.name}</p>
                    <p className="text-[11px] text-grey font-mono">{item.serial}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="checked-out">Checked Out</Badge>
                    <Button variant="secondary" size="sm" onClick={() => addToBatch(item)}>
                      Add to batch
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {batch.length > 0 && (
            <div className="mb-4 border border-brand-blue/20 bg-brand-blue-light rounded-btn p-3">
              <p className="text-[11px] font-semibold text-brand-blue uppercase mb-2">Batch ({batch.length})</p>
              <div className="flex flex-wrap gap-2">
                {batch.map((item) => (
                  <div key={item.id} className="flex items-center gap-1.5 bg-white rounded-badge px-2 py-1 border border-grey-mid text-[12px]">
                    <span className="font-medium text-surface-dark">{item.name}</span>
                    <span className="text-grey font-mono">{item.serial}</span>
                    <button
                      onClick={() => removeFromBatch(item.id)}
                      className="text-grey hover:text-status-red transition-colors ml-0.5"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            variant="primary"
            className="w-full"
            disabled={batch.length === 0}
            onClick={() => setStep(2)}
          >
            Continue
          </Button>
        </div>
      )}

      {/* Step 2: Confirm */}
      {step === 2 && (
        <div className="bg-white rounded-card border border-grey-mid shadow-card p-6">
          <h2 className="text-[15px] font-bold text-surface-dark mb-4">Confirm Return</h2>

          <div className="space-y-3 mb-4">
            {batch.map((item) => (
              <div key={item.id} className="rounded-btn border border-grey-mid p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[13px] font-medium text-surface-dark">{item.name}</p>
                    <p className="text-[11px] text-grey font-mono">{item.serial}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-grey mb-1.5">Condition</p>
                  <div className="flex gap-2">
                    {(["Good", "Needs Attention", "Damaged"] as Condition[]).map((c) => (
                      <button
                        key={c}
                        onClick={() => setConditions((prev) => ({ ...prev, [item.id]: c }))}
                        className={[
                          "rounded-btn px-3 py-1 text-[12px] font-semibold border transition-colors",
                          conditions[item.id] === c
                            ? c === "Damaged"
                              ? "bg-status-red text-white border-status-red"
                              : c === "Needs Attention"
                                ? "bg-status-amber text-white border-status-amber"
                                : "bg-status-green text-white border-status-green"
                            : "bg-white border-grey-mid text-grey hover:border-surface-dark3",
                        ].join(" ")}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {anyDamaged && (
            <div className="flex items-start gap-2 rounded-btn bg-status-red-light border border-status-red/20 px-3 py-2.5 mb-4">
              <span className="text-status-red text-[13px]">⚠</span>
              <p className="text-[12px] text-status-red">A damage report will be created automatically for items marked as Damaged.</p>
            </div>
          )}

          {/* TODO Sprint 2: trpc.checkEvent.return.useMutation() */}
          <Button
            variant="primary"
            size="lg"
            className="w-full mb-3"
            onClick={() => setSuccess(true)}
          >
            Confirm Return
          </Button>

          <button
            onClick={() => setStep(1)}
            className="w-full text-center text-[13px] text-grey hover:text-surface-dark transition-colors"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type ActiveTab = "checkout" | "checkin";

export default function CheckInOutPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("checkout");

  return (
    <>
      <AppTopbar title="Check In / Out" />
      <div className="flex-1 overflow-y-auto p-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-grey-mid p-1 rounded-btn w-fit mb-6">
          <button
            onClick={() => setActiveTab("checkout")}
            className={[
              "rounded-btn px-4 py-1.5 text-[13px] font-semibold transition-colors",
              activeTab === "checkout"
                ? "bg-white text-surface-dark shadow-sm"
                : "text-grey hover:text-surface-dark",
            ].join(" ")}
          >
            Check Out
          </button>
          <button
            onClick={() => setActiveTab("checkin")}
            className={[
              "rounded-btn px-4 py-1.5 text-[13px] font-semibold transition-colors",
              activeTab === "checkin"
                ? "bg-white text-surface-dark shadow-sm"
                : "text-grey hover:text-surface-dark",
            ].join(" ")}
          >
            Check In
          </button>
        </div>

        {activeTab === "checkout" ? <CheckOutFlow /> : <CheckInFlow />}
      </div>
    </>
  );
}
