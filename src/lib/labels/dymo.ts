/**
 * DYMO .label file generator for DYMO Connect.
 *
 * CONFIRMED WORKING SCHEMA (tested April 2026 against DYMO Connect for Desktop).
 * See docs/dymo-label-schema.md for the full reference.
 *
 * Four rules that MUST be exact:
 *   1. Extension is `.label` (not .dymo, not .xml).
 *   2. Root element is `<DieCutLabel Version="8.0" Units="twips">` with no wrapper.
 *   3. Object name tag is `<Name>` with a capital N (NOT `<n>`).
 *   4. RoundRectangle uses portrait dimension order EVEN in landscape orientation:
 *      Width = short edge, Height = long edge.
 *
 * Strategy: emit ONE template .label file with the serial placeholder "00000".
 * Bundle it with serials.csv in a ZIP. User opens the file in DYMO Connect,
 * hits "Import Data" or uses Print Multiple Labels against the CSV.
 */

import { formatSerial, type LabelSize, type CodeType } from "./catalog";

const MM_TO_TWIPS = 56.69;

/**
 * Confirmed-working DYMO label SKUs. Width/Height values below are in
 * **portrait order** (short × long) — that's what DYMO Connect expects in
 * <RoundRectangle> even when orientation is Landscape.
 */
interface DymoSku {
  paperName: string;
  id: string;
  shortTwips: number;  // Goes in RoundRectangle Width
  longTwips: number;   // Goes in RoundRectangle Height
  orientation: "Landscape" | "Portrait";
}

const DYMO_SKUS: Record<string, DymoSku> = {
  // 30252 Address — 89 × 28mm
  "30252": { paperName: "30252 Address",       id: "Address",       shortTwips: 1581, longTwips: 5040, orientation: "Landscape" },
  // 30334 Multi-Purpose — 57 × 32mm (our catalog); spec lists 60×20mm for this SKU
  "30334": { paperName: "30334 Multi-Purpose", id: "MultiPurpose",  shortTwips: 1814, longTwips: 3231, orientation: "Landscape" },
  // 30256 Shipping — 101 × 59mm
  "30256": { paperName: "30256 Shipping",      id: "LargeShipping", shortTwips: 3331, longTwips: 5715, orientation: "Landscape" },
  // 30321 Large Address — 89 × 36mm
  "30321": { paperName: "30321 Large Address", id: "LargeAddress",  shortTwips: 2025, longTwips: 5020, orientation: "Landscape" },
  // 11355 Multi-Purpose — 51 × 19mm
  "11355": { paperName: "11355 Multi-Purpose", id: "MultiPurpose2", shortTwips: 2268, longTwips: 3402, orientation: "Landscape" },
};

function skuFor(size: LabelSize): DymoSku {
  return DYMO_SKUS[size.id] ?? DYMO_SKUS["30252"];
}

