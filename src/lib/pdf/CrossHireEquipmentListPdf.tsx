/**
 * Cross-hire Equipment List PDF.
 *
 * Handover paperwork — lists every item attached to the cross hire event with
 * its serial, name, category, and rates. Same brand/style as ReportPdf.
 */

import {
  Document, Page, Text, View, StyleSheet, pdf,
} from "@react-pdf/renderer";
import { getPdfTheme, type PdfTemplate, type PdfTheme } from "./PdfThemes";

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtMoney(n: number | string | { toString(): string } | null | undefined): string {
  if (n == null) return "—";
  return `£${Number(n.toString()).toFixed(2)}`;
}

function buildStyles(theme: PdfTheme) {
  const { colors, page, font, spacing, table, footer } = theme;
  return StyleSheet.create({
    page:        { paddingTop: page.paddingTop, paddingBottom: page.paddingBottom + 16, paddingHorizontal: page.paddingHorizontal, fontFamily: font.family, fontSize: font.baseSize, color: colors.surfaceDark, backgroundColor: "#FFFFFF" },
    headerBar:   { height: theme.header.barHeight, backgroundColor: colors.brand, marginBottom: 20 },
    brandRow:    { flexDirection: "row", alignItems: "center", justifyContent: theme.header.align === "center" ? "center" : "space-between", marginBottom: 6, gap: theme.header.align === "center" ? 12 : 0 },
    brandName:   { fontSize: font.baseSize + 2, color: colors.brand, fontWeight: 700, letterSpacing: 1.2 },
    documentKind:{ fontSize: font.metaSize, color: colors.grey, textTransform: "uppercase", letterSpacing: 1.2 },
    title:       { fontSize: font.titleSize, fontWeight: 700, marginTop: 4, textAlign: theme.header.align },
    subtitle:    { fontSize: font.baseSize + 2, color: colors.grey, marginTop: 4, textAlign: theme.header.align },
    metaRow:     { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.greyMid, borderTopStyle: "solid" },
    metaLabel:   { fontSize: font.metaSize - 1, color: colors.grey, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
    metaValue:   { fontSize: font.baseSize + 1, color: colors.surfaceDark },
    section:     { marginTop: spacing.section },
    sectionHeader:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.greyMid, borderBottomStyle: "solid" },
    sectionTitle:{ fontSize: font.baseSize + 4, fontWeight: 700, color: colors.surfaceDark, textTransform: table.headerCase === "upper" ? "uppercase" : "none", letterSpacing: table.headerCase === "upper" ? 1 : 0 },
    sectionCount:{ fontSize: font.baseSize, color: colors.grey },
    tableHeader: { flexDirection: "row", backgroundColor: table.headerBackground, paddingVertical: spacing.row - 2, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: table.rowBorderColor, borderBottomStyle: "solid" },
    tableRow:    { flexDirection: "row", paddingVertical: spacing.row - 2, paddingHorizontal: 8, ...(table.rowBorder !== "none" && { borderBottomWidth: 0.5, borderBottomColor: colors.greyMid, borderBottomStyle: "solid" as const }) },
    th:          { fontSize: font.metaSize, color: table.headerColor, textTransform: table.headerCase === "upper" ? "uppercase" : "none", fontWeight: 700, letterSpacing: 0.5 },
    td:          { fontSize: font.baseSize, color: colors.surfaceDark },
    signRow:     { marginTop: 36, flexDirection: "row", gap: 24 },
    signBlock:   { flex: 1 },
    signLabel:   { fontSize: font.metaSize, color: colors.grey, textTransform: "uppercase", letterSpacing: 1, marginBottom: 28 },
    signLine:    { borderTopWidth: 0.5, borderTopColor: colors.surfaceDark, borderTopStyle: "solid", paddingTop: 4, fontSize: font.metaSize, color: colors.grey },
    footer:      { position: "absolute", left: page.paddingHorizontal, right: page.paddingHorizontal, bottom: 24, flexDirection: "row", justifyContent: footer.align === "center" ? "center" : "space-between", fontSize: font.metaSize, color: colors.grey, paddingTop: 6, ...(footer.showBar && { borderTopWidth: 0.5, borderTopColor: colors.greyMid, borderTopStyle: "solid" as const }), fontStyle: footer.italic ? "italic" : "normal", gap: footer.align === "center" ? 8 : 0 },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────

type DecimalLike = { toString(): string } | number | string;

export interface CrossHireEquipmentListItem {
  equipment:  { serial: string; name: string; category: { name: string } | null };
  dailyRate:  DecimalLike;
  weeklyRate: DecimalLike | null;
  notes:      string | null;
  returnedAt: Date | string | null;
}
export interface CrossHireEquipmentListData {
  workspaceName: string;
  /** Visual template — driven by /settings/documents. Defaults to modern. */
  template?: PdfTemplate;
  event: {
    id:             string;
    startDate:      Date | string;
    endDate:        Date | string | null;
    termsOfHire:    string;
    notes:          string | null;
    hireCustomer: {
      productionName: string;
      contactName:    string | null;
      contactPhone:   string | null;
    };
    equipmentItems: CrossHireEquipmentListItem[];
  };
}

// ── Document ──────────────────────────────────────────────────────────────

function EquipmentListDocument({ data }: { data: CrossHireEquipmentListData }) {
  const { workspaceName, event } = data;
  const theme = getPdfTheme(data.template);
  const s     = buildStyles(theme);
  const generated = new Date();

  return (
    <Document
      title={`${workspaceName} — Equipment List — ${event.hireCustomer.productionName}`}
      creator="LogiTrak"
      producer="LogiTrak"
    >
      <Page size="A4" style={s.page} wrap>
        <View>
          {theme.header.showBar && <View style={s.headerBar} fixed />}
          <View style={s.brandRow}>
            <Text style={s.brandName}>{workspaceName.toUpperCase()}</Text>
            <Text style={s.documentKind}>Equipment List</Text>
          </View>
          <Text style={s.title}>{event.hireCustomer.productionName}</Text>
          <Text style={s.subtitle}>Cross-hire equipment handover</Text>

          <View style={s.metaRow}>
            <View>
              <Text style={s.metaLabel}>From</Text>
              <Text style={s.metaValue}>{workspaceName}</Text>
            </View>
            <View>
              <Text style={s.metaLabel}>To</Text>
              <Text style={s.metaValue}>{event.hireCustomer.productionName}</Text>
              {event.hireCustomer.contactName && <Text style={s.metaValue}>{event.hireCustomer.contactName}</Text>}
              {event.hireCustomer.contactPhone && <Text style={s.metaValue}>{event.hireCustomer.contactPhone}</Text>}
            </View>
            <View>
              <Text style={s.metaLabel}>Start</Text>
              <Text style={s.metaValue}>{fmtDate(event.startDate)}</Text>
            </View>
            <View>
              <Text style={s.metaLabel}>Due back</Text>
              <Text style={s.metaValue}>{fmtDate(event.endDate)}</Text>
            </View>
            <View>
              <Text style={s.metaLabel}>Terms</Text>
              <Text style={s.metaValue}>{event.termsOfHire.replace(/\s*\([^)]*\)$/, "")}</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Items</Text>
            <Text style={s.sectionCount}>{event.equipmentItems.length} {event.equipmentItems.length === 1 ? "item" : "items"}</Text>
          </View>

          <View style={s.tableHeader} fixed>
            <Text style={[s.th, { width: 70 }]}>Serial</Text>
            <Text style={[s.th, { flex: 2 }]}>Name</Text>
            <Text style={[s.th, { flex: 1 }]}>Category</Text>
            <Text style={[s.th, { width: 70, textAlign: "right" }]}>Daily</Text>
            <Text style={[s.th, { width: 80, textAlign: "right" }]}>Weekly disc.</Text>
            <Text style={[s.th, { flex: 1.5 }]}>Notes</Text>
          </View>

          {event.equipmentItems.map((item, i) => (
            <View key={i} style={s.tableRow} wrap={false}>
              <Text style={[s.td, { width: 70, fontFamily: "Courier", fontWeight: 700 }]}>{item.equipment.serial}</Text>
              <Text style={[s.td, { flex: 2 }]}>{item.equipment.name}</Text>
              <Text style={[s.td, { flex: 1 }]}>{item.equipment.category?.name ?? "—"}</Text>
              <Text style={[s.td, { width: 70, textAlign: "right" }]}>{fmtMoney(item.dailyRate)}</Text>
              <Text style={[s.td, { width: 80, textAlign: "right" }]}>
                {item.weeklyRate != null ? `${Number(item.weeklyRate.toString()).toFixed(1)}%` : "—"}
              </Text>
              <Text style={[s.td, { flex: 1.5 }]}>{item.notes ?? "—"}</Text>
            </View>
          ))}
        </View>

        {event.notes && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Notes</Text>
            </View>
            <Text style={[s.td, { color: theme.colors.grey }]}>{event.notes}</Text>
          </View>
        )}

        <View style={s.signRow}>
          <View style={s.signBlock}>
            <Text style={s.signLabel}>Released by</Text>
            <Text style={s.signLine}>Name / Signature / Date</Text>
          </View>
          <View style={s.signBlock}>
            <Text style={s.signLabel}>Received by</Text>
            <Text style={s.signLine}>Name / Signature / Date</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>{workspaceName} · Equipment List · {event.hireCustomer.productionName}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          <Text>Generated {fmtDate(generated)}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Public API ────────────────────────────────────────────────────────────

export async function downloadCrossHireEquipmentListPdf(
  data: CrossHireEquipmentListData,
  filename: string,
): Promise<void> {
  const instance = pdf(<EquipmentListDocument data={data} />);
  const blob = await instance.toBlob();
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
