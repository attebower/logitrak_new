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

// ── Palette (mirrors SetSnapshotPdf / Tailwind config) ───────────────────

const BRAND = "#2563EB";
const SURFACE_DARK = "#0F172A";
const GREY = "#64748B";
const GREY_MID = "#CBD5E1";
const GREY_LIGHT = "#F1F5F9";

function fmtDateTime(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Styles (mirrors SetSnapshotPdf) ───────────────────────────────────────

const s = StyleSheet.create({
  page: {
    paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48,
    fontFamily: "Helvetica", fontSize: 10, color: SURFACE_DARK,
    backgroundColor: "#FFFFFF",
  },
  headerBar:    { height: 4, backgroundColor: BRAND, marginBottom: 20 },
  brandRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  brandName:    { fontSize: 12, color: BRAND, fontWeight: 700, letterSpacing: 1.2 },
  documentKind: { fontSize: 9, color: GREY, textTransform: "uppercase", letterSpacing: 1.2 },
  title:        { fontSize: 24, fontWeight: 700, marginTop: 4 },
  subtitle:     { fontSize: 12, color: GREY, marginTop: 4 },

  metaRow: {
    flexDirection: "row", flexWrap: "wrap",
    gap: 16, marginTop: 18, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: GREY_MID, borderTopStyle: "solid",
  },
  metaLabel: { fontSize: 8, color: GREY, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  metaValue: { fontSize: 11, color: SURFACE_DARK },

  section:       { marginTop: 24 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 10, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: GREY_MID, borderBottomStyle: "solid",
  },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: SURFACE_DARK },
  sectionCount: { fontSize: 10, color: GREY },

  tableHeader: {
    flexDirection: "row", backgroundColor: GREY_LIGHT,
    paddingVertical: 6, paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8,
    borderBottomWidth: 0.5, borderBottomColor: GREY_MID, borderBottomStyle: "solid",
  },
  th: { fontSize: 9, color: GREY, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 },
  td: { fontSize: 10, color: SURFACE_DARK },

  empty: { fontSize: 10, color: GREY, fontStyle: "italic", paddingVertical: 10 },

  footer: {
    position: "absolute", left: 48, right: 48, bottom: 24,
    flexDirection: "row", justifyContent: "space-between",
    fontSize: 8, color: GREY,
    paddingTop: 6,
    borderTopWidth: 0.5, borderTopColor: GREY_MID, borderTopStyle: "solid",
  },
});

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
  columns: ReportPdfColumn[];
  rows:    Record<string, unknown>[];
}

// ── Components ────────────────────────────────────────────────────────────

function Header({ data }: { data: ReportPdfData }) {
  return (
    <View>
      <View style={s.headerBar} fixed />
      <View style={s.brandRow}>
        <Text style={s.brandName}>LOGITRAK</Text>
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

function Table({ data }: { data: ReportPdfData }) {
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

function Footer({ data }: { data: ReportPdfData }) {
  return (
    <View style={s.footer} fixed>
      <Text>{data.workspaceName} · {data.title}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      <Text>Generated {fmtDateTime(data.generatedAt)} by LogiTrak</Text>
    </View>
  );
}

function ReportDocument({ data }: { data: ReportPdfData }) {
  return (
    <Document
      title={`${data.workspaceName} — ${data.title}`}
      author={data.generatedBy}
      creator="LogiTrak"
      producer="LogiTrak"
    >
      <Page size="A4" style={s.page} wrap>
        <Header data={data} />
        <Table data={data} />
        <Footer data={data} />
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
