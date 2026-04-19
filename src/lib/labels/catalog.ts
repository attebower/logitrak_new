/**
 * Printer + label size catalog.
 * Friendly names only in the UI — codes + dimensions here.
 */

export type PrinterType =
  | "brother_ql"
  | "brother_pt"
  | "dymo_labelwriter"
  | "generic_pdf";

export type LabelDesign =
  | "standard"
  | "compact"
  | "barcode_focus"
  | "full_detail"
  | "high_visibility";

export type CodeType = "qr" | "barcode";

export interface LabelSize {
  id: string;
  label: string;          // friendly name shown to user
  widthMm: number;
  heightMm: number;
  // optional hints
  dieCut?: boolean;
}

export interface Printer {
  id: PrinterType;
  brand: string;
  label: string;
  outputFormat: "pdf" | "zpl" | "dymo_xml";
  sizes: LabelSize[];
}

export const PRINTERS: Printer[] = [
  {
    id: "brother_ql",
    brand: "Brother",
    label: "Brother QL Series",
    outputFormat: "pdf",
    sizes: [
      { id: "dk-11204", label: "Small asset tag (17 × 54mm)",    widthMm: 54,  heightMm: 17,  dieCut: true },
      { id: "dk-11201", label: "Standard address (29 × 90mm)",   widthMm: 90,  heightMm: 29,  dieCut: true },
      { id: "dk-11202", label: "Large equipment (62 × 100mm)",   widthMm: 100, heightMm: 62,  dieCut: true },
      { id: "dk-11241", label: "Wide label (102 × 152mm)",       widthMm: 152, heightMm: 102, dieCut: true },
    ],
  },
  {
    id: "brother_pt",
    brand: "Brother",
    label: "Brother PT Series",
    outputFormat: "pdf",
    sizes: [
      { id: "tze-231", label: "Narrow cable label (12mm tape)",  widthMm: 80,  heightMm: 12 },
      { id: "tze-251", label: "Standard (24mm tape)",            widthMm: 80,  heightMm: 24 },
      { id: "tze-261", label: "Wide (36mm tape)",                widthMm: 100, heightMm: 36 },
    ],
  },
  {
    id: "dymo_labelwriter",
    brand: "DYMO",
    label: "DYMO LabelWriter",
    outputFormat: "dymo_xml",
    sizes: [
      { id: "30334",   label: "Small multipurpose (57 × 32mm)",  widthMm: 57,  heightMm: 32, dieCut: true },
      { id: "30252",   label: "Standard address (28 × 89mm)",    widthMm: 89,  heightMm: 28, dieCut: true },
      { id: "30256",   label: "Large shipping (59 × 102mm)",     widthMm: 102, heightMm: 59, dieCut: true },
    ],
  },
  {
    id: "generic_pdf",
    brand: "Other",
    label: "Generic / PDF",
    outputFormat: "pdf",
    sizes: [
      { id: "a4-sheet", label: "A4 sheet (2×5 per page, 90×50mm each)", widthMm: 90, heightMm: 50 },
      { id: "custom",   label: "Custom 100 × 50mm",                      widthMm: 100, heightMm: 50 },
    ],
  },
];

export const LABEL_DESIGNS: Array<{ id: LabelDesign; label: string; description: string }> = [
  { id: "standard",        label: "Standard",        description: "Clean, centred — good for most kit" },
  { id: "compact",         label: "Compact",         description: "Code on the left, text on the right — fits narrow labels" },
  { id: "barcode_focus",   label: "Barcode Focus",   description: "Big scannable code on top, text below" },
  { id: "full_detail",     label: "Full Detail",     description: "Includes equipment name (assigned only)" },
  { id: "high_visibility", label: "High Visibility", description: "Oversized serial for dim environments" },
];

export function getPrinter(id: PrinterType): Printer | undefined {
  return PRINTERS.find((p) => p.id === id);
}

export function getLabelSize(printerId: PrinterType, sizeId: string): LabelSize | undefined {
  return getPrinter(printerId)?.sizes.find((s) => s.id === sizeId);
}

export function formatSerial(n: number): string {
  return n.toString().padStart(5, "0");
}
