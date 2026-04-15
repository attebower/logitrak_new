/**
 * LogiTrak CsvImportModal Component
 * File upload dropzone → preview → confirm → results.
 *
 * Flow:
 *   1. Dropzone (accept .csv only) or click to browse
 *   2. Preview table showing first 5 rows of parsed CSV
 *   3. Confirm button triggers import (async)
 *   4. Results: "X imported, Y errors" + error list
 *
 * The component handles CSV parsing client-side (preview only).
 * Actual import is done by the parent via `onImport` — receives the raw File.
 *
 * Usage:
 *   <CsvImportModal
 *     isOpen={showImport}
 *     onClose={() => setShowImport(false)}
 *     templateUrl="/templates/equipment-import.csv"
 *     onImport={async (file) => {
 *       const result = await trpc.equipment.importCsv.mutate({ file });
 *       return result; // { imported: number; errors: ImportError[] }
 *     }}
 *   />
 */

"use client";

import { useState, useRef, useCallback, useId } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

export interface ImportError {
  row:     number;
  field?:  string;
  message: string;
}

export interface ImportResult {
  imported: number;
  errors:   ImportError[];
}

// ── CSV preview parser ────────────────────────────────────────────────────

function parseCsvPreview(text: string, maxRows = 5): { headers: string[]; rows: string[][] } {
  const lines   = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0] ?? "");
  const rows    = lines.slice(1, maxRows + 1).map(parseCsvLine);
  return { headers, rows };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────

type Step = "upload" | "preview" | "importing" | "results";

export interface CsvImportModalProps {
  isOpen:        boolean;
  onClose:       () => void;
  /** URL to download the CSV template */
  templateUrl?:  string;
  /** Receives the File and returns ImportResult */
  onImport:      (file: File) => Promise<ImportResult>;
  /** Modal title (default: "Import Equipment") */
  title?:        string;
}

