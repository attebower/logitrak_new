/**
 * Label catalog — designs, printer options, StickerMule config.
 */

export type LabelDesign = "minimal" | "standard" | "full";
export type PrinterType = "brother_ql";
export type OutputMethod = "stickermule" | "brother_ql" | "custom_csv";
export type CodeType = "qr" | "barcode";

export interface LabelSize {
  id:       string;
  label:    string;
  widthMm:  number;
  heightMm: number;
  dieCut?:  boolean;
}

export interface Printer {
  id:           PrinterType;
  brand:        string;
  label:        string;
  outputFormat: "pdf";
  sizes:        LabelSize[];
}

// ── Designs ──────────────────────────────────────────────────────────────────

export const LABEL_DESIGNS: Array<{
  id:          LabelDesign;
  label:       string;
  description: string;
}> = [
  {
    id:          "minimal",
    label:       "Minimal",
    description: "QR code only — clean, works on small labels",
  },
  {
    id:          "standard",
    label:       "Standard",
    description: "QR code + serial number — the go-to choice",
  },
  {
    id:          "full",
    label:       "Full",
    description: "QR code + serial + organisation name",
  },
];

// ── Brother QL (DIY fallback) ────────────────────────────────────────────────

export const BROTHER_QL_SIZES: LabelSize[] = [
  { id: "dk-11204", label: "Small asset tag (17 × 54mm)",  widthMm: 54,  heightMm: 17, dieCut: true },
  { id: "dk-11201", label: "Standard (29 × 90mm)",         widthMm: 90,  heightMm: 29, dieCut: true },
  { id: "dk-11202", label: "Large (62 × 100mm)",           widthMm: 100, heightMm: 62, dieCut: true },
];

export const PRINTERS: Printer[] = [
  {
    id:           "brother_ql",
    brand:        "Brother",
    label:        "Brother QL Series",
    outputFormat: "pdf",
    sizes:        BROTHER_QL_SIZES,
  },
];

// ── StickerMule sizes (vinyl die-cut) ────────────────────────────────────────

export interface StickerMuleSize {
  id:       string;
  label:    string;
  widthMm:  number;
  heightMm: number;
  /** Approximate price per sticker in GBP at 50 qty — for display only */
  unitPricePence: number;
}

export const STICKERMULE_SIZES: StickerMuleSize[] = [
  { id: "sm-small",    label: "Small (25 × 51mm)",   widthMm: 51,  heightMm: 25, unitPricePence: 28 },
  { id: "sm-standard", label: "Standard (38 × 76mm)", widthMm: 76,  heightMm: 38, unitPricePence: 35 },
  { id: "sm-large",    label: "Large (51 × 102mm)",   widthMm: 102, heightMm: 51, unitPricePence: 45 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getPrinter(id: PrinterType): Printer | undefined {
  return PRINTERS.find((p) => p.id === id);
}

export function getLabelSize(printerId: PrinterType, sizeId: string): LabelSize | undefined {
  return getPrinter(printerId)?.sizes.find((s) => s.id === sizeId);
}

export function getStickerMuleSize(id: string): StickerMuleSize | undefined {
  return STICKERMULE_SIZES.find((s) => s.id === id);
}

export function formatSerial(n: number): string {
  return n.toString().padStart(5, "0");
}
