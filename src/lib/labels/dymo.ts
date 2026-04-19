/**
 * DYMO .label file generator for DYMO Connect.
 *
 * IMPORTANT:
 *   - File extension is .label (NOT .dymo)
 *   - Root element is <DieCutLabel Version="8.0" Units="twips"> (v8 legacy
 *     format that DYMO Connect auto-converts on open). DO NOT use the newer
 *     <DesktopLabel> wrapper — DYMO Connect rejects those for user-opened
 *     files.
 *   - Units are TWIPS (1 inch = 1440 twips, 1mm = 56.69 twips).
 *   - Object name tag is <n> (lowercase), NOT <Name>. Using <Name> causes
 *     "invalid file" errors.
 *   - No UTF-8 BOM required for this format.
 *
 * This implementation is based on the confirmed-working schema in
 * docs/dymo-label-schema.md and has been tested against DYMO Connect
 * for Desktop (April 2026).
 *
 * Batch strategy: generate one complete .label file per serial, bundled
 * in a ZIP. User unzips, double-clicks any file (they all open the same
 * design — just different serials).
 */

import { formatSerial, type LabelSize, type CodeType, type LabelDesign } from "./catalog";

const MM_TO_TWIPS = 56.69;

/**
 * Per-SKU DYMO label definitions. Using the right PaperName/Id/dimensions is
 * what makes DYMO Connect recognise the file for a specific label roll.
 */
interface DymoSku {
  paperName: string;
  id: string;
  widthTwips: number;
  heightTwips: number;
  /** Natural orientation: landscape if width > height */
  orientation: "Landscape" | "Portrait";
}

const DYMO_SKUS: Record<string, DymoSku> = {
  // 30252 Address — 89 × 28mm (landscape)
  "30252": { paperName: "30252 Address",        id: "Address",         widthTwips: 5040, heightTwips: 1581, orientation: "Landscape" },
  // 30334 Multi-Purpose — 57 × 32mm (landscape, but our catalog uses 57x32mm)
  // Spec says 60×20mm but our catalog's 30334 is actually 57×32mm small multipurpose
  "30334": { paperName: "30334 Multi-Purpose",  id: "MultiPurpose",    widthTwips: 3231, heightTwips: 1814, orientation: "Landscape" },
  // 30256 Shipping — 101 × 59mm
  "30256": { paperName: "30256 Shipping",       id: "LargeShipping",   widthTwips: 5715, heightTwips: 3331, orientation: "Landscape" },
  // 30321 Large Address — 89 × 36mm
  "30321": { paperName: "30321 Large Address",  id: "LargeAddress",    widthTwips: 5020, heightTwips: 2025, orientation: "Landscape" },
  // 11355 Multi-Purpose — 51 × 19mm
  "11355": { paperName: "11355 Multi-Purpose",  id: "MultiPurpose2",   widthTwips: 3402, heightTwips: 2268, orientation: "Landscape" },
};

function skuFor(size: LabelSize): DymoSku {
  // First, try exact match by our catalog id
  if (DYMO_SKUS[size.id]) return DYMO_SKUS[size.id];
  // Otherwise fall back to Address (safest default)
  return DYMO_SKUS["30252"];
}