export function CsvImportModal({
  isOpen,
  onClose,
  templateUrl,
  onImport,
  title = "Import Equipment",
}: CsvImportModalProps) {
  const [step,    setStep]    = useState<Step>("upload");
  const [file,    setFile]    = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [result,  setResult]  = useState<ImportResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const inputRef  = useRef<HTMLInputElement>(null);
  const dropzoneId = useId();

  function reset() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(f: File) {
    if (!f.name.endsWith(".csv")) {
      setError("Only .csv files are accepted.");
      return;
    }
    setError(null);
    const text = await f.text();
    const parsed = parseCsvPreview(text);
    if (parsed.headers.length === 0) {
      setError("The file appears to be empty or unreadable.");
      return;
    }
    setFile(f);
    setPreview(parsed);
    setStep("preview");
  }

  // Drag and drop handlers
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) await handleFile(f);
  }, []); // eslint-disable-line

  async function handleConfirm() {
    if (!file) return;
    setStep("importing");
    setError(null);
    try {
      const res = await onImport(file);
      setResult(res);
      setStep("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed. Please try again.");
      setStep("preview");
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={handleClose} aria-hidden />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-white rounded-panel shadow-device flex flex-col max-h-[90vh]"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-grey-mid flex-shrink-0">
          <div>
            <h2 className="text-[16px] font-bold text-surface-dark">{title}</h2>
            <p className="text-[12px] text-grey mt-0.5">
              {step === "upload"    && "Upload a .csv file to import equipment in bulk."}
              {step === "preview"   && `Previewing ${file?.name} — check the data looks right before confirming.`}
              {step === "importing" && "Importing…"}
              {step === "results"   && (result ? `Done — ${result.imported} items imported.` : "")}
            </p>
          </div>
          <button onClick={handleClose} className="text-grey hover:text-surface-dark text-xl leading-none" aria-label="Close">×</button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Upload step */}
          {step === "upload" && (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                id={dropzoneId}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-card cursor-pointer",
                  "flex flex-col items-center justify-center py-12 gap-3 transition-colors",
                  dragging
                    ? "border-brand-blue bg-brand-blue-light"
                    : "border-grey-mid hover:border-brand-blue hover:bg-grey-light"
                )}
                role="button"
                tabIndex={0}
                aria-label="Upload CSV file — click or drag and drop"
                onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
              >
                <span className="text-4xl opacity-40" aria-hidden>📂</span>
                <div className="text-center">
                  <p className="text-[14px] font-semibold text-surface-dark">
                    Drop your CSV here, or <span className="text-brand-blue">browse</span>
                  </p>
                  <p className="text-[12px] text-grey mt-1">Only .csv files accepted</p>
                </div>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="sr-only"
                aria-hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) await handleFile(f);
                  e.target.value = "";
                }}
              />

              {error && (
                <p className="text-[13px] text-status-red">{error}</p>
              )}

              {/* Template download */}
              {templateUrl && (
                <p className="text-[12px] text-grey text-center">
                  Not sure of the format?{" "}
                  <a
                    href={templateUrl}
                    download
                    className="text-brand-blue hover:underline font-medium"
                  >
                    Download template CSV
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Preview step */}
          {step === "preview" && preview && (
            <div className="space-y-4">
              <p className="text-[12px] text-grey">
                Showing first {preview.rows.length} rows of your file.
                {" "}{preview.headers.length} columns detected.
              </p>

              <div className="overflow-x-auto rounded-card border border-grey-mid">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      {preview.headers.map((h, i) => (
                        <th
                          key={i}
                          className="bg-grey-light px-3 py-2 text-left text-caption text-grey uppercase border-b border-grey-mid font-bold whitespace-nowrap"
                        >
                          {h || `Column ${i + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-grey-mid last:border-b-0">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 text-surface-dark whitespace-nowrap max-w-[200px] truncate">
                            {cell || <span className="text-grey italic">empty</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && (
                <p className="text-[13px] text-status-red">{error}</p>
              )}
            </div>
          )}

          {/* Importing step */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-10 h-10 border-4 border-grey-mid border-t-brand-blue rounded-full animate-spin" aria-hidden />
              <p className="text-[13px] text-grey">Importing {file?.name}…</p>
            </div>
          )}

          {/* Results step */}
          {step === "results" && result && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex gap-4">
                <div className="flex-1 bg-status-green-light rounded-card border border-status-green/20 px-4 py-3">
                  <p className="text-[28px] font-extrabold text-status-green tracking-tight">{result.imported}</p>
                  <p className="text-[12px] text-status-green font-medium">items imported</p>
                </div>
                {result.errors.length > 0 && (
                  <div className="flex-1 bg-status-red-light rounded-card border border-status-red/20 px-4 py-3">
                    <p className="text-[28px] font-extrabold text-status-red tracking-tight">{result.errors.length}</p>
                    <p className="text-[12px] text-status-red font-medium">{result.errors.length === 1 ? "error" : "errors"}</p>
                  </div>
                )}
              </div>

              {/* Error list */}
              {result.errors.length > 0 && (
                <div>
                  <p className="text-caption text-grey uppercase mb-2">Rows with errors</p>
                  <div className="rounded-card border border-grey-mid overflow-hidden max-h-52 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 px-4 py-2.5 border-b border-grey-mid last:border-b-0 bg-white"
                      >
                        <span className="text-[11px] font-bold text-grey-mid bg-grey-mid/50 rounded px-1.5 py-0.5 flex-shrink-0">
                          Row {err.row}
                        </span>
                        <div className="min-w-0">
                          {err.field && (
                            <span className="text-[11px] font-semibold text-status-amber mr-1.5">{err.field}:</span>
                          )}
                          <span className="text-[12px] text-surface-dark">{err.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-grey mt-2">
                    Rows with errors were skipped. Fix them in your CSV and re-import.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-grey-mid flex-shrink-0">
          {step === "upload" && (
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          )}

          {step === "preview" && (
            <>
              <Button variant="secondary" onClick={reset}>← Change file</Button>
              <Button variant="primary" onClick={handleConfirm}>
                Confirm import
              </Button>
            </>
          )}

          {step === "importing" && (
            <Button variant="secondary" disabled>Importing…</Button>
          )}

          {step === "results" && (
            <>
              {result && result.errors.length > 0 && (
                <Button variant="secondary" onClick={reset}>Import another file</Button>
              )}
              <div className="ml-auto">
                <Button variant="primary" onClick={handleClose}>Done</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
