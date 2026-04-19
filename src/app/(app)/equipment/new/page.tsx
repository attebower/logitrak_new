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

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { normaliseProductName } from "@/lib/normalise";

// ── Types ────────────────────────────────────────────────────────────────

type Step = "pick-product" | "add-units";

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
          <Button variant="secondary" size="sm" onClick={() => router.push("/equipment")}>
            ← Back to equipment
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-[12px]">
          <StepChip active={step === "pick-product"} done={step !== "pick-product"} label="1. Choose product" />
          <span className="text-grey">→</span>
          <StepChip active={step === "add-units"} done={false} label="2. Add units" />
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
            onSave={saveBatch}
            saving={createBatch.isPending || createProduct.isPending}
            saveError={saveError}
            successInfo={successInfo}
            onAddAnother={addAnotherProduct}
            onFinish={finish}
            serialRef={serialRef}
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
        <div className="p-5 space-y-4">
          <input
            type="text"
            autoFocus
            placeholder="Start typing, e.g. Arri SkyPanel…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
          />

          {products.length === 0 && search.trim() && (
            <div className="text-center py-6 text-[12px] text-grey space-y-3">
              <p>No products matching &ldquo;{search}&rdquo;.</p>
              <Button size="sm" variant="primary" onClick={startCreating}>
                + Create &ldquo;{normaliseProductName(search)}&rdquo; as new
              </Button>
            </div>
          )}

          {!search.trim() && products.length === 0 && (
            <div className="text-center py-6 text-[12px] text-grey">
              Search your workspace catalog — or create the first product on the right.
            </div>
          )}

          {products.length > 0 && (
            <div className="divide-y divide-grey-mid border border-grey-mid rounded-card overflow-hidden">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPick(p)}
                  className="w-full px-4 py-3 text-left hover:bg-grey-light transition-colors"
                >
                  <div className="text-[13px] font-semibold text-surface-dark">{p.name}</div>
                  <div className="text-[11px] text-grey mt-0.5">
                    {p.category?.name ?? "Uncategorised"}
                    {p.description ? ` · ${p.description.slice(0, 80)}${p.description.length > 80 ? "…" : ""}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}

          {!exactMatch && products.length > 0 && search.trim() && (
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
  product, serialInput, setSerialInput, onAddUnit, serialStatus, takenBy,
  nextSerialHint, pendingUnits, onRemoveUnit, onBack, onSave, saving, saveError,
  successInfo, onAddAnother, onFinish, serialRef,
}: {
  product: SelectedProduct;
  serialInput: string;
  setSerialInput: (s: string) => void;
  onAddUnit: () => void;
  serialStatus: "idle" | "checking" | "available" | "taken" | "duplicate";
  takenBy: string | null;
  nextSerialHint: { last: string | null; next: string } | undefined;
  pendingUnits: PendingUnit[];
  onRemoveUnit: (serial: string) => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
  successInfo: { count: number; name: string } | null;
  onAddAnother: () => void;
  onFinish: () => void;
  serialRef: React.RefObject<HTMLInputElement>;
}) {
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
        <div className="bg-white rounded-card border border-grey-mid border-l-4 border-l-brand-blue overflow-hidden">
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

        {successInfo && (
          <div className="bg-status-green/5 border border-status-green/30 rounded-card px-4 py-3 text-[12px] text-surface-dark">
            ✅ Created {successInfo.count} unit{successInfo.count !== 1 ? "s" : ""} of <strong>{successInfo.name}</strong>.
          </div>
        )}

        {saveError && (
          <div className="bg-status-red-light border border-status-red/20 rounded-card px-4 py-3 text-[12px] text-status-red">
            {saveError}
          </div>
        )}
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
                <div className="space-y-1 max-h-[260px] overflow-y-auto">
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
          {!successInfo ? (
            <>
              <p className="text-[12px] text-grey flex-1">
                {pendingUnits.length === 0
                  ? "Scan at least one serial to save."
                  : `Ready to save ${pendingUnits.length} unit${pendingUnits.length !== 1 ? "s" : ""} of ${product.name}.`}
              </p>
              <Button
                size="sm"
                variant="primary"
                disabled={pendingUnits.length === 0 || saving}
                onClick={onSave}
              >
                {saving ? "Saving…" : `Save ${pendingUnits.length || ""} →`}
              </Button>
            </>
          ) : (
            <>
              <p className="text-[12px] text-grey flex-1">What next?</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={onAddAnother}>
                  + Another product
                </Button>
                <Button size="sm" variant="primary" onClick={onFinish}>
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
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
  return (
    <span
      className={[
        "px-3 py-1 rounded-md border text-[12px] font-semibold",
        active ? "bg-brand-blue/10 text-brand-blue border-brand-blue/30"
               : done ? "bg-status-green/10 text-status-green border-status-green/30"
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
