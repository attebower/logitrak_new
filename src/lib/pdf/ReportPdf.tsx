/**
 * Report PDF renderer.
 *
 * Matches LogiTrak's Set Snapshot PDF style (same palette, typography, header,
 * footer, table treatment). Used by the Reports page to export the active
 * table (Checked Out / Damaged / By Location) as a branded PDF.
 */

import {
  Document, Page, Text, View, StyleSheet, pdf,
} from "@react-pdf/renderer";
import { getPdfTheme, type PdfTemplate, type PdfTheme } from "./PdfThemes";

function fmtDateTime(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function buildStyles(theme: PdfTheme) {
  const { colors, page, font, spacing, table, footer } = theme;
  return StyleSheet.create({
    page: { paddingTop: page.paddingTop, paddingBottom: page.paddingBottom + 16, paddingHorizontal: page.paddingHorizontal, fontFamily: font.family, fontSize: font.baseSize, color: colors.surfaceDark, backgroundColor: "#FFFFFF" },
    headerBar:    { height: theme.header.barHeight, backgroundColor: colors.brand, marginBottom: 20 },
    brandRow:     { flexDirection: "row", alignItems: "center", justifyContent: theme.header.align === "center" ? "center" : "space-between", marginBottom: 6, gap: theme.header.align === "center" ? 12 : 0 },
    brandName:    { fontSize: font.baseSize + 2, color: colors.brand, fontWeight: 700, letterSpacing: 1.2 },
    documentKind: { fontSize: font.metaSize, color: colors.grey, textTransform: "uppercase", letterSpacing: 1.2 },
    title:        { fontSize: font.titleSize, fontWeight: 700, marginTop: 4, textAlign: theme.header.align },
    subtitle:     { fontSize: font.baseSize + 2, color: colors.grey, marginTop: 4, textAlign: theme.header.align },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.greyMid, borderTopStyle: "solid" },
    metaLabel: { fontSize: font.metaSize - 1, color: colors.grey, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
    metaValue: { fontSize: font.baseSize + 1, color: colors.surfaceDark },
    section:       { marginTop: spacing.section },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.greyMid, borderBottomStyle: "solid" },
    sectionTitle: { fontSize: font.baseSize + 4, fontWeight: 700, color: colors.surfaceDark, textTransform: table.headerCase === "upper" ? "uppercase" : "none", letterSpacing: table.headerCase === "upper" ? 1 : 0 },
    sectionCount: { fontSize: font.baseSize, color: colors.grey },
    tableHeader: { flexDirection: "row", backgroundColor: table.headerBackground, paddingVertical: spacing.row - 2, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: table.rowBorderColor, borderBottomStyle: "solid" },
    tableRow: { flexDirection: "row", paddingVertical: spacing.row - 2, paddingHorizontal: 8, ...(table.rowBorder !== "none" && { borderBottomWidth: 0.5, borderBottomColor: colors.greyMid, borderBottomStyle: "solid" as const }) },
    th: { fontSize: font.metaSize, color: table.headerColor, textTransform: table.headerCase === "upper" ? "uppercase" : "none", fontWeight: 700, letterSpacing: 0.5 },
    td: { fontSize: font.baseSize, color: colors.surfaceDark },
    empty: { fontSize: font.baseSize, color: colors.grey, fontStyle: "italic", paddingVertical: 10 },
    footer: { position: "absolute", left: page.paddingHorizontal, right: page.paddingHorizontal, bottom: 24, flexDirection: "row", justifyContent: footer.align === "center" ? "center" : "space-between", fontSize: font.metaSize, color: colors.grey, paddingTop: 6, ...(footer.showBar && { borderTopWidth: 0.5, borderTopColor: colors.greyMid, borderTopStyle: "solid" as const }), fontStyle: footer.italic ? "italic" : "normal", gap: footer.align === "center" ? 8 : 0 },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface ReportPdfColumn {
  key:   string;
  label: string;
  /** Column width in pt (for react-pdf). If omitted, the column flexes. */
  width?: number;
}

export interface ReportPdfData {
  /** Main document title — e.g. "Checked Out Report" */
  title: string;
  /** Subtitle under title — e.g. "LogiTrak Demo · Last 30 days" */
  subtitle?: string;
  /** Optional metadata pairs rendered under the subtitle */
  meta?:    Array<{ label: string; value: string }>;
  /** Workspace name (used in footer) */
  workspaceName: string;
  /** Who generated the PDF (display name / email) */
  generatedBy:   string;
  generatedAt:   Date;
  /** Visual template — driven by /settings/documents. Defaults to modern. */
  template?: PdfTemplate;
  columns: ReportPdfColumn[];
  rows:    Record<string, unknown>[];
}

// ── Components ────────────────────────────────────────────────────────────

type Styles = ReturnType<typeof buildStyles>;

function Header({ data, theme, s }: { data: ReportPdfData; theme: PdfTheme; s: Styles }) {
  return (
    <View>
      {theme.header.showBar && <View style={s.headerBar} fixed />}
      <View style={s.brandRow}>
        <Text style={s.brandName}>{data.workspaceName.toUpperCase()}</Text>
        <Text style={s.documentKind}>Report</Text>
      </View>
      <Text style={s.title}>{data.title}</Text>
      {data.subtitle && <Text style={s.subtitle}>{data.subtitle}</Text>}

      <View style={s.metaRow}>
        <View>
          <Text style={s.metaLabel}>Workspace</Text>
          <Text style={s.metaValue}>{data.workspaceName}</Text>
        </View>
        {(data.meta ?? []).map((m) => (
          <View key={m.label}>
            <Text style={s.metaLabel}>{m.label}</Text>
            <Text style={s.metaValue}>{m.value}</Text>
          </View>
        ))}
        <View>
          <Text style={s.metaLabel}>Generated</Text>
          <Text style={s.metaValue}>{fmtDateTime(data.generatedAt)}</Text>
        </View>
        <View>
          <Text style={s.metaLabel}>By</Text>
          <Text style={s.metaValue}>{data.generatedBy}</Text>
        </View>
      </View>
    </View>
  );
}

function Table({ data, s }: { data: ReportPdfData; s: Styles }) {
  function colStyle(c: ReportPdfColumn) {
    return c.width != null
      ? { width: c.width, paddingRight: 8 }
      : { flex: 1, paddingRight: 8 };
  }

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>{data.title}</Text>
        <Text style={s.sectionCount}>
          {data.rows.length} {data.rows.length === 1 ? "row" : "rows"}
        </Text>
      </View>

      {data.rows.length === 0 ? (
        <Text style={s.empty}>No results.</Text>
      ) : (
        <View>
          <View style={s.tableHeader} fixed>
            {data.columns.map((c) => (
              <Text key={c.key} style={[s.th, colStyle(c)]}>{c.label}</Text>
            ))}
          </View>
          {data.rows.map((row, i) => (
            <View key={i} style={s.tableRow} wrap={false}>
              {data.columns.map((c) => {
                const raw = row[c.key];
                const text = raw == null || raw === "" ? "—" : String(raw);
                return (
                  <Text key={c.key} style={[s.td, colStyle(c)]}>{text}</Text>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Footer({ data, s }: { data: ReportPdfData; s: Styles }) {
  return (
    <View style={s.footer} fixed>
      <Text>{data.workspaceName} · {data.title}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      <Text>Generated {fmtDateTime(data.generatedAt)} by LogiTrak</Text>
    </View>
  );
}

function ReportDocument({ data }: { data: ReportPdfData }) {
  const theme = getPdfTheme(data.template);
  const s     = buildStyles(theme);
  return (
    <Document
      title={`${data.workspaceName} — ${data.title}`}
      author={data.generatedBy}
      creator="LogiTrak"
      producer="LogiTrak"
    >
      <Page size="A4" style={s.page} wrap>
        <Header data={data} theme={theme} s={s} />
        <Table  data={data} s={s} />
        <Footer data={data} s={s} />
      </Page>
    </Document>
  );
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Render the report and trigger a browser download.
 * Works client-side (react-pdf's pdf().toBlob() builds the document in the browser).
 */
export async function downloadReportPdf(data: ReportPdfData, filename: string): Promise<void> {
  const instance = pdf(<ReportDocument data={data} />);
  const blob     = await instance.toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