export interface DymoArgs {
  serialStart: number;
  serialEnd: number;
  design: LabelDesign;
  codeType: CodeType;
  orgName: string;
  size: LabelSize;
  workspaceSlug?: string;
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
 * Build the QR code URL encoded into the QR. Matches LogiTrak's
 * equipment URL pattern — scanning the QR jumps straight to the kit record.
 */
function buildQrContent(serial: string, workspaceSlug: string | undefined): string {
  const slug = workspaceSlug || "workspace";
  return `https://app.logitrack.io/${slug}/equipment/${serial}`;
}

/**
 * Generate ONE .label file for ONE serial. For batches, call this once per
 * serial and bundle the results into a ZIP.
 */
export function buildDymoLabel(args: DymoArgs & { serial?: number }): string {
  const { size, codeType, orgName, design, workspaceSlug } = args;
  const serialNum = args.serial ?? args.serialStart;
  const serial = formatSerial(serialNum);

  const sku = skuFor(size);
  const w = sku.widthTwips;
  const h = sku.heightTwips;

  const barcodeType = codeType === "qr" ? "QRCode" : "Code128Auto";
  const barcodeData = codeType === "qr" ? buildQrContent(serial, workspaceSlug) : serial;

  const objects = buildObjectsForDesign(design, {
    widthTwips: w,
    heightTwips: h,
    barcodeType,
    barcodeData,
    codeType,
    serial,
    orgName: orgName.toUpperCase(),
  });

  return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>${sku.orientation}</PaperOrientation>
  <Id>${sku.id}</Id>
  <PaperName>${esc(sku.paperName)}</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="${w}" Height="${h}" Rx="270" Ry="270" />
  </DrawCommands>
${objects}
</DieCutLabel>`;
}

// ── Per-design object generators ─────────────────────────────────────────

interface DesignArgs {
  widthTwips: number;
  heightTwips: number;
  barcodeType: string;  // "QRCode" | "Code128Auto"
  barcodeData: string;
  codeType: CodeType;
  serial: string;
  orgName: string;
}

function buildObjectsForDesign(design: LabelDesign, a: DesignArgs): string {
  switch (design) {
    case "standard":        return standardLayout(a);
    case "compact":         return compactLayout(a);
    case "barcode_focus":   return barcodeFocusLayout(a);
    case "full_detail":     return fullDetailLayout(a);
    case "high_visibility": return highVisibilityLayout(a);
  }
}

// Design 1: Standard — code centred-left, serial and org stacked right
function standardLayout(a: DesignArgs): string {
  const { widthTwips: w, heightTwips: h, codeType } = a;
  const codeSize = Math.min(h * 0.85, w * 0.35);
  const codeX = Math.round(w * 0.05);
  const codeY = Math.round((h - codeSize) / 2);
  const textX = Math.round(codeX + codeSize + w * 0.04);
  const textW = w - textX - Math.round(w * 0.04);
  return [
    codeType === "qr"
      ? qrObject({ name: "QRCode", data: a.barcodeData, x: codeX, y: codeY, width: Math.round(codeSize), height: Math.round(codeSize) })
      : barcodeObject({ name: "Barcode", data: a.barcodeData, x: codeX, y: codeY, width: Math.round(codeSize * 1.8), height: Math.round(codeSize), textPosition: "None" }),
    textObject({
      name: "Serial",
      text: a.serial,
      x: textX, y: Math.round(h * 0.15),
      width: textW, height: Math.round(h * 0.45),
      font: "Courier New", size: 22, bold: true,
      color: { r: 15, g: 23, b: 42 },
      align: "Center",
    }),
    textObject({
      name: "OrgName",
      text: a.orgName,
      x: textX, y: Math.round(h * 0.65),
      width: textW, height: Math.round(h * 0.25),
      font: "Arial", size: 9,
      color: { r: 71, g: 85, b: 105 },
      align: "Center",
    }),
  ].join("\n");
}

// Design 2: Compact — QR left (squarer), serial + org right
function compactLayout(a: DesignArgs): string {
  const { widthTwips: w, heightTwips: h, codeType } = a;
  const codeSize = Math.round(h * 0.9);
  const codeY = Math.round((h - codeSize) / 2);
  const textX = codeSize + Math.round(w * 0.04);
  const textW = w - textX - Math.round(w * 0.03);
  return [
    codeType === "qr"
      ? qrObject({ name: "QRCode", data: a.barcodeData, x: Math.round(w * 0.02), y: codeY, width: codeSize, height: codeSize })
      : barcodeObject({ name: "Barcode", data: a.barcodeData, x: Math.round(w * 0.02), y: codeY, width: Math.round(codeSize * 1.4), height: codeSize, textPosition: "None" }),
    textObject({
      name: "Serial",
      text: a.serial,
      x: textX, y: Math.round(h * 0.1),
      width: textW, height: Math.round(h * 0.45),
      font: "Courier New", size: 26, bold: true,
      color: { r: 15, g: 23, b: 42 },
      align: "Left",
    }),
    textObject({
      name: "OrgName",
      text: a.orgName,
      x: textX, y: Math.round(h * 0.6),
      width: textW, height: Math.round(h * 0.3),
      font: "Arial", size: 10,
      color: { r: 71, g: 85, b: 105 },
      align: "Left",
    }),
  ].join("\n");
}

// Design 3: Barcode Focus — wide barcode with text-below enabled, org at bottom
function barcodeFocusLayout(a: DesignArgs): string {
  const { widthTwips: w, heightTwips: h } = a;
  // Force Code128 for this design regardless of user choice — it's the point
  const barcodeX = Math.round(w * 0.02);
  const barcodeY = Math.round(h * 0.05);
  const barcodeW = w - barcodeX * 2;
  const barcodeH = Math.round(h * 0.65);
  return [
    barcodeObject({
      name: "Barcode",
      data: a.serial,  // Code128 always uses the raw serial, not URL
      x: barcodeX, y: barcodeY,
      width: barcodeW, height: barcodeH,
      textPosition: "Bottom",
      textFontSize: 10,
    }),
    textObject({
      name: "OrgName",
      text: a.orgName,
      x: barcodeX, y: Math.round(h * 0.82),
      width: barcodeW, height: Math.round(h * 0.15),
      font: "Arial", size: 8,
      color: { r: 71, g: 85, b: 105 },
      align: "Center",
    }),
  ].join("\n");
}

// Design 4: Full Detail — QR left, name + serial + org stacked right
function fullDetailLayout(a: DesignArgs): string {
  const { widthTwips: w, heightTwips: h, codeType } = a;
  const codeSize = Math.round(h * 0.85);
  const codeY = Math.round((h - codeSize) / 2);
  const textX = codeSize + Math.round(w * 0.04);
  const textW = w - textX - Math.round(w * 0.03);
  return [
    codeType === "qr"
      ? qrObject({ name: "QRCode", data: a.barcodeData, x: Math.round(w * 0.02), y: codeY, width: codeSize, height: codeSize })
      : barcodeObject({ name: "Barcode", data: a.barcodeData, x: Math.round(w * 0.02), y: codeY, width: Math.round(codeSize * 1.4), height: codeSize, textPosition: "None" }),
    textObject({
      name: "EquipmentName",
      text: "Unassigned",
      x: textX, y: Math.round(h * 0.05),
      width: textW, height: Math.round(h * 0.28),
      font: "Arial", size: 12, bold: true,
      color: { r: 15, g: 23, b: 42 },
      align: "Left",
    }),
    textObject({
      name: "Serial",
      text: `SN: ${a.serial}`,
      x: textX, y: Math.round(h * 0.36),
      width: textW, height: Math.round(h * 0.28),
      font: "Courier New", size: 14, bold: true,
      color: { r: 15, g: 23, b: 42 },
      align: "Left",
    }),
    textObject({
      name: "OrgName",
      text: a.orgName,
      x: textX, y: Math.round(h * 0.68),
      width: textW, height: Math.round(h * 0.25),
      font: "Arial", size: 8,
      color: { r: 71, g: 85, b: 105 },
      align: "Left",
    }),
  ].join("\n");
}

// Design 5: High Visibility — huge serial dominates, small QR + org at bottom
function highVisibilityLayout(a: DesignArgs): string {
  const { widthTwips: w, heightTwips: h, codeType } = a;
  const spaced = a.serial.split("").join(" ");
  const codeSize = Math.round(h * 0.35);
  return [
    textObject({
      name: "Serial",
      text: spaced,
      x: Math.round(w * 0.02), y: Math.round(h * 0.05),
      width: w - Math.round(w * 0.04), height: Math.round(h * 0.55),
      font: "Arial", size: 36, bold: true,
      color: { r: 15, g: 23, b: 42 },
      align: "Center",
    }),
    codeType === "qr"
      ? qrObject({ name: "QRCode", data: a.barcodeData, size: "Small", x: Math.round(w * 0.02), y: h - codeSize - Math.round(h * 0.05), width: codeSize, height: codeSize })
      : barcodeObject({ name: "Barcode", data: a.barcodeData, x: Math.round(w * 0.02), y: h - codeSize - Math.round(h * 0.05), width: Math.round(codeSize * 1.6), height: codeSize, textPosition: "None" }),
    textObject({
      name: "OrgName",
      text: a.orgName,
      x: Math.round(w * 0.3), y: h - Math.round(h * 0.25),
      width: Math.round(w * 0.65), height: Math.round(h * 0.2),
      font: "Arial", size: 9,
      color: { r: 71, g: 85, b: 105 },
      align: "Right",
    }),
  ].join("\n");
}

// ── Object builders ──────────────────────────────────────────────────────

interface TextObjOpts {
  name: string;
  text: string;
  x: number; y: number;
  width: number; height: number;
  font: string;
  size: number;         // points
  bold?: boolean;
  italic?: boolean;
  color?: { r: number; g: number; b: number };
  align?: "Left" | "Center" | "Right";
  vAlign?: "Top" | "Middle" | "Bottom";
}

function textObject(o: TextObjOpts): string {
  const color = o.color ?? { r: 0, g: 0, b: 0 };
  return `  <ObjectInfo>
    <TextObject>
      <n>${esc(o.name)}</n>
      <ForeColor Alpha="255" Red="${color.r}" Green="${color.g}" Blue="${color.b}" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>${o.align ?? "Center"}</HorizontalAlignment>
      <VerticalAlignment>${o.vAlign ?? "Middle"}</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>${esc(o.text)}</String>
          <Attributes>
            <Font Family="${esc(o.font)}" Size="${o.size}" Bold="${o.bold ? "True" : "False"}" Italic="${o.italic ? "True" : "False"}" Underline="False" Strikeout="False" />
            <ForeColor Alpha="255" Red="${color.r}" Green="${color.g}" Blue="${color.b}" />
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="${o.x}" Y="${o.y}" Width="${o.width}" Height="${o.height}" />
  </ObjectInfo>`;
}

interface QrObjOpts {
  name: string;
  data: string;
  x: number; y: number;
  width: number; height: number;
  size?: "Small" | "Medium" | "Large";
}

function qrObject(o: QrObjOpts): string {
  return `  <ObjectInfo>
    <BarcodeObject>
      <n>${esc(o.name)}</n>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <Text>${esc(o.data)}</Text>
      <Type>QRCode</Type>
      <Size>${o.size ?? "Large"}</Size>
      <TextPosition>None</TextPosition>
      <TextFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
      <CheckSumFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
      <TextEmbedding>None</TextEmbedding>
      <ECLevel>1</ECLevel>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <QuietZonesPadding Left="0" Top="0" Right="0" Bottom="0" />
    </BarcodeObject>
    <Bounds X="${o.x}" Y="${o.y}" Width="${o.width}" Height="${o.height}" />
  </ObjectInfo>`;
}

interface BarcodeObjOpts {
  name: string;
  data: string;
  x: number; y: number;
  width: number; height: number;
  textPosition?: "None" | "Bottom" | "Top";
  textFontSize?: number;
}

function barcodeObject(o: BarcodeObjOpts): string {
  return `  <ObjectInfo>
    <BarcodeObject>
      <n>${esc(o.name)}</n>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <Text>${esc(o.data)}</Text>
      <Type>Code128Auto</Type>
      <Size>Large</Size>
      <TextPosition>${o.textPosition ?? "Bottom"}</TextPosition>
      <TextFont Family="Arial" Size="${o.textFontSize ?? 8}" Bold="False" Italic="False" Underline="False" Strikeout="False" />
      <CheckSumFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
      <TextEmbedding>None</TextEmbedding>
      <ECLevel>0</ECLevel>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <QuietZonesPadding Left="0" Top="0" Right="0" Bottom="0" />
    </BarcodeObject>
    <Bounds X="${o.x}" Y="${o.y}" Width="${o.width}" Height="${o.height}" />
  </ObjectInfo>`;
}

// ── CSV + README (still useful for users) ────────────────────────────────

export function buildSerialsCsv(args: { serialStart: number; serialEnd: number; orgName: string }): string {
  const rows = ["Serial,OrgName"];
  for (let n = args.serialStart; n <= args.serialEnd; n++) {
    rows.push(`${formatSerial(n)},"${args.orgName.replace(/"/g, '""')}"`);
  }
  return rows.join("\n");
}

export function buildDymoReadme(batchId: string, serialStart: number, serialEnd: number): string {
  const count = serialEnd - serialStart + 1;
  return `LogiTrak Labels — DYMO batch

How to print:

1. Unzip this folder anywhere on your computer.
2. Double-click any .label file — DYMO Connect opens with that serial ready.
3. To print ALL ${count} labels at once, DYMO Connect's batch print:
   - Open any .label file
   - File → Print Multiple Labels
   - Select all .label files in this folder
   - Hit Print
4. Or print them individually — each file opens independently.

Batch ID: ${batchId}
Serials: ${formatSerial(serialStart)}–${formatSerial(serialEnd)} (${count} labels)

All serials are reserved in LogiTrak and cannot be reused. Re-open any
file in this folder any time to re-print that specific label.
`;
}

// TWIPS export for reference (potentially used by other modules)
export { MM_TO_TWIPS };
