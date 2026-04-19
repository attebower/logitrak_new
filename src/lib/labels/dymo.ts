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
 * Confirmed-working DYMO label SKUs.
 *
 * CRITICAL RULE FOR LANDSCAPE LABELS:
 *   Width  = LONG edge (big number)
 *   Height = SHORT edge (small number)
 *
 * If Height > Width for a landscape label, they're swapped and the file
 * will be rejected as invalid. This trips up every single time — always
 * check that widthTwips > heightTwips for a landscape SKU.
 */
interface DymoSku {
  paperName: string;
  id: string;
  widthTwips: number;   // Goes in RoundRectangle Width  — LONG edge for landscape
  heightTwips: number;  // Goes in RoundRectangle Height — SHORT edge for landscape
  orientation: "Landscape" | "Portrait";
}

const DYMO_SKUS: Record<string, DymoSku> = {
  // 30252 Address — 89 × 28mm landscape
  "30252": { paperName: "30252 Address",       id: "Address",       widthTwips: 5040, heightTwips: 1581, orientation: "Landscape" },
  // 30334 Multi-Purpose — 57 × 32mm landscape
  "30334": { paperName: "30334 Multi-Purpose", id: "MultiPurpose",  widthTwips: 3231, heightTwips: 1814, orientation: "Landscape" },
  // 30256 Shipping — 101 × 59mm landscape
  "30256": { paperName: "30256 Shipping",      id: "LargeShipping", widthTwips: 5715, heightTwips: 3331, orientation: "Landscape" },
  // 30321 Large Address — 89 × 36mm landscape
  "30321": { paperName: "30321 Large Address", id: "LargeAddress",  widthTwips: 5020, heightTwips: 2025, orientation: "Landscape" },
  // 11355 Multi-Purpose — 51 × 19mm landscape
  "11355": { paperName: "11355 Multi-Purpose", id: "MultiPurpose2", widthTwips: 3402, heightTwips: 2268, orientation: "Landscape" },
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

  // Layout is built in the actual canvas orientation (landscape = wide).
  // Structure: code on the LEFT, serial + org stacked on the RIGHT.
  const w = sku.widthTwips;   // long edge for landscape
  const h = sku.heightTwips;  // short edge for landscape

  const padding = Math.round(h * 0.08);
  const codeSize = Math.min(h - padding * 2, Math.round(w * 0.25));
  const codeX = padding;
  const codeY = Math.round((h - codeSize) / 2);

  const textX = codeX + codeSize + padding;
  const textW = w - textX - padding;
  const serialY = Math.round(h * 0.12);
  const serialH = Math.round(h * 0.48);
  const orgY = Math.round(h * 0.62);
  const orgH = Math.round(h * 0.28);

  // For barcode_focus we'd use a very different layout, but phase 1 uses
  // one shared layout for DYMO regardless of design choice
  const objects = [
    barcodeBlock({
      name: codeType === "qr" ? "QRCode" : "Barcode",
      type: barcodeType,
      data: barcodeData,
      x: codeX, y: codeY,
      width: codeType === "qr" ? codeSize : Math.round(codeSize * 1.5),
      height: codeSize,
      textPosition: codeType === "qr" ? "None" : "Bottom",
    }),
    textBlock({
      name: "Serial",
      text: placeholderSerial,
      x: textX, y: serialY, width: textW, height: serialH,
      font: "Courier New",
      size: fontSizeFor(h, 0.5),  // scales with label height
      bold: true,
      color: { r: 0, g: 0, b: 0 },
      align: "Left",
    }),
    textBlock({
      name: "OrgName",
      text: orgName.toUpperCase(),
      x: textX, y: orgY, width: textW, height: orgH,
      font: "Arial",
      size: fontSizeFor(h, 0.22),
      color: { r: 120, g: 120, b: 120 },
      align: "Left",
    }),
  ].join("\n");

  // RoundRectangle: Width = LONG edge, Height = SHORT edge for landscape.
  // This always matches the physical canvas orientation.
  return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>${sku.orientation}</PaperOrientation>
  <Id>${sku.id}</Id>
  <PaperName>${esc(sku.paperName)}</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="${sku.widthTwips}" Height="${sku.heightTwips}" Rx="270" Ry="270" />
  </DrawCommands>
${objects}
</DieCutLabel>`;
}

/**
 * Pick a font point size that reads well in a given label height.
 * `frac` is the fraction of the label height the text should target.
 * 1 twip = 1/1440 inch, 1 pt = 1/72 inch, so 1 pt = 20 twips.
 */
function fontSizeFor(labelHeightTwips: number, frac: number): number {
  const pts = Math.round((labelHeightTwips * frac) / 20);
  return Math.max(7, Math.min(48, pts));
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
