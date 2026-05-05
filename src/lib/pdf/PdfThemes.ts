/**
 * Shared theme objects for the @react-pdf/renderer PDFs.
 *
 * One theme drives every PDF (invoice, equipment list, set snapshot, report)
 * so the user can pick a single look in /settings/documents (or /settings/invoicing
 * for the invoice variant) and have everything stay consistent.
 *
 * Three variants:
 *   - modern  — current look. Brand-blue bar, Helvetica, generous spacing.
 *   - classic — Times Roman serif, formal centred header, ruled tables.
 *   - minimal — small Helvetica, tight spacing, no brand colour.
 */

export type PdfTemplate = "modern" | "classic" | "minimal";

export interface PdfThemeColors {
  brand:       string; // primary accent
  surfaceDark: string; // primary text
  grey:        string; // secondary text
  greyMid:     string; // borders / rules
  greyLight:   string; // table header backgrounds, soft fills
}

export interface PdfThemePage {
  paddingTop:        number;
  paddingHorizontal: number;
  paddingBottom:     number;
}

export interface PdfThemeHeader {
  showBar:   boolean;                          // 4px brand-coloured bar at the top
  barHeight: number;
  align:     "left" | "center";                // brand row alignment
  logoStyle: "block" | "inline" | "hidden";    // logo presentation when one is provided
  titleCase: "upper" | "title";                // section header casing
}

export interface PdfThemeFont {
  baseSize:   number;                          // body text point size
  lineHeight: number;
  family:     "Helvetica" | "Times-Roman";
  titleSize:  number;
  metaSize:   number;
}

export interface PdfThemeSpacing {
  section: number; // gap between major sections
  row:     number; // table-row vertical padding
  page:    number; // gap between top-level page blocks
}

export interface PdfThemeTable {
  headerBackground: string;
  headerColor:      string;
  headerCase:       "upper" | "title";
  rowBorder:        "all" | "bottom" | "none";
  rowBorderColor:   string;
}

export interface PdfThemeFooter {
  showBar:   boolean;
  align:     "left" | "center";
  italic:    boolean;
}

export interface PdfTheme {
  template: PdfTemplate;
  colors:   PdfThemeColors;
  page:     PdfThemePage;
  header:   PdfThemeHeader;
  font:     PdfThemeFont;
  spacing:  PdfThemeSpacing;
  table:    PdfThemeTable;
  footer:   PdfThemeFooter;
}

const COLORS_DEFAULT: PdfThemeColors = {
  brand:       "#2563EB",
  surfaceDark: "#0F172A",
  grey:        "#64748B",
  greyMid:     "#CBD5E1",
  greyLight:   "#F1F5F9",
};

const COLORS_NEUTRAL: PdfThemeColors = {
  brand:       "#0F172A", // collapse brand to surface-dark for minimal/classic
  surfaceDark: "#0F172A",
  grey:        "#64748B",
  greyMid:     "#CBD5E1",
  greyLight:   "#F8FAFC",
};

export const PDF_THEMES: Record<PdfTemplate, PdfTheme> = {
  modern: {
    template: "modern",
    colors:   COLORS_DEFAULT,
    page:     { paddingTop: 48, paddingHorizontal: 48, paddingBottom: 48 },
    header:   { showBar: true,  barHeight: 4, align: "left",   logoStyle: "block",  titleCase: "upper" },
    font:     { baseSize: 10, lineHeight: 1.4, family: "Helvetica",   titleSize: 18, metaSize: 9 },
    spacing:  { section: 24, row: 8, page: 16 },
    table:    { headerBackground: COLORS_DEFAULT.greyLight, headerColor: COLORS_DEFAULT.surfaceDark, headerCase: "upper", rowBorder: "bottom", rowBorderColor: COLORS_DEFAULT.greyMid },
    footer:   { showBar: true,  align: "left",   italic: false },
  },

  classic: {
    template: "classic",
    colors:   COLORS_NEUTRAL,
    page:     { paddingTop: 56, paddingHorizontal: 56, paddingBottom: 56 },
    header:   { showBar: false, barHeight: 0, align: "center", logoStyle: "block",  titleCase: "title" },
    font:     { baseSize: 10, lineHeight: 1.5, family: "Times-Roman", titleSize: 22, metaSize: 9 },
    spacing:  { section: 28, row: 9, page: 18 },
    table:    { headerBackground: "#FFFFFF", headerColor: COLORS_NEUTRAL.surfaceDark, headerCase: "upper", rowBorder: "bottom", rowBorderColor: COLORS_NEUTRAL.surfaceDark },
    footer:   { showBar: false, align: "center", italic: true },
  },

  minimal: {
    template: "minimal",
    colors:   COLORS_NEUTRAL,
    page:     { paddingTop: 28, paddingHorizontal: 32, paddingBottom: 28 },
    header:   { showBar: false, barHeight: 0, align: "left",   logoStyle: "inline", titleCase: "title" },
    font:     { baseSize: 8,  lineHeight: 1.35, family: "Helvetica",   titleSize: 14, metaSize: 7 },
    spacing:  { section: 16, row: 5, page: 12 },
    table:    { headerBackground: "#FFFFFF", headerColor: COLORS_NEUTRAL.surfaceDark, headerCase: "title", rowBorder: "bottom", rowBorderColor: COLORS_NEUTRAL.greyMid },
    footer:   { showBar: false, align: "left",   italic: false },
  },
};

export function getPdfTheme(template: PdfTemplate | null | undefined): PdfTheme {
  return PDF_THEMES[template ?? "modern"];
}
