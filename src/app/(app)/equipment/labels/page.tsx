"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { LabelPreview } from "@/components/labels/LabelPreview";
import {
  LABEL_DESIGNS, STICKERMULE_SIZES, BROTHER_QL_SIZES,
  formatSerial, getStickerMuleSize,
  type OutputMethod,
} from "@/lib/labels/catalog";
import { Package, Printer, PenLine, ChevronRight, ExternalLink, Check, Download, X, CheckCircle2, AlertCircle } from "lucide-react";

export default function GenerateLabelsPage() {
  const { workspaceId } = useWorkspace();

  const { data: state, isLoading, refetch: refetchState }   = trpc.labels.state.useQuery({ workspaceId });
  const { data: batches, refetch: refetchBatches }          = trpc.labels.activeBatches.useQuery({ workspaceId });
  const reserveMutation    = trpc.labels.reserveBatch.useMutation();
  const cancelMutation     = trpc.labels.cancelBatch.useMutation();
  const clearEmptyMutation = trpc.labels.clearEmptyBatches.useMutation();
  const orderStickerMule   = trpc.labels.orderStickerMule.useMutation();

  const [quantity, setQuantity]             = useState<number>(25);
  const [design, setDesign]                 = useState<"minimal" | "standard" | "full">("standard");
  const [method, setMethod]                 = useState<OutputMethod>("stickermule");
  const [smSizeId, setSmSizeId]             = useState(STICKERMULE_SIZES[1]!.id);
  const [brotherSizeId, setBrotherSizeId]   = useState(BROTHER_QL_SIZES[0]!.id);
  const [useCustomStart, setUseCustomStart] = useState(false);
  const [customStart, setCustomStart]       = useState<number>(1);
  const [reserved, setReserved]             = useState<{ serialStart: number; serialEnd: number; batchId: string } | null>(null);
  const [orderUrl, setOrderUrl]             = useState<string | null>(null);
  const [cancelError, setCancelError]       = useState<string | null>(null);

  useEffect(() => {
    if (state?.lastLabelDesign) setDesign(state.lastLabelDesign as "minimal" | "standard" | "full");
  }, [state?.lastLabelDesign]);

  const smSize      = getStickerMuleSize(smSizeId)!;
  const brotherSize = BROTHER_QL_SIZES.find((s) => s.id === brotherSizeId)!;
  const activeSize  = method === "stickermule" ? smSize : brotherSize;

  const nextSerial    = state?.nextSerial ?? 1;
  const previewSerial = formatSerial(useCustomStart ? customStart : nextSerial);
  const orgName       = state?.orgName ?? "Your Organisation";
  const workspaceSlug = state?.workspaceSlug ?? "";
  const totalCost     = method === "stickermule" ? ((smSize.unitPricePence * quantity) / 100).toFixed(2) : null;

  function refetchAll() { void refetchState(); void refetchBatches(); }

  async function handleReserve() {
    const sizeId = method === "stickermule" ? smSizeId : method === "brother_ql" ? brotherSizeId : "custom";
    const result = await reserveMutation.mutateAsync({
      workspaceId, quantity, design, labelSize: sizeId, method,
      ...(useCustomStart ? { customSerialStart: customStart } : {}),
    });
    setReserved({ serialStart: result.serialStart, serialEnd: result.serialEnd, batchId: result.id });
    refetchAll();
  }

  async function handleStickerMuleOrder() {
    if (!reserved) return;
    const result = await orderStickerMule.mutateAsync({ workspaceId, batchId: reserved.batchId, sizeId: smSizeId, quantity });
    setOrderUrl(result.checkoutUrl);
    window.open(result.checkoutUrl, "_blank");
  }

  async function handleCancel(batchId: string) {
    setCancelError(null);
    try {
      await cancelMutation.mutateAsync({ workspaceId, batchId });
      if (reserved?.batchId === batchId) setReserved(null);
      refetchAll();
    } catch (e: unknown) {
      setCancelError(e instanceof Error ? e.message : "Could not cancel.");
    }
  }

  async function handleClearEmpty() {
    setCancelError(null);
    await clearEmptyMutation.mutateAsync({ workspaceId });
    setReserved(null);
    refetchAll();
  }

  function handleDownloadCsv(serialStart: number, serialEnd: number) {
    const rows = ["serial,qr_url"];
    for (let i = serialStart; i <= serialEnd; i++) {
      const serial = i.toString().padStart(5, "0");
      rows.push(`${serial},https://app.logitrack.io/${workspaceSlug}/equipment/${serial}`);
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `logitrak-serials-${serialStart.toString().padStart(5,"0")}-${serialEnd.toString().padStart(5,"0")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <AppTopbar title="Labels" />
        <div className="flex-1 flex items-center justify-center text-[13px] text-grey">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <AppTopbar title="Labels" />
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6">

        <div>
          <h1 className="text-xl font-semibold text-surface-dark">Generate Labels</h1>
          <p className="text-[13px] text-grey mt-1">
            Next serial: <span className="font-mono font-semibold text-surface-dark">{formatSerial(nextSerial)}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

          {/* LEFT */}
          <div className="space-y-5">

            {/* Quantity */}
            <div className="bg-white rounded-card border border-grey-mid p-5">
              <p className="text-[12px] font-semibold text-grey uppercase tracking-wider mb-3">How many labels?</p>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="number" min={1} max={500} value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(500, Number(e.target.value))))}
                  className="w-28 border border-grey-mid rounded-btn px-3 py-2 text-[14px] font-semibold text-surface-dark focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                />
                {!useCustomStart && (
                  <span className="text-[13px] text-grey">
                    Serials {formatSerial(nextSerial)} – {formatSerial(nextSerial + quantity - 1)}
                  </span>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={useCustomStart} onChange={(e) => setUseCustomStart(e.target.checked)} className="accent-brand-blue" />
                <span className="text-[12px] text-grey">Use a custom starting serial</span>
              </label>
              {useCustomStart && (
                <div className="mt-3 flex items-center gap-3">
                  <div>
                    <label className="block text-[11px] text-grey mb-1">Starting serial</label>
                    <input
                      type="number" min={1} value={customStart}
                      onChange={(e) => setCustomStart(Math.max(1, Number(e.target.value)))}
                      className="w-28 border border-grey-mid rounded-btn px-3 py-2 text-[14px] font-semibold font-mono text-surface-dark focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                    />
                  </div>
                  <span className="text-[13px] text-grey mt-4">{formatSerial(customStart)} – {formatSerial(customStart + quantity - 1)}</span>
                </div>
              )}
            </div>

            {/* Design */}
            <div className="bg-white rounded-card border border-grey-mid p-5">
              <p className="text-[12px] font-semibold text-grey uppercase tracking-wider mb-3">Pick a design</p>
              <div className="grid grid-cols-3 gap-3">
                {LABEL_DESIGNS.map((d) => (
                  <button key={d.id} onClick={() => setDesign(d.id)}
                    className={`rounded-lg border-2 p-3 text-left transition-colors ${design === d.id ? "border-brand-blue bg-brand-blue/5" : "border-grey-mid hover:border-slate-300"}`}
                  >
                    <div className="flex justify-center mb-2">
                      <LabelPreview widthMm={54} heightMm={25} design={d.id} codeType="qr" serial={previewSerial} orgName={orgName} scale={2.5} />
                    </div>
                    <p className="text-[12px] font-semibold text-surface-dark">{d.label}</p>
                    <p className="text-[11px] text-grey mt-0.5 leading-snug">{d.description}</p>
                    {design === d.id && (
                      <div className="mt-1.5 flex items-center gap-1 text-brand-blue">
                        <Check className="w-3 h-3" strokeWidth={2.5} />
                        <span className="text-[11px] font-semibold">Selected</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Method */}
            <div className="bg-white rounded-card border border-grey-mid p-5">
              <p className="text-[12px] font-semibold text-grey uppercase tracking-wider mb-3">How do you want them?</p>
              <div className="grid grid-cols-2 gap-3">

                <button onClick={() => setMethod("stickermule")}
                  className={`rounded-lg border-2 p-4 text-left transition-colors ${method === "stickermule" ? "border-brand-blue bg-brand-blue/5" : "border-grey-mid hover:border-slate-300"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-brand-blue" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-surface-dark">Order Stickers</p>
                      <p className="text-[11px] text-grey mt-0.5 leading-snug">Vinyl stickers delivered to your door via StickerMule.</p>
                    </div>
                  </div>
                  {method === "stickermule" && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] font-semibold text-grey uppercase tracking-wider">Sticker size</p>
                      <div className="space-y-1.5">
                        {STICKERMULE_SIZES.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="smSize" checked={smSizeId === s.id} onChange={() => setSmSizeId(s.id)} className="accent-brand-blue" />
                            <span className="text-[12px] text-surface-dark">{s.label}</span>
                            <span className="ml-auto text-[11px] text-grey">~£{((s.unitPricePence * quantity) / 100).toFixed(2)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </button>

                <button onClick={() => setMethod("brother_ql")}
                  className={`rounded-lg border-2 p-4 text-left transition-colors ${method === "brother_ql" ? "border-brand-blue bg-brand-blue/5" : "border-grey-mid hover:border-slate-300"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Printer className="w-5 h-5 text-slate-500" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-surface-dark">Print Yourself</p>
                      <p className="text-[11px] text-grey mt-0.5 leading-snug">Brother QL label printer. Download a PDF and print right now.</p>
                    </div>
                  </div>
                  {method === "brother_ql" && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] font-semibold text-grey uppercase tracking-wider">Label size</p>
                      <div className="space-y-1.5">
                        {BROTHER_QL_SIZES.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="brotherSize" checked={brotherSizeId === s.id} onChange={() => setBrotherSizeId(s.id)} className="accent-brand-blue" />
                            <span className="text-[12px] text-surface-dark">{s.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </button>

                <button onClick={() => setMethod("custom_csv")}
                  className={`col-span-2 rounded-lg border-2 p-4 text-left transition-colors ${method === "custom_csv" ? "border-brand-blue bg-brand-blue/5" : "border-grey-mid hover:border-slate-300"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <PenLine className="w-5 h-5 text-slate-500" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-surface-dark">Design your own</p>
                      <p className="text-[12px] text-grey mt-0.5 leading-snug">Use any label software or printer you like. We’ll give you a CSV of serial numbers — design your labels, stick them on, and scan them in. That’s it.</p>
                    </div>
                  </div>
                </button>

              </div>
            </div>

            {reserveMutation.error && <p className="text-[12px] text-status-red">{reserveMutation.error.message}</p>}

            {!reserved ? (
              <Button onClick={handleReserve} disabled={reserveMutation.isPending} className="w-full">
                {reserveMutation.isPending ? "Reserving serials…" : `Reserve ${quantity} serial${quantity !== 1 ? "s" : ""}`}
                {!reserveMutation.isPending && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            ) : (
              <div className="bg-white rounded-card border border-grey-mid p-5 space-y-4">
                <div>
                  <p className="text-[13px] font-semibold text-surface-dark">
                    ✓ Reserved {formatSerial(reserved.serialStart)} – {formatSerial(reserved.serialEnd)}
                  </p>
                  <p className="text-[12px] text-grey mt-0.5">Serials locked in. Visible in the panel on the right.</p>
                </div>
                {method === "stickermule" ? (
                  <div className="space-y-2">
                    {totalCost && <p className="text-[12px] text-grey">Estimated cost: <span className="font-semibold text-surface-dark">~£{totalCost}</span> — paid directly to StickerMule.</p>}
                    <Button onClick={handleStickerMuleOrder} disabled={orderStickerMule.isPending} className="w-full">
                      {orderStickerMule.isPending ? "Opening StickerMule…" : "Order on StickerMule"}
                      <ExternalLink className="w-4 h-4 ml-1.5" />
                    </Button>
                    {orderUrl && <p className="text-[12px] text-grey text-center">Didn’t open? <a href={orderUrl} target="_blank" rel="noreferrer" className="text-brand-blue underline">Click here</a></p>}
                  </div>
                ) : method === "brother_ql" ? (
                  <Button asChild className="w-full">
                    <Link href={`/api/labels/generate?batchId=${reserved.batchId}`} target="_blank">
                      Download ZIP <ExternalLink className="w-4 h-4 ml-1.5" />
                    </Link>
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[12px] text-grey leading-relaxed">Design your labels in any software — include the serial or QR URL from the CSV, stick them on, scan them in.</p>
                    <Button onClick={() => handleDownloadCsv(reserved.serialStart, reserved.serialEnd)} className="w-full">
                      Download CSV <Download className="w-4 h-4 ml-1.5" />
                    </Button>
                  </div>
                )}
                <button onClick={() => setReserved(null)} className="w-full text-[12px] text-grey hover:text-surface-dark">Reserve another batch</button>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="space-y-4">

            <div className="bg-white rounded-card border border-grey-mid p-5">
              <p className="text-[12px] font-semibold text-grey uppercase tracking-wider mb-3">Preview</p>
              <div className="flex justify-center">
                <LabelPreview
                  widthMm={activeSize.widthMm} heightMm={activeSize.heightMm}
                  design={design} codeType="qr" serial={previewSerial} orgName={orgName} scale={3}
                />
              </div>
              <p className="text-center text-[11px] text-grey mt-2">{activeSize.label}</p>
            </div>

            <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
              <div className="px-4 py-3 border-b border-grey-mid flex items-start justify-between gap-2">
                <div>
                  <p className="text-[12px] font-semibold text-surface-dark">Reserved serials</p>
                  <p className="text-[11px] text-grey mt-0.5">Cancel any batch before equipment is scanned in.</p>
                </div>
                {batches && batches.some((b) => b.derivedStatus === "pending" && b.entered === 0) && (
                  <button onClick={handleClearEmpty} disabled={clearEmptyMutation.isPending}
                    className="text-[11px] text-grey hover:text-status-red transition-colors flex-shrink-0 mt-0.5">
                    {clearEmptyMutation.isPending ? "Clearing…" : "Clear empty"}
                  </button>
                )}
              </div>

              {cancelError && (
                <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-[11px] text-status-red flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{cancelError}
                </div>
              )}

              {!batches || batches.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-grey">No active reservations.</p>
              ) : (
                <div className="divide-y divide-grey-mid">
                  {batches.map((batch) => (
                    <div key={batch.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[12px] font-mono font-semibold text-surface-dark">
                            {formatSerial(batch.serialStart)} – {formatSerial(batch.serialEnd)}
                          </p>
                          <p className="text-[11px] text-grey mt-0.5">{batch.quantity} label{batch.quantity !== 1 ? "s" : ""}</p>
                        </div>
                        {batch.derivedStatus === "complete" ? (
                          <span className="flex items-center gap-1 text-[11px] text-status-green flex-shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />All entered
                          </span>
                        ) : (
                          <button onClick={() => handleCancel(batch.id)} disabled={cancelMutation.isPending}
                            className="flex items-center gap-1 text-[11px] text-grey hover:text-status-red transition-colors flex-shrink-0">
                            <X className="w-3.5 h-3.5" />Cancel
                          </button>
                        )}
                      </div>
                      {batch.derivedStatus === "partial" && (
                        <div className="mt-2 space-y-1.5">
                          <div className="w-full bg-grey-light rounded-full h-1">
                            <div className="bg-status-green h-1 rounded-full" style={{ width: `${Math.round((batch.entered / batch.quantity) * 100)}%` }} />
                          </div>
                          <p className="text-[11px] text-grey">
                            {batch.entered} of {batch.quantity} entered — cancelling will free the remaining {batch.quantity - batch.entered} serial{batch.quantity - batch.entered !== 1 ? "s" : ""}.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