export interface DymoArgs {
  serialStart: number;
  serialEnd: number;
  codeType: CodeType;
  orgName: string;
  size: LabelSize;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate a SINGLE .label template file with placeholder serial "00000".
 * User imports serials.csv in DYMO Connect to merge-print the batch.
 *
 * Layout: QR/barcode on the left, serial stacked above org name on the right.
 * This is the confirmed-working layout from the schema reference.
 */
export function buildDymoLabel(args: DymoArgs): string {
  const { size, codeType, orgName } = args;
  const sku = skuFor(size);

  // Placeholder — user's CSV data will replace this at print time
  const placeholderSerial = "00000";

  const barcodeType = codeType === "qr" ? "QRCode" : "Code128Auto";
  const barcodeData = placeholderSerial;

  // Object layout matches the confirmed working example from the schema reference.
  // Coordinates are in twips, relative to the printable area.
  // For 30252 (1581 × 5040 twips), this is the "portrait" layout from the spec.
  const isAddress = size.id === "30252";

  let objects: string;
  if (isAddress) {
    // Exact layout from the confirmed-working reference file for 30252
    objects = [
      barcodeBlock({
        name: codeType === "qr" ? "QRCode" : "Barcode",
        type: barcodeType,
        data: barcodeData,
        x: 331, y: 150, width: 900, height: 900,
        textPosition: codeType === "qr" ? "None" : "Bottom",
      }),
      textBlock({
        name: "Serial",
        text: placeholderSerial,
        x: 150, y: 1080, width: 1260, height: 280,
        font: "Courier New", size: 18, bold: true,
        color: { r: 0, g: 0, b: 0 },
      }),
      textBlock({
        name: "OrgName",
        text: orgName.toUpperCase(),
        x: 150, y: 1370, width: 1260, height: 180,
        font: "Arial", size: 9,
        color: { r: 120, g: 120, b: 120 },
      }),
    ].join("\n");
  } else {
    // Scale layout proportionally to other label sizes
    const w = sku.shortTwips;
    const h = sku.longTwips;
    const codeSize = Math.round(Math.min(w * 0.6, h * 0.18));
    const codeX = Math.round((w - codeSize) / 2);
    const codeY = Math.round(h * 0.03);
    const serialY = codeY + codeSize + Math.round(h * 0.03);
    const serialH = Math.round(h * 0.05);
    const orgY = Math.round(h * 0.87);
    const orgH = Math.round(h * 0.05);
    const textMargin = Math.round(w * 0.05);
    objects = [
      barcodeBlock({
        name: codeType === "qr" ? "QRCode" : "Barcode",
        type: barcodeType,
        data: barcodeData,
        x: codeX, y: codeY, width: codeSize, height: codeSize,
        textPosition: codeType === "qr" ? "None" : "Bottom",
      }),
      textBlock({
        name: "Serial",
        text: placeholderSerial,
        x: textMargin, y: serialY, width: w - textMargin * 2, height: serialH,
        font: "Courier New", size: 18, bold: true,
        color: { r: 0, g: 0, b: 0 },
      }),
      textBlock({
        name: "OrgName",
        text: orgName.toUpperCase(),
        x: textMargin, y: orgY, width: w - textMargin * 2, height: orgH,
        font: "Arial", size: 9,
        color: { r: 120, g: 120, b: 120 },
      }),
    ].join("\n");
  }

  // NOTE: RoundRectangle uses portrait dimension order — Width is the short
  // edge, Height is the long edge, EVEN when orientation is Landscape.
  // Swapping these causes "invalid file" errors in DYMO Connect.
  return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>${sku.orientation}</PaperOrientation>
  <Id>${sku.id}</Id>
  <PaperName>${esc(sku.paperName)}</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="${sku.shortTwips}" Height="${sku.longTwips}" Rx="270" Ry="270" />
  </DrawCommands>
${objects}
</DieCutLabel>`;
}

// ── Object block builders ─────────────────────────────────────────────────

interface TextBlockOpts {
  name: string;
  text: string;
  x: number; y: number;
  width: number; height: number;
  font: string;
  size: number;
  bold?: boolean;
  color?: { r: number; g: number; b: number };
  align?: "Left" | "Center" | "Right";
}

function textBlock(o: TextBlockOpts): string {
  const color = o.color ?? { r: 0, g: 0, b: 0 };
  return `  <ObjectInfo>
    <TextObject>
      <Name>${esc(o.name)}</Name>
      <ForeColor Alpha="255" Red="${color.r}" Green="${color.g}" Blue="${color.b}" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>${o.align ?? "Center"}</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>${esc(o.text)}</String>
          <Attributes>
            <Font Family="${esc(o.font)}" Size="${o.size}" Bold="${o.bold ? "True" : "False"}" Italic="False" Underline="False" Strikeout="False" />
            <ForeColor Alpha="255" Red="${color.r}" Green="${color.g}" Blue="${color.b}" />
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="${o.x}" Y="${o.y}" Width="${o.width}" Height="${o.height}" />
  </ObjectInfo>`;
}

interface BarcodeBlockOpts {
  name: string;
  type: string;   // "QRCode" | "Code128Auto" etc
  data: string;
  x: number; y: number;
  width: number; height: number;
  textPosition?: "None" | "Bottom" | "Top";
}

function barcodeBlock(o: BarcodeBlockOpts): string {
  return `  <ObjectInfo>
    <BarcodeObject>
      <Name>${esc(o.name)}</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <Text>${esc(o.data)}</Text>
      <Type>${o.type}</Type>
      <Size>Large</Size>
      <TextPosition>${o.textPosition ?? "None"}</TextPosition>
      <TextFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
      <CheckSumFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
      <TextEmbedding>None</TextEmbedding>
      <ECLevel>0</ECLevel>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <QuietZonesPadding Left="0" Top="0" Right="0" Bottom="0" />
    </BarcodeObject>
    <Bounds X="${o.x}" Y="${o.y}" Width="${o.width}" Height="${o.height}" />
  </ObjectInfo>`;
}

// ── CSV + README ───────────────────────────────────────────────────────

export function buildSerialsCsv(args: { serialStart: number; serialEnd: number; orgName: string }): string {
  const rows = ["Serial,OrgName"];
  for (let n = args.serialStart; n <= args.serialEnd; n++) {
    rows.push(`${formatSerial(n)},"${args.orgName.replace(/"/g, '""')}"`);
  }
  return rows.join("\n");
}

export function buildDymoReadme(batchId: string, serialStart: number, serialEnd: number): string {
  const count = serialEnd - serialStart + 1;
  const startStr = formatSerial(serialStart);
  const endStr = formatSerial(serialEnd);
  return `LogiTrak Labels — DYMO batch

This ZIP contains:
  • labels.label    — the label template (opens in DYMO Connect)
  • serials.csv     — the ${count} serials to print (${startStr} to ${endStr})
  • README.txt      — this file

HOW TO PRINT ALL ${count} LABELS:

  1. Unzip this folder anywhere on your computer.
  2. Double-click labels.label — DYMO Connect opens the template.
  3. In DYMO Connect, click  File → Import Data and Print.
  4. Select serials.csv from this folder.
  5. Map:
       "Serial"  → Serial (the big text on the label)
       "Serial"  → QRCode  (the QR code)  — or skip if using barcode design
       "OrgName" → OrgName (the small text at the bottom)
  6. Preview, then hit Print.

DYMO Connect will print every serial as its own label — all ${count} in one go.

─────────────────────────────────────────────
Batch ID: ${batchId}
Serials:  ${startStr} to ${endStr}  (${count} labels)

All serials are reserved in LogiTrak and cannot be reused.
Keep this ZIP if you want to re-print this exact batch later.
`;
}

export { MM_TO_TWIPS };
