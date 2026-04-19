/**
 * Client-side label print pipeline.
 *
 * Phase 1 strategy:
 *   - PDF-capable printers: open a new tab with a tiled SVG grid sized exactly to
 *     the label dimensions, and trigger window.print(). The OS print dialog
 *     lets the user pick paper/printer.
 *   - Zebra (ZPL): download a .zpl file.
 *   - DYMO: fall back to PDF print for now (direct SDK integration is Phase 2).
 *
 * The SVG content is built from the same LabelSvgContent used in the live
 * preview, so what-you-see is what-you-print.
 */

import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { formatSerial, type LabelDesign, type CodeType, type Printer, type LabelSize } from "./catalog";

export interface PrintBatchArgs {
  serialStart: number;
  serialEnd: number;
  design: LabelDesign;
  codeType: CodeType;
  orgName: string;
  size: LabelSize;
  printer: Printer;
  /** If true, download a file. If false, open print dialog. */
  asFile: boolean;
}

export async function printLabelBatch(args: PrintBatchArgs) {
  if (args.printer.outputFormat === "zpl") {
    const zpl = await buildZplBatch(args);
    downloadText(zpl, `logitrak-labels-${formatSerial(args.serialStart)}-${formatSerial(args.serialEnd)}.zpl`);
    return;
  }

  // PDF / DYMO fallback → tiled HTML print
  const html = await buildPrintableHtml(args);

  if (args.asFile) {
    // Download as .html (user can open → print to PDF themselves)
    downloadText(html, `logitrak-labels-${formatSerial(args.serialStart)}-${formatSerial(args.serialEnd)}.html`);
    return;
  }

  const win = window.open("", "_blank");
  if (!win) {
    alert("Your browser blocked the print window. Allow pop-ups for this site and try again.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Wait for images to load before calling print
  win.onload = () => {
    setTimeout(() => {
      win.focus();
      win.print();
    }, 500);
  };
}

// ── Build printable HTML (tiled SVG labels) ─────────────────────────────

async function buildPrintableHtml(args: PrintBatchArgs): Promise<string> {
  const { serialStart, serialEnd, design, codeType, orgName, size } = args;

  // Generate code data URL for every serial in one go
  const serials: string[] = [];
  for (let n = serialStart; n <= serialEnd; n++) serials.push(formatSerial(n));

  const codes: Record<string, string> = {};
  for (const s of serials) {
    codes[s] = await generateCodeDataUrl(s, codeType);
  }

  const labels = serials
    .map((s) => {
      const svg = renderLabelSvg({
        widthMm: size.widthMm,
        heightMm: size.heightMm,
        design,
        codeType,
        serial: s,
        orgName,
        codeDataUrl: codes[s],
      });
      return `<div class="label">${svg}</div>`;
    })
    .join("\n");

  // Page size = label size for die-cut, A4 tiled for generic
  const pageSize = size.dieCut
    ? `${size.widthMm}mm ${size.heightMm}mm`
    : "A4";
  const pageCss = size.dieCut
    ? `@page { size: ${pageSize}; margin: 0; } body { margin: 0; padding: 0; }`
    : `@page { size: A4; margin: 10mm; }`;

  const gridCss = size.dieCut
    ? `.label { page-break-after: always; width: ${size.widthMm}mm; height: ${size.heightMm}mm; }`
    : `.grid { display: flex; flex-wrap: wrap; gap: 4mm; } .label { width: ${size.widthMm}mm; height: ${size.heightMm}mm; break-inside: avoid; }`;

  return `<!DOCTYPE html>
<html>
<head>
<title>LogiTrak Labels ${formatSerial(serialStart)}–${formatSerial(serialEnd)}</title>
<style>
  ${pageCss}
  body { font-family: system-ui, sans-serif; background: #fff; }
  ${gridCss}
  .label svg { display: block; width: 100%; height: 100%; }
  .toolbar { position: fixed; top: 10px; right: 10px; background: #fff; padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 9999; }
  .toolbar button { padding: 6px 14px; font-size: 13px; cursor: pointer; }
  @media print { .toolbar { display: none; } }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">🖨 Print</button>
  </div>
  <div class="${size.dieCut ? "" : "grid"}">
    ${labels}
  </div>
</body>
</html>`;
}

async function generateCodeDataUrl(serial: string, codeType: CodeType): Promise<string> {
  if (codeType === "qr") {
    return QRCode.toDataURL(serial, {
      margin: 0,
      width: 400,
      errorCorrectionLevel: "M",
      color: { dark: "#0F172A", light: "#FFFFFF" },
    });
  }
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, serial, {
    format: "CODE128",
    displayValue: false,
    margin: 0,
    height: 60,
    width: 2,
    background: "#ffffff",
    lineColor: "#0F172A",
  });
  return canvas.toDataURL("image/png");
}

// ── SVG string builder (mirrors LabelPreview designs) ──────────────────

interface SvgArgs {
  widthMm: number;
  heightMm: number;
  design: LabelDesign;
  codeType: CodeType;
  serial: string;
  orgName: string;
  codeDataUrl: string;
}

function renderLabelSvg(args: SvgArgs): string {
  const { widthMm, heightMm, design, codeType, serial, orgName, codeDataUrl } = args;
  const pad = 1.5;
  const innerW = widthMm - pad * 2;
  const innerH = heightMm - pad * 2;

  const orgUpper = escapeXml(orgName.toUpperCase());
  const serialEsc = escapeXml(serial);

  let inner = "";

  if (design === "standard") {
    const codeSize = Math.min(innerH * 0.55, innerW * 0.45);
    const codeX = pad + (innerW - codeSize) / 2;
    const codeY = pad + innerH * 0.05;
    const serialY = codeY + codeSize + innerH * 0.13;
    const orgY = pad + innerH * 0.92;
    const serialFont = Math.min(innerH * 0.18, innerW * 0.18);
    const orgFont = Math.min(innerH * 0.1, innerW * 0.1);
    inner += codeType === "qr"
      ? `<image href="${codeDataUrl}" x="${codeX}" y="${codeY}" width="${codeSize}" height="${codeSize}"/>`
      : `<image href="${codeDataUrl}" x="${pad + innerW * 0.1}" y="${codeY}" width="${innerW * 0.8}" height="${codeSize}" preserveAspectRatio="none"/>`;
    inner += `<text x="${pad + innerW / 2}" y="${serialY}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="${serialFont}" font-weight="700" fill="#0F172A">${serialEsc}</text>`;
    inner += `<text x="${pad + innerW / 2}" y="${orgY}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${orgFont}" fill="#475569">${orgUpper}</text>`;
  } else if (design === "compact") {
    const codeSize = innerH * 0.9;
    const textX = pad + codeSize + 2;
    const textW = innerW - codeSize - 2;
    const serialFont = Math.min(innerH * 0.35, textW * 0.25);
    const orgFont = Math.min(innerH * 0.16, textW * 0.12);
    const codeY = pad + (innerH - codeSize) / 2;
    inner += `<image href="${codeDataUrl}" x="${pad}" y="${codeY}" width="${codeSize}" height="${codeSize}"${codeType === "barcode" ? ' preserveAspectRatio="none"' : ""}/>`;
    inner += `<text x="${textX}" y="${pad + innerH * 0.48}" font-family="ui-monospace, Menlo, monospace" font-size="${serialFont}" font-weight="700" fill="#0F172A">${serialEsc}</text>`;
    inner += `<text x="${textX}" y="${pad + innerH * 0.78}" font-family="system-ui, sans-serif" font-size="${orgFont}" fill="#475569">${orgUpper}</text>`;
  } else if (design === "barcode_focus") {
    const barH = innerH * 0.55;
    const barY = pad + innerH * 0.05;
    const serialFont = Math.min(innerH * 0.18, innerW * 0.16);
    const orgFont = Math.min(innerH * 0.1, innerW * 0.1);
    inner += `<image href="${codeDataUrl}" x="${pad}" y="${barY}" width="${innerW}" height="${barH}" preserveAspectRatio="none"/>`;
    inner += `<text x="${pad + innerW / 2}" y="${barY + barH + innerH * 0.18}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="${serialFont}" font-weight="700" fill="#0F172A">${serialEsc}</text>`;
    inner += `<text x="${pad + innerW / 2}" y="${pad + innerH * 0.95}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${orgFont}" fill="#475569">${orgUpper}</text>`;
  } else if (design === "full_detail") {
    const codeSize = Math.min(innerH * 0.5, innerW * 0.4);
    const codeX = pad + (innerW - codeSize) / 2;
    const codeY = pad + innerH * 0.04;
    const textStartY = codeY + codeSize + innerH * 0.1;
    const lineHeight = innerH * 0.12;
    const serialFont = Math.min(innerH * 0.11, innerW * 0.11);
    const nameFont = Math.min(innerH * 0.1, innerW * 0.1);
    const orgFont = Math.min(innerH * 0.08, innerW * 0.08);
    inner += codeType === "qr"
      ? `<image href="${codeDataUrl}" x="${codeX}" y="${codeY}" width="${codeSize}" height="${codeSize}"/>`
      : `<image href="${codeDataUrl}" x="${pad + innerW * 0.1}" y="${codeY}" width="${innerW * 0.8}" height="${codeSize}" preserveAspectRatio="none"/>`;
    inner += `<text x="${pad + innerW / 2}" y="${textStartY}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="${serialFont}" font-weight="700" fill="#0F172A">SN: ${serialEsc}</text>`;
    inner += `<text x="${pad + innerW / 2}" y="${textStartY + lineHeight}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${nameFont}" font-weight="600" fill="#334155">Unassigned</text>`;
    inner += `<text x="${pad + innerW / 2}" y="${textStartY + lineHeight * 2}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${orgFont}" fill="#64748B">${orgUpper}</text>`;
  } else if (design === "high_visibility") {
    const serialFont = Math.min(innerH * 0.45, innerW * 0.18);
    const codeSize = innerH * 0.3;
    const spaced = escapeXml(serial.split("").join(" "));
    inner += `<text x="${pad + innerW / 2}" y="${pad + innerH * 0.55}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${serialFont}" font-weight="900" fill="#0F172A">${spaced}</text>`;
    inner += `<image href="${codeDataUrl}" x="${pad}" y="${pad + innerH - codeSize}" width="${codeSize}" height="${codeSize}"/>`;
    inner += `<text x="${pad + innerW}" y="${pad + innerH - innerH * 0.1}" text-anchor="end" font-family="system-ui, sans-serif" font-size="${Math.min(innerH * 0.12, innerW * 0.1)}" font-weight="700" fill="#475569">${orgUpper}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthMm} ${heightMm}" style="background:#fff;">${inner}</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ── Zebra ZPL ──────────────────────────────────────────────────────────

async function buildZplBatch(args: PrintBatchArgs): Promise<string> {
  const { serialStart, serialEnd, size, codeType, orgName } = args;
  const dpi = 203; // standard Zebra desktop
  const dotsPerMm = dpi / 25.4;
  const widthDots = Math.round(size.widthMm * dotsPerMm);
  const heightDots = Math.round(size.heightMm * dotsPerMm);

  const parts: string[] = [];
  for (let n = serialStart; n <= serialEnd; n++) {
    const serial = formatSerial(n);
    if (codeType === "qr") {
      parts.push(`^XA
^PW${widthDots}
^LL${heightDots}
^FO${Math.round(widthDots * 0.1)},${Math.round(heightDots * 0.1)}^BQN,2,6^FDQA,${serial}^FS
^FO0,${Math.round(heightDots * 0.72)}^FB${widthDots},1,0,C^A0N,40,30^FD${serial}^FS
^FO0,${Math.round(heightDots * 0.88)}^FB${widthDots},1,0,C^A0N,24,20^FD${escapeZpl(orgName.toUpperCase())}^FS
^PQ1
^XZ`);
    } else {
      parts.push(`^XA
^PW${widthDots}
^LL${heightDots}
^FO${Math.round(widthDots * 0.05)},${Math.round(heightDots * 0.1)}^BCN,${Math.round(heightDots * 0.5)},Y,N,N^FD${serial}^FS
^FO0,${Math.round(heightDots * 0.78)}^FB${widthDots},1,0,C^A0N,40,30^FD${serial}^FS
^FO0,${Math.round(heightDots * 0.9)}^FB${widthDots},1,0,C^A0N,24,20^FD${escapeZpl(orgName.toUpperCase())}^FS
^PQ1
^XZ`);
    }
  }
  return parts.join("\n");
}

function escapeZpl(s: string): string {
  // ZPL uses ^ and ~ as control chars — strip them from free text
  return s.replace(/\^/g, "").replace(/~/g, "");
}

// ── Utility: download a text blob ──────────────────────────────────────

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: filename.endsWith(".html") ? "text/html" : "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
