"use client";

/**
 * Equipment Entry — dedicated add-new-equipment flow.
 *
 * Flow:
 *   1. Choose a product (autocomplete from workspace catalog)
 *      — or create a new product (name, category, description). Auto-saves to catalog.
 *   2. Scan / enter serials for the chosen product (unlimited batch).
 *      — next free serial auto-suggested; duplicates blocked inline.
 *   3. Save the batch → redirect or "Add another product".
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { normaliseProductName } from "@/lib/normalise";

// ── Types ────────────────────────────────────────────────────────────────

type Step = "pick-product" | "add-units" | "confirm";

interface SelectedProduct {
  id:          string | null; // null = new product being created
  name:        string;
  categoryId:  string | null;
  description: string;
}

interface PendingUnit {
  serial: string;
  error?: string;
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function EquipmentEntryPage() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [step, setStep] = useState<Step>("pick-product");
  const [selected, setSelected] = useState<SelectedProduct | null>(null);
  const [pendingUnits, setPendingUnits] = useState<PendingUnit[]>([]);
  const [serialInput, setSerialInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ count: number; name: string } | null>(null);
  const serialRef = useRef<HTMLInputElement>(null);

  // ── Product search ───────────────────────────────────────────────────

  const [search, setSearch] = useState("");
  const { data: products } = trpc.product.search.useQuery({
    workspaceId,
    query: search,
    limit: 20,
  });

  // ── Category list (for new products) ─────────────────────────────────

  const { data: categories } = trpc.category.list.useQuery({ workspaceId });

  // ── Next serial suggestion ───────────────────────────────────────────

  const { data: nextSerialData, refetch: refetchNextSerial } = trpc.equipment.nextSerial.useQuery(
    { workspaceId },
    { enabled: step === "add-units" }
  );

  useEffect(() => {
    if (step === "add-units" && nextSerialData?.next && !serialInput && pendingUnits.length === 0) {
      setSerialInput(nextSerialData.next);
    }
  }, [step, nextSerialData, serialInput, pendingUnits.length]);

  // ── Mutations ────────────────────────────────────────────────────────

  const createProduct = trpc.product.create.useMutation();
  const createBatch   = trpc.equipment.createBatch.useMutation();

  // ── Live serial check (debounced) ────────────────────────────────────

  const [serialStatus, setSerialStatus] = useState<"idle" | "checking" | "available" | "taken" | "duplicate">("idle");
  const [takenBy, setTakenBy] = useState<string | null>(null);

  const checkSerialMutation = trpc.equipment.checkSerial.useQuery(
    { workspaceId, serial: serialInput },
    { enabled: /^\d{5}$/.test(serialInput), staleTime: 0 }
  );

  useEffect(() => {
    if (!/^\d{5}$/.test(serialInput)) {
      setSerialStatus("idle");
      setTakenBy(null);
      return;
    }
    // Already in pending batch?
    if (pendingUnits.some((u) => u.serial === serialInput)) {
      setSerialStatus("duplicate");
      setTakenBy(null);
      return;
    }
    setSerialStatus("checking");
  }, [serialInput, pendingUnits]);

  useEffect(() => {
    if (checkSerialMutation.data && /^\d{5}$/.test(serialInput) && !pendingUnits.some((u) => u.serial === serialInput)) {
      setSerialStatus(checkSerialMutation.data.available ? "available" : "taken");
      setTakenBy(checkSerialMutation.data.existing?.name ?? null);
    }
  }, [checkSerialMutation.data, serialInput, pendingUnits]);

  // ── Handlers ────────────────────────────────────────────────────────

  function pickExistingProduct(p: { id: string; name: string; categoryId: string | null; description: string | null }) {
    setSelected({
      id:          p.id,
      name:        p.name,
      categoryId:  p.categoryId,
      description: p.description ?? "",
    });
    setStep("add-units");
  }

  function addUnit() {
    if (!/^\d{5}$/.test(serialInput)) return;
    if (serialStatus !== "available") return;
    setPendingUnits((prev) => [...prev, { serial: serialInput }]);
    // Auto-increment to next
    const next = String(parseInt(serialInput, 10) + 1).padStart(5, "0");
    setSerialInput(next);
    requestAnimationFrame(() => {
      serialRef.current?.select();
    });
  }

  function removeUnit(serial: string) {
    setPendingUnits((prev) => prev.filter((u) => u.serial !== serial));
  }

  function addBulkUnits(count: number) {
    if (!Number.isFinite(count) || count < 1) return;
    const clamped = Math.min(count, 100);
    const nextFromDb = nextSerialData?.next ? parseInt(nextSerialData.next, 10) : 1;
    const highestPending = pendingUnits.reduce((max, u) => Math.max(max, parseInt(u.serial, 10)), 0);
    const start = Math.max(nextFromDb, highestPending + 1);
    if (start + clamped - 1 > 99999) {
      setSaveError("Serial pool exhausted — not enough 5-digit serials remaining.");
      return;
    }
    const newOnes: PendingUnit[] = Array.from({ length: clamped }, (_, i) => ({
      serial: String(start + i).padStart(5, "0"),
    }));
    setPendingUnits((prev) => [...prev, ...newOnes]);
    setSerialInput(String(start + clamped).padStart(5, "0"));
  }

  async function saveBatch() {
    if (!selected || pendingUnits.length === 0) return;
    setSaveError(null);

    let productId = selected.id;

    // Create product first if needed
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
        setSaveError(e instanceof Error ? e.message : "Failed to create product");
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
      setPendingUnits([]);
      setSerialInput("");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to create equipment");
    }
  }

  function addAnotherProduct() {
    setSelected(null);
    setPendingUnits([]);
    setSerialInput("");
    setSearch("");
    setStep("pick-product");
    setSuccessInfo(null);
  }

  function finish() {
    router.push("/equipment");
  }

  // ── Derived ─────────────────────────────────────────────────────────

  const normalisedSearch = normaliseProductName(search);
  const exactMatch = useMemo(() => {
    if (!search.trim()) return null;
    return (products ?? []).find((p) => p.name.toLowerCase() === normalisedSearch.toLowerCase()) ?? null;
  }, [products, normalisedSearch, search]);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar
        title="Equipment Entry"
        actions={
          step === "add-units" ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStep("pick-product");
                  setPendingUnits([]);
                  setSerialInput("");
                  setSaveError(null);
                }}
              >
                ← Choose product
              </Button>
              <Button variant="secondary" size="sm" onClick={() => router.push("/equipment")}>
                Close
              </Button>
            </>
          ) : step === "confirm" ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setStep("add-units")}>
                ← Back to units
              </Button>
              <Button variant="secondary" size="sm" onClick={() => router.push("/equipment")}>
                Close
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => router.push("/equipment")}>
              ← Back to equipment
            </Button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-[12px]">
          <StepChip active={step === "pick-product"} done={step !== "pick-product"} label="1. Choose product" />
          <span className="text-grey">→</span>
          <StepChip active={step === "add-units"} done={step === "confirm"} label="2. Add units" />
          <span className="text-grey">→</span>
          <StepChip active={step === "confirm"} done={false} label="3. Confirm" />
        </div>

        {step === "pick-product" && (
          <PickProductStep
            search={search}
            setSearch={setSearch}
            products={products ?? []}
            exactMatch={exactMatch}
            categories={categories ?? []}
            onPick={pickExistingProduct}
            onCreateNew={(draft) => {
              setSelected({ id: null, ...draft });
              setStep("add-units");
            }}
          />
        )}

        {step === "add-units" && selected && (
          <AddUnitsStep
            product={selected}
            serialInput={serialInput}
            setSerialInput={setSerialInput}
            onAddUnit={addUnit}
            onAddBulk={addBulkUnits}
            serialStatus={serialStatus}
            takenBy={takenBy}
            nextSerialHint={nextSerialData}
            pendingUnits={pendingUnits}
            onRemoveUnit={removeUnit}
            onBack={() => {
              setStep("pick-product");
              setPendingUnits([]);
              setSerialInput("");
              setSaveError(null);
            }}
            onContinue={() => setStep("confirm")}
            serialRef={serialRef}
          />
        )}

        {step === "confirm" && selected && (
          <ConfirmStep
            product={selected}
            pendingUnits={pendingUnits}
            onBack={() => setStep("add-units")}
            onSave={saveBatch}
            saving={createBatch.isPending || createProduct.isPending}
            saveError={saveError}
            successInfo={successInfo}
            onAddAnother={addAnotherProduct}
            onFinish={finish}
          />
        )}
      </div>
    </>
  );
}

// ── Step 1 — Pick Product ─────────────────────────────────────────────────

function PickProductStep({
  search, setSearch, products, exactMatch, categories, onPick, onCreateNew,
}: {
  search: string;
  setSearch: (s: string) => void;
  products: Array<{ id: string; name: string; categoryId: string | null; description: string | null; category?: { id: string; name: string } | null }>;
  exactMatch: { id: string; name: string; categoryId: string | null; description: string | null } | null;
  categories: Array<{ id: string; name: string; groupName: string }>;
  onPick: (p: { id: string; name: string; categoryId: string | null; description: string | null }) => void;
  onCreateNew: (draft: { name: string; categoryId: string | null; description: string }) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [browseOpen, setBrowseOpen] = useState(false);

  const hasSearch = search.trim().length > 0;
  // Show results only when searching OR when user opens the Browse All dropdown.
  const showResults = hasSearch || browseOpen;

  function startCreating() {
    setNewName(search);
    setNewCategory("");
    setNewDescription("");
    setCreating(true);
  }

  function submitNew() {
    if (!newName.trim()) return;
    onCreateNew({
      name:        newName,
      categoryId:  newCategory || null,
      description: newDescription,
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
      {/* LEFT: Search + results */}
      <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
        <div className="px-5 py-3.5 border-b border-grey-mid">
          <h2 className="text-[13px] font-semibold text-surface-dark">Search catalog</h2>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-[12px] text-grey">
            Find an existing product in your workspace catalog, or browse all.
          </p>

          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder="Start typing, e.g. Arri SkyPanel…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setBrowseOpen(false); }}
              className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 pr-9 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            />
            {!hasSearch && (
              <button
                type="button"
                onClick={() => setBrowseOpen((v) => !v)}
                aria-label={browseOpen ? "Hide all products" : "Browse all products"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-grey hover:text-brand-blue text-[11px] font-semibold px-1.5"
              >
                {browseOpen ? "▲" : "▼"}
              </button>
            )}
          </div>

          {showResults && products.length === 0 && hasSearch && (
            <div className="text-center py-6 text-[12px] text-grey space-y-3">
              <p>No products matching &ldquo;{search}&rdquo;.</p>
              <Button size="sm" variant="primary" onClick={startCreating}>
                + Create &ldquo;{normaliseProductName(search)}&rdquo; as new
              </Button>
            </div>
          )}

          {showResults && products.length === 0 && !hasSearch && (
            <div className="text-center py-6 text-[12px] text-grey">
              No products in the catalog yet — create your first on the right.
            </div>
          )}

          {showResults && products.length > 0 && (
            <ul className="divide-y divide-grey-mid border border-grey-mid rounded-btn overflow-hidden max-h-[360px] overflow-y-auto">
              {products.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => onPick(p)}
                    className="w-full px-3 py-2 text-left hover:bg-grey-light transition-colors flex items-center gap-3"
                  >
                    <span className="text-[13px] text-surface-dark flex-1 truncate">{p.name}</span>
                    <span className="text-[11px] text-grey whitespace-nowrap">{p.category?.name ?? "—"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {showResults && !exactMatch && products.length > 0 && hasSearch && (
            <button
              onClick={startCreating}
              className="w-full text-[12px] text-brand-blue hover:underline text-left"
            >
              + Not the right one? Create &ldquo;{normaliseProductName(search)}&rdquo; as new
            </button>
          )}
        </div>
      </div>

      {/* RIGHT: Create new product */}
      <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
        <div className="px-5 py-3.5 border-b border-grey-mid">
          <h2 className="text-[13px] font-semibold text-surface-dark">
            {creating ? "New product" : "Or create new"}
          </h2>
        </div>
        <div className="p-5 space-y-3">
          {!creating ? (
            <>
              <p className="text-[12px] text-grey">
                Can&rsquo;t find what you&rsquo;re looking for? Add a new product to your catalog &mdash;
                it&rsquo;ll be available for everyone in this workspace going forward.
              </p>
              <Button size="sm" variant="secondary" onClick={startCreating}>
                + New product
              </Button>
            </>
          ) : (
            <>
              <Field label="Product name" required>
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={(e) => setNewName(normaliseProductName(e.target.value))}
                  placeholder="e.g. Arri SkyPanel S60-C"
                  className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
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
                  className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Description" optional>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Specs, notes, accessories included…"
                  className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue resize-none"
                />
              </Field>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="primary" onClick={submitNew} disabled={!newName.trim()}>
                  Continue →
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 2 — Add Units ────────────────────────────────────────────────────

function AddUnitsStep({
  product, serialInput, setSerialInput, onAddUnit, onAddBulk, serialStatus, takenBy,
  nextSerialHint, pendingUnits, onRemoveUnit, onBack, onContinue, serialRef,
}: {
  product: SelectedProduct;
  serialInput: string;
  setSerialInput: (s: string) => void;
  onAddUnit: () => void;
  onAddBulk: (count: number) => void;
  serialStatus: "idle" | "checking" | "available" | "taken" | "duplicate";
  takenBy: string | null;
  nextSerialHint: { last: string | null; next: string } | undefined;
  pendingUnits: PendingUnit[];
  onRemoveUnit: (serial: string) => void;
  onBack: () => void;
  onContinue: () => void;
  serialRef: React.RefObject<HTMLInputElement>;
}) {
  const [bulkCount, setBulkCount] = useState(5);

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && serialStatus === "available") {
      e.preventDefault();
      onAddUnit();
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
      {/* LEFT: Scan & pending units */}
      <div className="space-y-4">
        <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
          <div className="px-5 py-3.5 border-b border-grey-mid">
            <h2 className="text-[13px] font-semibold text-surface-dark">Scan or enter serial</h2>
          </div>
          <div className="p-5 space-y-3">
            <input
              ref={serialRef}
              type="text"
              inputMode="numeric"
              autoFocus
              placeholder="00001"
              value={serialInput}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 5);
                setSerialInput(v);
              }}
              onKeyDown={onKey}
              className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            />

            <SerialStatusLine
              status={serialStatus}
              takenBy={takenBy}
              serial={serialInput}
              nextHint={nextSerialHint}
            />

            <Button
              size="sm"
              variant="primary"
              className="w-full"
              disabled={serialStatus !== "available"}
              onClick={onAddUnit}
            >
              Add unit
            </Button>
          </div>
        </div>

        {/* Bulk add — skip scanning when you're registering a big batch of identical units */}
        <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
          <div className="px-5 py-3.5 border-b border-grey-mid">
            <h2 className="text-[13px] font-semibold text-surface-dark">Or add in bulk</h2>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-[11px] text-grey">
              Assigns the next {bulkCount} sequential serial{bulkCount !== 1 ? "s" : ""} starting from <span className="font-semibold text-surface-dark">{nextSerialHint?.next ?? "—"}</span>. Max 100 at a time.
            </p>
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
                className="w-20 bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
              />
              <Button
                size="sm"
                variant="primary"
                onClick={() => onAddBulk(bulkCount)}
                className="flex-1"
              >
                Add {bulkCount} unit{bulkCount !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </div>

      </div>

      {/* RIGHT: Summary of what's being added */}
      <div className="space-y-4">
        <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
          <div className="px-5 py-3.5 border-b border-grey-mid flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-surface-dark">Adding</h2>
            <button onClick={onBack} className="text-[11px] text-grey hover:text-surface-dark">
              Change product
            </button>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <div className="text-[11px] text-grey uppercase tracking-wide mb-0.5">Product</div>
              <div className="text-[14px] font-semibold text-surface-dark">{product.name}</div>
              {product.description && (
                <p className="text-[12px] text-grey mt-1">{product.description}</p>
              )}
              {product.id === null && (
                <p className="text-[11px] text-brand-blue mt-2">+ Will be added to the catalog on save</p>
              )}
            </div>

            <div className="border-t border-grey-mid pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] text-grey uppercase tracking-wide">
                  Units ({pendingUnits.length})
                </div>
                {pendingUnits.length > 0 && (
                  <button
                    onClick={() => pendingUnits.forEach((u) => onRemoveUnit(u.serial))}
                    className="text-[11px] text-grey hover:text-status-red"
                  >
                    Clear
                  </button>
                )}
              </div>
              {pendingUnits.length === 0 ? (
                <p className="text-[12px] text-grey text-center py-4">
                  Scan serials to add units
                </p>
              ) : (
                <div className="space-y-1 max-h-[160px] overflow-y-auto">
                  {pendingUnits.map((u) => (
                    <div key={u.serial} className="flex items-center gap-2 px-2 py-1.5 rounded-btn hover:bg-grey-light">
                      <span className="text-[13px] text-surface-dark flex-1">{u.serial}</span>
                      <button
                        onClick={() => onRemoveUnit(u.serial)}
                        className="text-grey hover:text-status-red text-[14px] leading-none"
                        aria-label={`Remove ${u.serial}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-card border border-grey-mid p-4 flex items-center justify-between gap-3">
          <p className="text-[12px] text-grey flex-1">
            {pendingUnits.length === 0
              ? "Scan at least one serial to continue."
              : `${pendingUnits.length} unit${pendingUnits.length !== 1 ? "s" : ""} ready to review.`}
          </p>
          <Button
            size="sm"
            variant="primary"
            disabled={pendingUnits.length === 0}
            onClick={onContinue}
          >
            Continue →
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Step 3 — Confirm ───────────────────────────────────────────────────────

function ConfirmStep({
  product, pendingUnits, onBack, onSave, saving, saveError,
  successInfo, onAddAnother, onFinish,
}: {
  product: SelectedProduct;
  pendingUnits: PendingUnit[];
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
  successInfo: { count: number; name: string } | null;
  onAddAnother: () => void;
  onFinish: () => void;
}) {
  if (successInfo) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-card border border-grey-mid p-8 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-status-green flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <div className="text-[18px] font-bold text-surface-dark">Equipment added</div>
            <div className="text-[13px] text-grey mt-1">
              Created {successInfo.count} unit{successInfo.count !== 1 ? "s" : ""} of <strong className="text-surface-dark">{successInfo.name}</strong>.
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="secondary" onClick={onAddAnother}>
              + Another product
            </Button>
            <Button size="sm" variant="primary" onClick={onFinish}>
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const categoryLabel = product.name; // product name shown as primary; category handled below if you want it
  void categoryLabel;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Summary card */}
      <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
        <div className="px-5 py-3.5 border-b border-grey-mid">
          <h2 className="text-[13px] font-semibold text-surface-dark">Review & confirm</h2>
        </div>
        <dl className="divide-y divide-grey-mid">
          <ConfirmRow label="Product" value={product.name} />
          {product.description && <ConfirmRow label="Description" value={product.description} wrap />}
          <ConfirmRow
            label="Total units"
            value={`${pendingUnits.length} unit${pendingUnits.length !== 1 ? "s" : ""}`}
          />
          {product.id === null && (
            <ConfirmRow
              label="Catalog"
              value="New product — will be added on confirm"
            />
          )}
        </dl>
      </div>

      {/* Serials list */}
      <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
        <div className="px-5 py-3.5 border-b border-grey-mid flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-surface-dark">
            Serials <span className="text-grey font-normal">({pendingUnits.length})</span>
          </h3>
          {pendingUnits.length > 0 && (
            <span className="text-[11px] text-grey">
              {pendingUnits[0].serial} – {pendingUnits[pendingUnits.length - 1].serial}
            </span>
          )}
        </div>
        <div className="p-3 max-h-[220px] overflow-y-auto">
          <div className="grid grid-cols-5 gap-1.5">
            {pendingUnits.map((u) => (
              <span
                key={u.serial}
                className="px-2 py-1 rounded-btn bg-grey-light text-[12px] font-mono text-surface-dark text-center"
              >
                {u.serial}
              </span>
            ))}
          </div>
        </div>
      </div>

      {saveError && (
        <div className="bg-status-red-light border border-status-red/20 rounded-card px-4 py-3 text-[12px] text-status-red">
          {saveError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <Button size="sm" variant="secondary" onClick={onBack} disabled={saving}>
          ← Back
        </Button>
        <Button size="sm" variant="primary" onClick={onSave} disabled={saving || pendingUnits.length === 0}>
          {saving ? "Saving…" : `Confirm & create ${pendingUnits.length} unit${pendingUnits.length !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}

function ConfirmRow({ label, value, wrap }: { label: string; value: string; wrap?: boolean }) {
  return (
    <div className="px-5 py-3 flex items-start gap-4">
      <dt className="text-[11px] font-semibold text-grey uppercase tracking-wide w-28 shrink-0 mt-0.5">{label}</dt>
      <dd className={`text-[13px] text-surface-dark flex-1 min-w-0 ${wrap ? "whitespace-pre-wrap break-words" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

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
        Last serial used: <span className="font-semibold">{nextHint?.last ?? "—"}</span>{" "}
        · Next free: <span className="font-semibold text-brand-blue">{nextHint?.next ?? "—"}</span>
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

function StepChip({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  const reached = active || done;
  return (
    <span
      className={[
        "px-3 py-1 rounded-md border text-[12px] font-semibold",
        reached
          ? "bg-brand-blue-light text-brand-blue border-brand-blue/30"
          : "bg-grey-light text-grey border-grey-mid",
      ].join(" ")}
    >
      {label}
    </span>
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
      <label className="block text-[11px] font-semibold text-grey uppercase tracking-wide mb-1">
        {label}
        {required && <span className="text-status-red ml-1">*</span>}
        {optional && <span className="text-grey font-normal normal-case ml-1">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
