"use client";

/**
 * Equipment Entry — single-page progressive form.
 *
 *   ┌─ Product ───────────────────────────────┐
 *   │  (search + create new, inline)          │
 *   │  Once picked → collapses to a pill      │
 *   └─────────────────────────────────────────┘
 *   ┌─ Units ────────────────────────────────┐
 *   │  scan + bulk + serials list            │
 *   │  (disabled until a product is chosen)  │
 *   └────────────────────────────────────────┘
 *   ┌─ Sticky action bar ────────────────────┐
 *   │  "N units ready"  [ Confirm & create ] │
 *   └────────────────────────────────────────┘
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { EquipmentGuideSteps } from "@/components/shared/EquipmentGuideSteps";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { normaliseProductName } from "@/lib/normalise";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

interface SelectedProduct {
  id:          string | null; // null = new product, will be created on confirm
  name:        string;
  categoryId:  string | null;
  categoryName: string | null;
  description: string;
}

interface PendingUnit {
  serial: string;
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function EquipmentEntryPage() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [selected, setSelected] = useState<SelectedProduct | null>(null);
  const [pendingUnits, setPendingUnits] = useState<PendingUnit[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ count: number; name: string } | null>(null);

  const { data: nextSerialData, refetch: refetchNextSerial } = trpc.equipment.nextSerial.useQuery(
    { workspaceId },
    { enabled: !!selected }
  );

  const createProduct = trpc.product.create.useMutation();
  const createBatch   = trpc.equipment.createBatch.useMutation();

  function clearProduct() {
    setSelected(null);
    setPendingUnits([]);
    setSaveError(null);
  }

  function resetForAnother() {
    setSelected(null);
    setPendingUnits([]);
    setSaveError(null);
    setSuccessInfo(null);
  }

  async function confirmAndCreate() {
    if (!selected || pendingUnits.length === 0) return;
    setSaveError(null);

    let productId = selected.id;
    if (!productId) {
      try {
        const product = await createProduct.mutateAsync({
          workspaceId,
          name:        selected.name,
          categoryId:  selected.categoryId ?? undefined,
          description: selected.description || undefined,
        });
        productId = product.id;
        await utils.product.search.invalidate();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Failed to create product.");
        return;
      }
    }

    try {
      const result = await createBatch.mutateAsync({
        workspaceId,
        productId:  productId ?? undefined,
        name:       selected.name,
        categoryId: selected.categoryId ?? undefined,
        serials:    pendingUnits.map((u) => u.serial),
      });
      setSuccessInfo({ count: result.created, name: selected.name });
      await utils.equipment.list.invalidate();
      await refetchNextSerial();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to create equipment.");
    }
  }

  const saving = createBatch.isPending || createProduct.isPending;

  return (
    <>
      <AppTopbar
        title="Add equipment"
        actions={
          <Button variant="secondary" size="sm" onClick={() => router.push("/equipment")}>
            ← Back to equipment
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {!successInfo && (
          <div className="max-w-6xl mx-auto px-6 pt-8">
            <EquipmentGuideSteps />
          </div>
        )}

        <div className="max-w-3xl mx-auto px-6 py-6 pb-32 space-y-5">
          {successInfo ? (
            <SuccessPanel
              info={successInfo}
              onAddAnother={resetForAnother}
              onDone={() => router.push("/equipment")}
            />
          ) : (
            <>
              <ProductSection
                selected={selected}
                onSelect={(p) => {
                  setSelected(p);
                  setPendingUnits([]);
                  setSaveError(null);
                }}
                onClear={clearProduct}
                workspaceId={workspaceId}
              />

              <UnitsSection
                selected={selected}
                pendingUnits={pendingUnits}
                setPendingUnits={setPendingUnits}
                nextSerialData={nextSerialData}
                workspaceId={workspaceId}
              />

              {saveError && (
                <div className="bg-status-red-light border border-status-red/20 rounded-card px-4 py-3 text-[12px] text-status-red">
                  {saveError}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sticky action bar */}
      {!successInfo && (
        <StickyActionBar
          disabled={!selected || pendingUnits.length === 0 || saving}
          pendingCount={pendingUnits.length}
          saving={saving}
          onConfirm={confirmAndCreate}
        />
      )}
    </>
  );
}

