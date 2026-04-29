"use client";

/**
 * Lighter preview of /return. Same polish pass as preview-issue —
 * keeps the existing two-column layout, drops the coloured stripes,
 * tighter section headers, slightly bigger scan input, edge-to-edge
 * sticky footer.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScanLine, Box, X, AlertTriangle, Handshake } from "lucide-react";

type Scenario = "empty" | "scanning" | "mixed";

interface Item {
  serial: string;
  name: string;
  category: string;
  state: "good" | "damaged" | "cross_hire";
}

const SAMPLE_ITEMS: Item[] = [
  { serial: "00012", name: "Arri SkyPanel S60-C", category: "Lighting", state: "good" },
  { serial: "00018", name: "Arri SkyPanel S60-C", category: "Lighting", state: "damaged" },
  { serial: "00104", name: "Sony FX9",            category: "Camera",   state: "cross_hire" },
];

export default function PreviewReturnPage() {
  const [scenario, setScenario] = useState<Scenario>("scanning");

  const items: Item[] =
    scenario === "empty"    ? [] :
    scenario === "scanning" ? SAMPLE_ITEMS.slice(0, 2).map((i) => ({ ...i, state: "good" })) :
    SAMPLE_ITEMS;

  const good      = items.filter((i) => i.state === "good").length;
  const damaged   = items.filter((i) => i.state === "damaged").length;
  const crossHire = items.filter((i) => i.state === "cross_hire").length;

  return (
    <div className="min-h-screen bg-grey-light/40 pb-24">
      {/* Topbar */}
      <div className="bg-white border-b border-grey-mid">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-[18px] font-bold text-surface-dark">Return</h1>
          <span className="text-[11px] text-grey">Preview · /preview-return</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4">
          <div className="space-y-4">
            <ScannerCard count={items.length} />
            <BatchCard items={items} />
          </div>
          <SummaryCard good={good} damaged={damaged} crossHire={crossHire} totalItems={items.length} />
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-grey-mid shadow-[0_-4px_12px_rgba(15,23,42,0.04)] z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="text-[13px] text-surface-dark">
            <span className="font-semibold">{items.length} item{items.length === 1 ? "" : "s"}</span>
            {damaged > 0   && <span className="text-status-red"> · {damaged} flagged damaged</span>}
            {crossHire > 0 && <span className="text-violet-700"> · {crossHire} cross-hire</span>}
            {items.length === 0 && <span className="text-grey"> · scan to begin</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={items.length === 0}>Clear</Button>
            <Button size="sm" disabled={items.length === 0}>
              {items.length > 0 ? `Return ${items.length} item${items.length === 1 ? "" : "s"}` : "Return"}
            </Button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-16 right-4 bg-white rounded-card border border-grey-mid shadow-device px-3 py-2 flex items-center gap-2 z-20">
        <span className="text-[10px] uppercase tracking-wider text-grey font-semibold">State</span>
        {(["empty", "scanning", "mixed"] as Scenario[]).map((s) => (
          <button
            key={s}
            onClick={() => setScenario(s)}
            className={cn(
              "px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors",
              scenario === s ? "bg-brand-blue text-white" : "bg-grey-light text-surface-dark hover:bg-grey-mid"
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function ScannerCard({ count }: { count: number }) {
  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      <div className="px-5 py-2.5 border-b border-grey-mid flex items-center gap-2">
        <ScanLine className="h-3.5 w-3.5 text-grey" />
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-surface-dark">Scan</h2>
      </div>
      <div className="px-5 py-4 space-y-2">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-grey">Serial</label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Type or scan a 5-digit serial…"
          autoFocus
          className="w-full bg-grey-light/60 border border-grey-mid rounded-btn px-3 py-2.5 text-[15px] font-mono font-semibold text-surface-dark focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
        />
        <p className="text-[11px] text-grey">
          {count === 0 ? "Scan first item to start the batch." : "Damaged items can be flagged on the row."}
        </p>
      </div>
    </div>
  );
}

function BatchCard({ items }: { items: Item[] }) {
  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      <div className="px-5 py-2.5 border-b border-grey-mid flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-surface-dark">
          Batch {items.length > 0 && <span className="text-grey font-normal normal-case ml-1">· {items.length}</span>}
        </h2>
        {items.length > 0 && (
          <button className="text-[11px] text-grey hover:text-status-red">Clear all</button>
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
          {items.map((it) => (
            <li key={it.serial} className="px-5 py-2.5 flex items-center gap-3">
              <span className="font-mono text-[13px] font-semibold text-surface-dark w-14 shrink-0">{it.serial}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-surface-dark truncate">{it.name}</p>
                <p className="text-[11px] text-grey">{it.category}</p>
              </div>
              <ItemStatePill state={it.state} />
              {it.state === "good" ? (
                <button className="text-[11px] font-semibold text-grey hover:text-status-red px-2 py-1 border border-grey-mid rounded-btn hover:border-status-red">
                  Flag damage
                </button>
              ) : it.state === "damaged" ? (
                <button className="text-[11px] text-grey hover:text-surface-dark">remove</button>
              ) : null}
              <button className="text-grey hover:text-status-red leading-none" aria-label="Remove">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemStatePill({ state }: { state: Item["state"] }) {
  if (state === "damaged") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded">
        <AlertTriangle className="h-3 w-3" /> Damaged
      </span>
    );
  }
  if (state === "cross_hire") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase bg-violet-100 text-violet-700 px-2 py-0.5 rounded">
        <Handshake className="h-3 w-3" /> Cross hire
      </span>
    );
  }
  return null;
}

function SummaryCard({
  good, damaged, crossHire, totalItems,
}: { good: number; damaged: number; crossHire: number; totalItems: number }) {
  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      <div className="px-5 py-2.5 border-b border-grey-mid">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-surface-dark">Return summary</h2>
      </div>
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <SummaryTile label="Good" value={good} tone="green" />
          <SummaryTile label="Damaged" value={damaged} tone="red" />
          <SummaryTile label="Cross hire" value={crossHire} tone="violet" />
        </div>
        {totalItems > 0 && damaged > 0 && (
          <p className="text-[11px] text-grey">Damage reports will be filed automatically on confirm.</p>
        )}
        {totalItems > 0 && crossHire > 0 && (
          <p className="text-[11px] text-grey">Cross-hire items reconcile against their open events.</p>
        )}
        {totalItems === 0 && (
          <p className="text-[11px] text-grey">Scan items as they come back. Flag damage inline.</p>
        )}
      </div>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: "green" | "red" | "violet" }) {
  const wrap =
    tone === "green"  ? "bg-status-green/5 border-status-green/20" :
    tone === "red"    ? "bg-status-red/5 border-status-red/20" :
                        "bg-violet-50 border-violet-200";
  const text =
    tone === "green"  ? "text-status-green" :
    tone === "red"    ? "text-status-red" :
                        "text-violet-700";
  return (
    <div className={cn("rounded-card border p-3 text-center", wrap)}>
      <p className="text-[10px] uppercase tracking-wider text-grey">{label}</p>
      <p className={cn("text-[20px] font-bold mt-0.5", text)}>{value}</p>
    </div>
  );
}
