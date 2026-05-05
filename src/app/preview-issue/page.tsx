"use client";

/**
 * Lighter polish preview of /issue. Three working touches:
 *   1. Live status chip in the topbar (Scanning · N / Awaiting destination / Ready · N)
 *   2. Most-recent-scan row flashes brand-blue for 600ms when added
 *   3. Sticky confirm bar tints green with a left edge when items + destination are set
 *
 * Use the "Simulate scan" button to add items one-by-one and see the flash.
 * Toggle the destination switch to flip ready state.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScanLine, Box, X, MapPin, Check } from "lucide-react";

interface Item { serial: string; name: string; category: string }

const SAMPLE_POOL: Item[] = [
  { serial: "00012", name: "Arri SkyPanel S60-C", category: "Lighting" },
  { serial: "00018", name: "Arri SkyPanel S60-C", category: "Lighting" },
  { serial: "00103", name: "Sony FX9",            category: "Camera"   },
  { serial: "00104", name: "Sony FX9",            category: "Camera"   },
  { serial: "00256", name: "Aputure 600D Pro",    category: "Lighting" },
];

export default function PreviewIssuePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [destinationDone, setDestinationDone] = useState(false);
  const [latestSerial, setLatestSerial] = useState<string | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function addNext() {
    if (items.length >= SAMPLE_POOL.length) return;
    const next = SAMPLE_POOL[items.length];
    setItems((prev) => [...prev, next]);
    setLatestSerial(next.serial);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setLatestSerial(null), 700);
  }

  function reset() {
    setItems([]);
    setDestinationDone(false);
    setLatestSerial(null);
  }

  useEffect(() => () => { if (flashTimeout.current) clearTimeout(flashTimeout.current); }, []);

  const status: "scan" | "destination" | "ready" =
    items.length === 0     ? "scan" :
    !destinationDone        ? "destination" :
                              "ready";
  const ready = status === "ready";

  return (
    <div className="min-h-screen bg-grey-light/40 pb-24">
      {/* Topbar — same shape as live AppTopbar, with live status chip on the right (touch #1) */}
      <div className="bg-white border-b border-grey-mid">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <h1 className="text-[18px] font-bold text-surface-dark">Issue</h1>
          <StatusChip status={status} count={items.length} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4">
          {/* Left: scan + batch */}
          <div className="space-y-4">
            <ScannerCard onSimulateScan={addNext} disabled={items.length >= SAMPLE_POOL.length} />
            <BatchCard items={items} latestSerial={latestSerial} onRemove={(s) => setItems((p) => p.filter((i) => i.serial !== s))} />
          </div>
          {/* Right: destination */}
          <DestinationCard done={destinationDone} onToggle={() => setDestinationDone((v) => !v)} />
        </div>
      </div>

      {/* Sticky footer — tints green with a left edge when ready (touch #3) */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 border-t z-10 transition-colors",
          "shadow-[0_-4px_12px_rgba(15,23,42,0.04)]",
          ready
            ? "bg-status-green/5 border-grey-mid border-l-[3px] border-l-status-green"
            : "bg-white border-grey-mid"
        )}
      >
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="text-[13px] text-surface-dark">
            <span className="font-semibold">{items.length} item{items.length === 1 ? "" : "s"}</span>
            {ready                            && <span className="text-status-green font-medium"> · ready to issue to Stage 7A — Set 14</span>}
            {!destinationDone && items.length > 0 && <span className="text-grey"> · destination not set</span>}
            {items.length === 0               && <span className="text-grey"> · scan to begin</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={items.length === 0} onClick={reset}>Clear</Button>
            <Button size="sm" disabled={!ready}>
              {items.length > 0 ? `Issue ${items.length} item${items.length === 1 ? "" : "s"}` : "Issue"}
            </Button>
          </div>
        </div>
      </div>

      {/* Helper hint (preview-only) */}
      <div className="fixed bottom-16 right-4 bg-white rounded-card border border-grey-mid shadow-device px-3 py-2 z-20">
        <p className="text-[11px] text-grey">
          Click <span className="font-semibold text-surface-dark">Simulate scan</span> to add items, then toggle the destination.
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatusChip({ status, count }: { status: "scan" | "destination" | "ready"; count: number }) {
  if (status === "scan") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wider uppercase bg-blue-100 text-blue-700">
        <ScanLine className="h-3 w-3" />
        Scanning {count > 0 && `· ${count}`}
      </span>
    );
  }
  if (status === "destination") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wider uppercase bg-amber-100 text-amber-700">
        <MapPin className="h-3 w-3" />
        Awaiting destination · {count}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wider uppercase bg-green-100 text-green-700">
      <Check className="h-3 w-3" />
      Ready · {count}
    </span>
  );
}