// ── Product Section ──────────────────────────────────────────────────────

function ProductSection({
  selected, onSelect, onClear, workspaceId,
}: {
  selected: SelectedProduct | null;
  onSelect: (p: SelectedProduct) => void;
  onClear: () => void;
  workspaceId: string;
}) {
  if (selected) {
    return (
      <SectionCard
        step={1}
        title="Product"
        status="complete"
      >
        <div className="flex items-center gap-3 px-5 py-3">
          <div className="w-8 h-8 rounded-full bg-status-green/10 flex items-center justify-center flex-shrink-0">
            <Check size={16} className="text-status-green" strokeWidth={3} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-surface-dark truncate">{selected.name}</div>
            <div className="text-[12px] text-grey truncate">
              {selected.categoryName ?? "Uncategorised"}
              {selected.id === null && <span className="ml-2 text-brand-blue">· new product</span>}
              {selected.description && <span> · {selected.description.slice(0, 60)}{selected.description.length > 60 ? "…" : ""}</span>}
            </div>
          </div>
          <button
            onClick={onClear}
            className="text-[11px] text-grey hover:text-brand-blue flex items-center gap-1 px-2 py-1 rounded-btn hover:bg-grey-light"
            aria-label="Change product"
          >
            <Pencil size={12} />
            Change
          </button>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard step={1} title="Product" status="active">
      <ProductPicker onSelect={onSelect} workspaceId={workspaceId} />
    </SectionCard>
  );
}

function ProductPicker({
  onSelect, workspaceId,
}: {
  onSelect: (p: SelectedProduct) => void;
  workspaceId: string;
}) {
  const [search, setSearch] = useState("");
  const [browseOpen, setBrowseOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const { data: products } = trpc.product.search.useQuery({
    workspaceId,
    query: search,
    limit: 20,
  });
  const { data: categories } = trpc.category.list.useQuery({ workspaceId });

  const hasSearch = search.trim().length > 0;
  const showResults = hasSearch || browseOpen;

  const normalisedSearch = normaliseProductName(search);
  const exactMatch = useMemo(() => {
    if (!search.trim()) return null;
    return (products ?? []).find((p) => p.name.toLowerCase() === normalisedSearch.toLowerCase()) ?? null;
  }, [products, normalisedSearch, search]);

  function pickExisting(p: { id: string; name: string; categoryId: string | null; description: string | null; category?: { id: string; name: string } | null }) {
    onSelect({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      description: p.description ?? "",
    });
  }

  function startCreating() {
    setNewName(search);
    setNewCategory("");
    setNewDescription("");
    setCreating(true);
  }

  function submitNew() {
    if (!newName.trim()) return;
    const categoryName = (categories ?? []).find((c) => c.id === newCategory)?.name ?? null;
    onSelect({
      id: null,
      name: normaliseProductName(newName),
      categoryId: newCategory || null,
      categoryName,
      description: newDescription,
    });
  }

  if (creating) {
    return (
      <div className="p-5 space-y-3">
        <Field label="Product name" required>
          <input
            type="text"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={(e) => setNewName(normaliseProductName(e.target.value))}
            placeholder="e.g. Arri SkyPanel S60-C"
            className={inputCls}
          />
          {newName && newName !== normaliseProductName(newName) && (
            <p className="text-[11px] text-grey mt-1">
              Will save as: <span className="font-semibold text-surface-dark">{normaliseProductName(newName)}</span>
            </p>
          )}
        </Field>
        <Field label="Category" optional>
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className={inputCls}
          >
            <option value="">No category</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Description" optional>
          <textarea
            rows={2}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Specs, notes, accessories included…"
            className={cn(inputCls, "resize-none")}
          />
        </Field>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="primary" onClick={submitNew} disabled={!newName.trim()}>
            Use this product
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            autoFocus
            placeholder="Search catalog…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setBrowseOpen(false); }}
            className={cn(inputCls, "pr-9")}
          />
          {!hasSearch && (
            <button
              type="button"
              onClick={() => setBrowseOpen((v) => !v)}
              aria-label={browseOpen ? "Hide catalog" : "Browse catalog"}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-grey hover:text-brand-blue p-1"
            >
              <ChevronDown size={16} className={cn("transition-transform", browseOpen && "rotate-180")} />
            </button>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={startCreating}>
          <Plus size={14} className="mr-1" />
          New
        </Button>
      </div>

      {showResults && (products ?? []).length > 0 && (
        <ul className="divide-y divide-grey-mid border border-grey-mid rounded-btn overflow-hidden max-h-[320px] overflow-y-auto">
          {(products ?? []).map((p) => (
            <li key={p.id}>
              <button
                onClick={() => pickExisting(p)}
                className="w-full px-3 py-2 text-left hover:bg-grey-light transition-colors flex items-center gap-3"
              >
                <span className="text-[13px] text-surface-dark flex-1 truncate">{p.name}</span>
                <span className="text-[11px] text-grey whitespace-nowrap">{p.category?.name ?? "—"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showResults && (products ?? []).length === 0 && hasSearch && (
        <div className="border border-dashed border-grey-mid rounded-btn px-4 py-5 text-center space-y-2">
          <p className="text-[12px] text-grey">No products matching &ldquo;{search}&rdquo;.</p>
          <Button size="sm" variant="primary" onClick={startCreating}>
            + Create &ldquo;{normaliseProductName(search)}&rdquo;
          </Button>
        </div>
      )}

      {showResults && (products ?? []).length === 0 && !hasSearch && (
        <p className="text-[11px] text-grey text-center py-2">
          No products in the catalog yet.
        </p>
      )}

      {showResults && !exactMatch && hasSearch && (products ?? []).length > 0 && (
        <button onClick={startCreating} className="text-[12px] text-brand-blue hover:underline">
          + Create &ldquo;{normaliseProductName(search)}&rdquo; instead
        </button>
      )}
    </div>
  );
}

// ── Units Section ────────────────────────────────────────────────────────

function UnitsSection({
  selected, pendingUnits, setPendingUnits, nextSerialData, workspaceId,
}: {
  selected: SelectedProduct | null;
  pendingUnits: PendingUnit[];
  setPendingUnits: React.Dispatch<React.SetStateAction<PendingUnit[]>>;
  nextSerialData: { last: string | null; next: string } | undefined;
  workspaceId: string;
}) {
  const [serialInput, setSerialInput] = useState("");
  const [bulkCount, setBulkCount] = useState(5);
  const [serialStatus, setSerialStatus] = useState<"idle" | "checking" | "available" | "taken" | "duplicate">("idle");
  const [takenBy, setTakenBy] = useState<string | null>(null);
  const serialRef = useRef<HTMLInputElement>(null);

  // Autofill the next free serial
  useEffect(() => {
    if (selected && nextSerialData?.next && !serialInput && pendingUnits.length === 0) {
      setSerialInput(nextSerialData.next);
    }
  }, [selected, nextSerialData, serialInput, pendingUnits.length]);

  const checkSerial = trpc.equipment.checkSerial.useQuery(
    { workspaceId, serial: serialInput },
    { enabled: /^\d{5}$/.test(serialInput) && !!selected, staleTime: 0 }
  );

  useEffect(() => {
    if (!/^\d{5}$/.test(serialInput)) {
      setSerialStatus("idle"); setTakenBy(null); return;
    }
    if (pendingUnits.some((u) => u.serial === serialInput)) {
      setSerialStatus("duplicate"); setTakenBy(null); return;
    }
    setSerialStatus("checking");
  }, [serialInput, pendingUnits]);

  useEffect(() => {
    if (checkSerial.data && /^\d{5}$/.test(serialInput) && !pendingUnits.some((u) => u.serial === serialInput)) {
      setSerialStatus(checkSerial.data.available ? "available" : "taken");
      setTakenBy(checkSerial.data.existing?.name ?? null);
    }
  }, [checkSerial.data, serialInput, pendingUnits]);

  function addUnit() {
    if (!/^\d{5}$/.test(serialInput) || serialStatus !== "available") return;
    setPendingUnits((prev) => [...prev, { serial: serialInput }]);
    const next = String(parseInt(serialInput, 10) + 1).padStart(5, "0");
    setSerialInput(next);
    requestAnimationFrame(() => serialRef.current?.select());
  }

  function addBulk(count: number) {
    if (!Number.isFinite(count) || count < 1) return;
    const clamped = Math.min(count, 100);
    const nextFromDb = nextSerialData?.next ? parseInt(nextSerialData.next, 10) : 1;
    const highestPending = pendingUnits.reduce((max, u) => Math.max(max, parseInt(u.serial, 10)), 0);
    const start = Math.max(nextFromDb, highestPending + 1);
    if (start + clamped - 1 > 99999) return;
    const newOnes: PendingUnit[] = Array.from({ length: clamped }, (_, i) => ({
      serial: String(start + i).padStart(5, "0"),
    }));
    setPendingUnits((prev) => [...prev, ...newOnes]);
    setSerialInput(String(start + clamped).padStart(5, "0"));
  }

  function removeUnit(serial: string) {
    setPendingUnits((prev) => prev.filter((u) => u.serial !== serial));
  }

  const enabled = !!selected;
  const status = !enabled ? "disabled" : pendingUnits.length > 0 ? "active" : "active";

  return (
    <SectionCard step={2} title="Units" status={status} count={pendingUnits.length}>
      {!enabled ? (
        <div className="px-5 py-6 text-center text-[12px] text-grey">
          Pick a product above to start adding serials.
        </div>
      ) : (
        <div className="divide-y divide-grey-mid">
          {/* Scan row */}
          <div className="p-5 space-y-2">
            <div className="text-[11px] font-semibold text-grey uppercase tracking-wide">Add one</div>
            <div className="flex items-center gap-2">
              <input
                ref={serialRef}
                type="text"
                inputMode="numeric"
                autoFocus
                placeholder="00001"
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
                onKeyDown={(e) => { if (e.key === "Enter" && serialStatus === "available") { e.preventDefault(); addUnit(); } }}
                className={cn(inputCls, "font-mono max-w-[140px]")}
              />
              <div className="flex-1">
                <SerialStatusLine status={serialStatus} takenBy={takenBy} serial={serialInput} nextHint={nextSerialData} />
              </div>
              <Button size="sm" variant="primary" onClick={addUnit} disabled={serialStatus !== "available"}>
                Add
              </Button>
            </div>
          </div>

          {/* Bulk row */}
          <div className="p-5 space-y-2">
            <div className="text-[11px] font-semibold text-grey uppercase tracking-wide">Add in bulk</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100}
                value={bulkCount}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setBulkCount(Number.isFinite(v) ? Math.max(1, Math.min(100, v)) : 1);
                }}
                className={cn(inputCls, "max-w-[80px]")}
              />
              <p className="flex-1 text-[11px] text-grey">
                Assigns the next {bulkCount} sequential serial{bulkCount !== 1 ? "s" : ""} starting from <span className="font-semibold text-surface-dark">{nextSerialData?.next ?? "—"}</span>.
              </p>
              <Button size="sm" variant="primary" onClick={() => addBulk(bulkCount)}>
                Add {bulkCount}
              </Button>
            </div>
          </div>

          {/* List of pending units */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-semibold text-grey uppercase tracking-wide">
                Added ({pendingUnits.length})
              </div>
              {pendingUnits.length > 0 && (
                <button
                  onClick={() => setPendingUnits([])}
                  className="text-[11px] text-grey hover:text-status-red flex items-center gap-1"
                >
                  <Trash2 size={11} />
                  Clear all
                </button>
              )}
            </div>
            {pendingUnits.length === 0 ? (
              <p className="text-[12px] text-grey text-center py-4">
                No serials yet. Add them one-by-one above or use bulk.
              </p>
            ) : (
              <div className="grid grid-cols-5 gap-1.5 max-h-[220px] overflow-y-auto">
                {pendingUnits.map((u) => (
                  <div
                    key={u.serial}
                    className="group relative bg-grey-light rounded-btn px-2 py-1.5 text-[12px] font-mono text-surface-dark text-center"
                  >
                    {u.serial}
                    <button
                      onClick={() => removeUnit(u.serial)}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-surface-dark text-white text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      aria-label={`Remove ${u.serial}`}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ── Sticky Action Bar ────────────────────────────────────────────────────

function StickyActionBar({
  disabled, pendingCount, saving, onConfirm,
}: {
  disabled: boolean;
  pendingCount: number;
  saving: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-sidebar right-0 bg-white border-t border-grey-mid px-6 py-3.5 flex items-center justify-between gap-4 z-30">
      <div className="text-[12px] text-grey">
        {pendingCount === 0
          ? "Nothing to create yet."
          : <><span className="font-semibold text-surface-dark">{pendingCount}</span> unit{pendingCount !== 1 ? "s" : ""} ready</>}
      </div>
      <Button
        size="default"
        variant="primary"
        disabled={disabled}
        onClick={onConfirm}
      >
        {saving
          ? "Creating…"
          : pendingCount > 0
            ? `Confirm & create ${pendingCount} unit${pendingCount !== 1 ? "s" : ""}`
            : "Confirm & create"}
      </Button>
    </div>
  );
}

// ── Success panel ────────────────────────────────────────────────────────

function SuccessPanel({
  info, onAddAnother, onDone,
}: {
  info: { count: number; name: string };
  onAddAnother: () => void;
  onDone: () => void;
}) {
  return (
    <div className="bg-white rounded-card border border-grey-mid p-10 flex flex-col items-center text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-status-green flex items-center justify-center">
        <Check size={32} className="text-white" strokeWidth={3} />
      </div>
      <div>
        <div className="text-[20px] font-bold text-surface-dark">Equipment added</div>
        <div className="text-[13px] text-grey mt-1">
          Created {info.count} unit{info.count !== 1 ? "s" : ""} of <strong className="text-surface-dark">{info.name}</strong>.
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <Button size="sm" variant="secondary" onClick={onAddAnother}>
          + Another product
        </Button>
        <Button size="sm" variant="primary" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

// ── Section scaffolding ──────────────────────────────────────────────────

function SectionCard({
  step, title, status, count, children,
}: {
  step: number;
  title: string;
  status: "active" | "complete" | "disabled";
  count?: number;
  children: React.ReactNode;
}) {
  const numberColor =
    status === "complete" ? "bg-status-green text-white"
    : status === "active" ? "bg-brand-blue text-white"
    : "bg-grey-mid text-grey";

  return (
    <section className={cn(
      "bg-white rounded-card border overflow-hidden",
      status === "disabled" ? "border-grey-mid opacity-60" : "border-grey-mid"
    )}>
      <div className="px-5 py-3.5 border-b border-grey-mid flex items-center gap-3">
        <span className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0",
          numberColor,
        )}>
          {status === "complete" ? <Check size={12} strokeWidth={3} /> : step}
        </span>
        <h2 className="text-[13px] font-semibold text-surface-dark">{title}</h2>
        {typeof count === "number" && count > 0 && (
          <span className="text-[11px] text-grey">({count})</span>
        )}
      </div>
      {children}
    </section>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20";

function Field({ label, required, optional, children }: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-grey uppercase tracking-wide mb-1">
        {label}
        {required && <span className="text-status-red ml-1">*</span>}
        {optional && <span className="text-grey font-normal normal-case ml-1">(optional)</span>}
      </label>
      {children}
    </div>
  );
}

function SerialStatusLine({
  status, takenBy, serial, nextHint,
}: {
  status: "idle" | "checking" | "available" | "taken" | "duplicate";
  takenBy: string | null;
  serial: string;
  nextHint: { last: string | null; next: string } | undefined;
}) {
  if (status === "idle" && !serial) {
    return (
      <p className="text-[11px] text-grey">
        Last used: <span className="font-semibold">{nextHint?.last ?? "—"}</span> · Next free: <span className="font-semibold text-brand-blue">{nextHint?.next ?? "—"}</span>
      </p>
    );
  }
  if (serial.length > 0 && serial.length < 5) {
    return <p className="text-[11px] text-grey">{5 - serial.length} more digit{5 - serial.length !== 1 ? "s" : ""}</p>;
  }
  if (status === "checking") return <p className="text-[11px] text-grey">Checking…</p>;
  if (status === "available") return <p className="text-[11px] text-status-green font-semibold">✓ {serial} is free</p>;
  if (status === "duplicate") return <p className="text-[11px] text-status-amber font-semibold">⚠ {serial} is already in this batch</p>;
  if (status === "taken")     return <p className="text-[11px] text-status-red font-semibold">✕ {serial} is already used{takenBy ? ` by ${takenBy}` : ""}</p>;
  return null;
}
