"use client";

/**
 * Generate Labels — the friendly label creation flow.
 *
 * User journey:
 *   1. How many do you need? (quantity input, next serial shown)
 *   2. Pick a design (5 thumbnails, live preview)
 *   3. Pick your printer (brand → size)
 *   4. Print / Download
 *
 * On confirm we reserve serials atomically (server-side) and output
 * PDF/ZPL/DYMO XML. Serials are burned — non-reversible.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { LabelPreview } from "@/components/labels/LabelPreview";
import {
  PRINTERS, LABEL_DESIGNS, getPrinter, getLabelSize, formatSerial,
  type PrinterType, type LabelDesign, type CodeType,
} from "@/lib/labels/catalog";
import { triggerLabelGeneration } from "@/lib/labels/print";
import { ChevronLeft, ChevronRight, Tag, QrCode, Barcode as BarcodeIcon, Printer, FileText, Info } from "lucide-react";

export default function GenerateLabelsPage() {
  const { workspaceId } = useWorkspace();

  const { data: state, isLoading: stateLoading, refetch } = trpc.labels.state.useQuery({ workspaceId });

  const reserveMutation = trpc.labels.reserveBatch.useMutation();

  // Form state
  const [quantity, setQuantity] = useState<number>(10);
  const [design, setDesign] = useState<LabelDesign>("standard");
  const [codeType, setCodeType] = useState<CodeType>("qr");
  const [printer, setPrinter] = useState<PrinterType>("generic_pdf");
  const [sizeId, setSizeId] = useState<string>("");
  const [outputFormat, setOutputFormat] = useState<"native" | "pdf">("native");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [lastBatch, setLastBatch] = useState<{ serialStart: number; serialEnd: number } | null>(null);

  // When the workspace state loads, pre-fill printer / size / design from saved prefs
  useEffect(() => {
    if (!state) return;
    if (state.lastPrinterType) {
      const p = getPrinter(state.lastPrinterType as PrinterType);
      if (p) {
        setPrinter(p.id);
        if (state.lastLabelSize && p.sizes.find((s) => s.id === state.lastLabelSize)) {
          setSizeId(state.lastLabelSize);
        } else {
          setSizeId(p.sizes[0]?.id ?? "");
        }
      }
    } else {
      setSizeId(getPrinter(printer)?.sizes[0]?.id ?? "");
    }
    if (state.lastLabelDesign) setDesign(state.lastLabelDesign as LabelDesign);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.lastPrinterType, state?.lastLabelSize, state?.lastLabelDesign]);

  // When printer changes, reset size to its first option (only if current size isn't valid)
  useEffect(() => {
    const p = getPrinter(printer);
    if (!p) return;
    if (!p.sizes.find((s) => s.id === sizeId)) {
      setSizeId(p.sizes[0]?.id ?? "");
    }
    // If printer has no native format, force PDF
    const hasNative = p.outputFormat !== "pdf" || printer === "brother_ql" || printer === "brother_pt";
    if (!hasNative) setOutputFormat("pdf");
    else setOutputFormat("native");
  }, [printer, sizeId]);

  const currentPrinter = useMemo(() => getPrinter(printer), [printer]);
  const currentSize = useMemo(
    () => (sizeId ? getLabelSize(printer, sizeId) : undefined),
    [printer, sizeId]
  );

  const nextSerial = state?.nextSerial ?? 1;
  const serialStart = nextSerial;
  const serialEnd = nextSerial + quantity - 1;
  const previewSerial = formatSerial(serialStart + previewIndex);

  // Clamp preview index when quantity changes
  useEffect(() => {
    if (previewIndex >= quantity) setPreviewIndex(Math.max(0, quantity - 1));
  }, [quantity, previewIndex]);

  const canPrint = !!currentSize && quantity > 0 && quantity <= 200 && !printing;

  async function handleGenerate() {
    if (!currentSize || !currentPrinter || !state) return;
    setPrinting(true);
    try {
      const batch = await reserveMutation.mutateAsync({
        workspaceId,
        quantity,
        design,
        codeType,
        labelType: "blank",
        printerType: printer,
        labelSize: sizeId,
      });

      await triggerLabelGeneration({
        batchId: batch.id,
        outputFormat,
        printInline: outputFormat === "pdf",
      });

      setLastBatch({ serialStart: batch.serialStart, serialEnd: batch.serialEnd });
      setPreviewIndex(0);
      await refetch();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Something went wrong generating the labels. Please try again.");
    } finally {
      setPrinting(false);
    }
  }

  // Helper: does the chosen printer have a native/smart output format (non-PDF)?
  const hasNativeFormat =
    currentPrinter?.outputFormat === "dymo_xml" ||
    currentPrinter?.outputFormat === "zpl" ||
    printer === "brother_ql" || printer === "brother_pt";

  const nativeDescription =
    printer === "brother_ql" || printer === "brother_pt"
      ? "ZIP containing .lbx (opens in P-touch Editor) + serials.csv"
      : currentPrinter?.outputFormat === "dymo_xml"
      ? "ZIP containing one .label file per serial (opens in DYMO Connect)"
      : currentPrinter?.outputFormat === "zpl"
      ? "Zebra ZPL file — send to your printer"
      : "PDF";

  if (stateLoading || !state) {
    return (
      <>
        <AppTopbar title="Generate Labels" />
        <div className="flex-1 p-6 text-grey text-[13px]">Loading…</div>
      </>
    );
  }

  return (
    <>
      <AppTopbar
        title="Generate Labels"
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link href="/equipment">← Equipment</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">

          {/* Confirmation banner after printing */}
          {lastBatch && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-card px-5 py-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-green-500 text-white flex items-center justify-center">✓</div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-green-900">
                  Labels ready — serials {formatSerial(lastBatch.serialStart)} to {formatSerial(lastBatch.serialEnd)}
                </div>
                <div className="text-[12px] text-green-700">
                  Stick them on your kit, then scan them in via Add Equipment.
                </div>
              </div>
              <Link href="/equipment/new" className="text-[12px] font-semibold text-green-900 hover:underline">
                Add Equipment →
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* ── LEFT: form ── */}
            <div className="lg:col-span-3 space-y-6">

              {/* Step 1 — Quantity */}
              <section className="bg-white border border-grey-mid rounded-card shadow-card">
                <header className="px-5 py-4 border-b border-grey-mid">
                  <h2 className="text-[14px] font-semibold text-surface-dark flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-brand-blue text-white text-[11px] font-bold flex items-center justify-center">1</span>
                    How many labels do you need?
                  </h2>
                </header>
                <div className="p-5 space-y-3">
                  <div className="flex items-end gap-4">
                    <div>
                      <label className="text-[11px] text-grey block mb-1">Quantity</label>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                        className="w-28 h-11 px-3 text-[18px] font-bold rounded-md border border-grey-mid focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                      />
                    </div>
                    <div className="text-[12px] text-grey pb-3">
                      Serials <span className="font-semibold text-surface-dark">{formatSerial(serialStart)}</span> to{" "}
                      <span className="font-semibold text-surface-dark">{formatSerial(serialEnd)}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-grey">
                    Next serial is <span className="font-semibold">{formatSerial(nextSerial)}</span> — we pick up where you left off.
                    Max 200 per batch.
                  </p>
                </div>
              </section>

              {/* Step 2 — Design */}
              <section className="bg-white border border-grey-mid rounded-card shadow-card">
                <header className="px-5 py-4 border-b border-grey-mid">
                  <h2 className="text-[14px] font-semibold text-surface-dark flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-brand-blue text-white text-[11px] font-bold flex items-center justify-center">2</span>
                    Pick a design
                  </h2>
                </header>
                <div className="p-5">
                  {/* Code type toggle */}
                  <div className="mb-4 inline-flex bg-grey-light rounded-md p-1">
                    <button
                      type="button"
                      onClick={() => setCodeType("qr")}
                      className={`h-8 px-3 rounded text-[12px] font-semibold flex items-center gap-1.5 transition-colors ${codeType === "qr" ? "bg-white shadow-sm text-surface-dark" : "text-grey hover:text-surface-dark"}`}
                    >
                      <QrCode className="h-3.5 w-3.5" /> QR Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setCodeType("barcode")}
                      className={`h-8 px-3 rounded text-[12px] font-semibold flex items-center gap-1.5 transition-colors ${codeType === "barcode" ? "bg-white shadow-sm text-surface-dark" : "text-grey hover:text-surface-dark"}`}
                    >
                      <BarcodeIcon className="h-3.5 w-3.5" /> Barcode
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {LABEL_DESIGNS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDesign(d.id)}
                        className={`text-left rounded-[10px] border p-3 transition-all ${design === d.id
                          ? "border-brand-blue bg-brand-blue/[0.04] ring-2 ring-brand-blue/30"
                          : "border-grey-mid hover:border-brand-blue/40"}`}
                      >
                        <div className="flex items-center justify-center bg-grey-light rounded mb-2 py-2 min-h-[80px]">
                          <LabelPreview
                            widthMm={50}
                            heightMm={30}
                            design={d.id}
                            codeType={codeType}
                            serial={formatSerial(nextSerial)}
                            orgName={state.workspaceName}
                            equipmentName="Arri SkyPanel"
                            scale={1.2}
                          />
                        </div>
                        <div className="text-[12px] font-semibold text-surface-dark">{d.label}</div>
                        <div className="text-[11px] text-grey mt-0.5">{d.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Step 3 — Printer */}
              <section className="bg-white border border-grey-mid rounded-card shadow-card">
                <header className="px-5 py-4 border-b border-grey-mid">
                  <h2 className="text-[14px] font-semibold text-surface-dark flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-brand-blue text-white text-[11px] font-bold flex items-center justify-center">3</span>
                    Pick your printer
                  </h2>
                </header>
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-grey block mb-1">Printer</label>
                      <select
                        value={printer}
                        onChange={(e) => setPrinter(e.target.value as PrinterType)}
                        className="w-full h-10 px-3 rounded-md border border-grey-mid text-[13px] focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none bg-white"
                      >
                        {Object.entries(groupByBrand(PRINTERS)).map(([brand, items]) => (
                          <optgroup key={brand} label={brand}>
                            {items.map((p) => (
                              <option key={p.id} value={p.id}>{p.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-grey block mb-1">Label size</label>
                      <select
                        value={sizeId}
                        onChange={(e) => setSizeId(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border border-grey-mid text-[13px] focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none bg-white"
                      >
                        {currentPrinter?.sizes.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-grey">
                    Output: {currentPrinter?.outputFormat === "pdf" && "PDF (opens your print dialog)"}
                    {currentPrinter?.outputFormat === "zpl" && "ZPL file (send to your Zebra printer)"}
                    {currentPrinter?.outputFormat === "dymo_xml" && "DYMO Connect (opens in the DYMO desktop app)"}
                    {" — "}remembered for next time.
                  </p>
                </div>
              </section>

              {/* Step 4 — Output format + Generate */}
              <section className="bg-white border border-grey-mid rounded-card shadow-card">
                <header className="px-5 py-4 border-b border-grey-mid">
                  <h2 className="text-[14px] font-semibold text-surface-dark flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-brand-blue text-white text-[11px] font-bold flex items-center justify-center">4</span>
                    Generate
                  </h2>
                </header>
                <div className="p-5 space-y-4">
                  {/* Output format toggle */}
                  <div className="space-y-2">
                    {hasNativeFormat && (
                      <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${outputFormat === "native" ? "border-brand-blue bg-brand-blue/[0.04]" : "border-grey-mid hover:border-brand-blue/40"}`}>
                        <input
                          type="radio"
                          name="outputFormat"
                          value="native"
                          checked={outputFormat === "native"}
                          onChange={() => setOutputFormat("native")}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-surface-dark">Native file (recommended)</span>
                            <span className="text-[10px] font-bold text-white bg-brand-blue px-1.5 py-0.5 rounded">BEST</span>
                          </div>
                          <div className="text-[11px] text-grey mt-0.5">{nativeDescription}</div>
                        </div>
                      </label>
                    )}
                    <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${outputFormat === "pdf" ? "border-brand-blue bg-brand-blue/[0.04]" : "border-grey-mid hover:border-brand-blue/40"}`}>
                      <input
                        type="radio"
                        name="outputFormat"
                        value="pdf"
                        checked={outputFormat === "pdf"}
                        onChange={() => setOutputFormat("pdf")}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold text-surface-dark">PDF</div>
                        <div className="text-[11px] text-grey mt-0.5">Opens in your browser. Hit Cmd/Ctrl+P, pick your label printer, print.</div>
                      </div>
                    </label>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    disabled={!canPrint}
                    onClick={handleGenerate}
                    className="w-full"
                  >
                    {outputFormat === "pdf" ? <FileText className="h-4 w-4 mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                    {printing ? "Generating…" : `Generate ${quantity} label${quantity !== 1 ? "s" : ""}`}
                  </Button>
                  <p className="text-[11px] text-grey">
                    Hitting generate locks in serials {formatSerial(serialStart)}–{formatSerial(serialEnd)} — they cannot be reused.
                  </p>
                </div>
              </section>

              {/* How it works */}
              <section className="bg-blue-50/50 border border-brand-blue/20 rounded-card">
                <div className="p-5">
                  <h3 className="text-[13px] font-semibold text-surface-dark flex items-center gap-2 mb-3">
                    <Info className="h-4 w-4 text-brand-blue" />
                    How this works
                  </h3>

                  {currentPrinter?.outputFormat === "dymo_xml" && outputFormat === "native" ? (
                    <>
                      <ol className="text-[12px] text-surface-dark/80 space-y-1.5 list-decimal list-inside">
                        <li>Click Generate — you&apos;ll get a ZIP with a label template + serials.csv.</li>
                        <li>Unzip it anywhere on your computer.</li>
                        <li>Double-click <code className="bg-white px-1 rounded text-[11px] border border-grey-mid">labels.label</code> — DYMO Connect opens the template.</li>
                        <li>In DYMO Connect, click <span className="font-semibold">File → Import Data and Print</span>.</li>
                        <li>Pick <code className="bg-white px-1 rounded text-[11px] border border-grey-mid">serials.csv</code> from the same folder.</li>
                        <li>Map the &quot;Serial&quot; column to the QR and Serial fields, &quot;OrgName&quot; to OrgName.</li>
                        <li>Hit Print — DYMO Connect prints every serial as its own label.</li>
                        <li>Stick them on your kit, then scan each one via Add Equipment.</li>
                      </ol>
                      <p className="text-[11px] text-grey mt-3 pt-3 border-t border-brand-blue/10">
                        Needs <a href="https://www.dymo.com/support?cfid=user-guide" target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">DYMO Connect</a> installed (free from DYMO). The README inside the ZIP has the same instructions.
                      </p>
                    </>
                  ) : (printer === "brother_ql" || printer === "brother_pt") && outputFormat === "native" ? (
                    <>
                      <ol className="text-[12px] text-surface-dark/80 space-y-1.5 list-decimal list-inside">
                        <li>Click Generate — you&apos;ll get a ZIP with a label template + serials.csv.</li>
                        <li>Unzip it anywhere on your computer.</li>
                        <li>Double-click <code className="bg-white px-1 rounded text-[11px] border border-grey-mid">labels.lbx</code> — P-touch Editor opens the template.</li>
                        <li>In P-touch Editor, import <code className="bg-white px-1 rounded text-[11px] border border-grey-mid">serials.csv</code> as the data source.</li>
                        <li>Hit Print — every serial prints as its own label.</li>
                        <li>Stick them on your kit, then scan each one via Add Equipment.</li>
                      </ol>
                      <p className="text-[11px] text-grey mt-3 pt-3 border-t border-brand-blue/10">
                        Needs <a href="https://www.brother.co.uk/support/downloads" target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">P-touch Editor 5+</a> installed (free from Brother).
                      </p>
                    </>
                  ) : currentPrinter?.outputFormat === "zpl" && outputFormat === "native" ? (
                    <ol className="text-[12px] text-surface-dark/80 space-y-1.5 list-decimal list-inside">
                      <li>Click Generate — you&apos;ll get a single <code className="bg-white px-1 rounded text-[11px] border border-grey-mid">.zpl</code> file.</li>
                      <li>Send it to your Zebra printer (drag-drop in your spooler, or pipe over TCP to port 9100).</li>
                      <li>Labels come out. Stick them on kit, scan via Add Equipment.</li>
                    </ol>
                  ) : (
                    <ol className="text-[12px] text-surface-dark/80 space-y-1.5 list-decimal list-inside">
                      <li>Click Generate — a PDF opens in a new tab.</li>
                      <li>Press Cmd/Ctrl+P to open your print dialog.</li>
                      <li>Pick your label printer from the list.</li>
                      <li>Paper size should be {currentSize?.widthMm} × {currentSize?.heightMm}mm — most drivers pick this automatically.</li>
                      <li>Hit Print. Stick labels on kit, scan via Add Equipment.</li>
                    </ol>
                  )}
                </div>
              </section>

            </div>

            {/* ── RIGHT: live preview ── */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-6 bg-white border border-grey-mid rounded-card shadow-card">
                <header className="px-5 py-4 border-b border-grey-mid flex items-center gap-2">
                  <Tag className="h-4 w-4 text-grey" />
                  <h2 className="text-[14px] font-semibold text-surface-dark">Live preview</h2>
                  {currentSize && (
                    <span className="ml-auto text-[11px] text-grey">
                      {currentSize.widthMm} × {currentSize.heightMm}mm
                    </span>
                  )}
                </header>
                <div className="p-5 flex flex-col items-center">
                  <div className="bg-grey-light rounded-[10px] p-6 flex items-center justify-center min-h-[220px] w-full">
                    {currentSize && (
                      <LabelPreview
                        widthMm={currentSize.widthMm}
                        heightMm={currentSize.heightMm}
                        design={design}
                        codeType={codeType}
                        serial={previewSerial}
                        orgName={state.workspaceName}
                        equipmentName="Arri SkyPanel"
                        scale={previewScaleFor(currentSize.widthMm, currentSize.heightMm)}
                      />
                    )}
                  </div>

                  {/* Preview navigator */}
                  {quantity > 1 && (
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                        disabled={previewIndex === 0}
                        className="h-8 w-8 rounded-md border border-grey-mid flex items-center justify-center hover:bg-grey-light disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <div className="text-[12px] text-grey font-medium tabular-nums min-w-[60px] text-center">
                        {previewIndex + 1} of {quantity}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewIndex(Math.min(quantity - 1, previewIndex + 1))}
                        disabled={previewIndex >= quantity - 1}
                        className="h-8 w-8 rounded-md border border-grey-mid flex items-center justify-center hover:bg-grey-light disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function groupByBrand(printers: typeof PRINTERS) {
  const out: Record<string, typeof printers> = {};
  for (const p of printers) {
    if (!out[p.brand]) out[p.brand] = [];
    out[p.brand].push(p);
  }
  return out;
}

/** Pick a CSS-px-per-mm scale so the preview fits comfortably in the panel. */
function previewScaleFor(widthMm: number, heightMm: number): number {
  const maxWidth = 300;
  const maxHeight = 200;
  return Math.min(maxWidth / widthMm, maxHeight / heightMm);
}
