/**
 * Client-side label print trigger.
 *
 * After the server reserves the batch, we POST to /api/labels/generate with
 * the outputFormat choice. The API returns the binary file (PDF / ZPL / ZIP)
 * and we trigger a download (or open-in-browser for PDF auto-print).
 */

export type OutputFormat = "native" | "pdf";

export interface TriggerGenerateArgs {
  batchId: string;
  outputFormat: OutputFormat;
  /** If true AND format is pdf, open in a new tab and trigger print automatically. */
  printInline?: boolean;
}

export async function triggerLabelGeneration(args: TriggerGenerateArgs) {
  const res = await fetch("/api/labels/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batchId: args.batchId, outputFormat: args.outputFormat }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Generation failed (${res.status}): ${text || res.statusText}`);
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const filename = extractFilename(disposition) ?? `logitrak-labels-${args.batchId}`;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  if (args.outputFormat === "pdf" && args.printInline && blob.type === "application/pdf") {
    // Open in a new tab — user hits Cmd+P. Browsers block automatic print() on
    // cross-origin PDFs, but opening in a new tab is the reliable path.
    window.open(url, "_blank");
    // Keep URL alive — the new tab still needs it
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  // Regular download
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function extractFilename(disposition: string): string | null {
  const match = disposition.match(/filename="([^"]+)"/i);
  return match ? match[1] : null;
}