function ScannerCard({ onSimulateScan, disabled }: { onSimulateScan: () => void; disabled: boolean }) {
  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      <div className="px-5 py-2.5 border-b border-grey-mid flex items-center gap-2">
        <ScanLine className="h-3.5 w-3.5 text-grey" />
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-surface-dark">Scan</h2>
      </div>
      <div className="px-5 py-4 space-y-2.5">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-grey">Serial</label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Type or scan a 5-digit serial…"
          className="w-full bg-grey-light/60 border border-grey-mid rounded-btn px-3 py-2.5 text-[15px] font-mono font-semibold text-surface-dark focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
          readOnly
        />
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-grey">Auto-fires after 5 digits.</p>
          <Button size="sm" variant="secondary" onClick={onSimulateScan} disabled={disabled}>
            {disabled ? "All sample items added" : "Simulate scan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BatchCard({
  items, latestSerial, onRemove,
}: {
  items: Item[];
  latestSerial: string | null;
  onRemove: (serial: string) => void;
}) {
  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      <div className="px-5 py-2.5 border-b border-grey-mid flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-surface-dark">
          Batch {items.length > 0 && <span className="text-grey font-normal normal-case ml-1">· {items.length}</span>}
        </h2>
        {items.length > 0 && (
          <button onClick={() => items.forEach((i) => onRemove(i.serial))} className="text-[11px] text-grey hover:text-status-red">
            Clear all
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Box className="h-6 w-6 text-grey-mid mx-auto mb-2" />
          <p className="text-[13px] font-medium text-surface-dark">No items yet</p>
          <p className="text-[11px] text-grey mt-0.5">Scan a serial above to add it.</p>
        </div>
      ) : (
        <ul className="divide-y divide-grey-mid">
          {items.map((it) => {
            const isLatest = latestSerial === it.serial;
            return (
              <li
                key={it.serial}
                className={cn(
                  "px-5 py-2.5 flex items-center gap-3 transition-colors duration-700",
                  isLatest ? "bg-brand-blue/10" : "bg-transparent"
                )}
              >
                <span className="font-mono text-[13px] font-semibold text-surface-dark w-14 shrink-0">{it.serial}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-surface-dark truncate">{it.name}</p>
                  <p className="text-[11px] text-grey">{it.category}</p>
                </div>
                <button onClick={() => onRemove(it.serial)} className="text-grey hover:text-status-red leading-none" aria-label="Remove">
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DestinationCard({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      <div className="px-5 py-2.5 border-b border-grey-mid flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-grey" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-surface-dark">Destination</h2>
        </div>
        {done && <span className="text-[11px] text-grey truncate max-w-[55%]">Pinewood — Stage 7A → Set 14 → On Set</span>}
      </div>
      <div className="p-5 space-y-3">
        <Field label="Project">
          <select className={selectCls} value={done ? "echo" : ""} onChange={() => {}} disabled>
            <option value="" disabled>Select a production…</option>
            <option value="echo">Echo One</option>
            <option value="moonlight">Moonlight</option>
          </select>
        </Field>
        <Field label="Studio / Venue">
          <select className={selectCls} value={done ? "pinewood" : ""} onChange={() => {}} disabled>
            <option value="" disabled>Select…</option>
            <option value="pinewood">Pinewood</option>
            <option value="shepperton">Shepperton</option>
          </select>
        </Field>
        <Field label="Stage">
          <select className={selectCls} value={done ? "stage7a" : ""} onChange={() => {}} disabled>
            <option value="" disabled>Select…</option>
            <option value="stage7a">Stage 7A</option>
            <option value="stage7b">Stage 7B</option>
          </select>
        </Field>
        <Field label="Set">
          <select className={selectCls} value={done ? "set14" : ""} onChange={() => {}} disabled>
            <option value="" disabled>Select…</option>
            <option value="set14">Set 14 — Diner Interior</option>
            <option value="set15">Set 15 — Cafe Exterior</option>
          </select>
        </Field>
        <Field label="Position">
          <select className={selectCls} value={done ? "on_set" : ""} onChange={() => {}} disabled>
            <option value="" disabled>Select…</option>
            <option value="inside_prop_make">Inside Prop Make</option>
            <option value="in_prop_dressing">In Prop Dressing</option>
            <option value="on_set">On Set</option>
            <option value="rigged">Rigged to Outside of Set</option>
          </select>
        </Field>

        <div className="pt-2 border-t border-grey-mid">
          <label className="flex items-center gap-2 text-[12px] text-surface-dark cursor-pointer select-none">
            <input
              type="checkbox"
              checked={done}
              onChange={onToggle}
              className="rounded border-grey-mid accent-brand-blue"
            />
            <span className="font-medium">Mock destination as set</span>
            <span className="text-grey font-normal">(preview toggle — flips the ready state)</span>
          </label>
        </div>
      </div>
    </div>
  );
}

const selectCls = "w-full bg-white border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 disabled:bg-grey-light/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-grey mb-1.5">{label}</label>
      {children}
    </div>
  );
}
