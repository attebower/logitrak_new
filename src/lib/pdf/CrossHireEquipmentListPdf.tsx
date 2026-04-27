/**
 * Cross-hire Equipment List PDF.
 *
 * Handover paperwork — lists every item attached to the cross hire event with
 * its serial, name, category, and rates. Same brand/style as ReportPdf.
 */

import {
  Document, Page, Text, View, StyleSheet, pdf,
} from "@react-pdf/renderer";

const BRAND = "#2563EB";
const SURFACE_DARK = "#0F172A";
const GREY = "#64748B";
const GREY_MID = "#CBD5E1";
const GREY_LIGHT = "#F1F5F9";

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtMoney(n: number | string | { toString(): string } | null | undefined): string {
  if (n == null) return "—";
  return `£${Number(n.toString()).toFixed(2)}`;
}

const s = StyleSheet.create({
  page:        { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 10, color: SURFACE_DARK, backgroundColor: "#FFFFFF" },
  headerBar:   { height: 4, backgroundColor: BRAND, marginBottom: 20 },
  brandRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  brandName:   { fontSize: 12, color: BRAND, fontWeight: 700, letterSpacing: 1.2 },
  documentKind:{ fontSize: 9, color: GREY, textTransform: "uppercase", letterSpacing: 1.2 },
  title:       { fontSize: 24, fontWeight: 700, marginTop: 4 },
  subtitle:    { fontSize: 12, color: GREY, marginTop: 4 },
  metaRow:     { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: GREY_MID, borderTopStyle: "solid" },
  metaLabel:   { fontSize: 8, color: GREY, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  metaValue:   { fontSize: 11, color: SURFACE_DARK },
  section:     { marginTop: 24 },
  sectionHeader:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: GREY_MID, borderBottomStyle: "solid" },
  sectionTitle:{ fontSize: 14, fontWeight: 700, color: SURFACE_DARK },
  sectionCount:{ fontSize: 10, color: GREY },
  tableHeader: { flexDirection: "row", backgroundColor: GREY_LIGHT, paddingVertical: 6, paddingHorizontal: 8 },
  tableRow:    { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: GREY_MID, borderBottomStyle: "solid" },
  th:          { fontSize: 9, color: GREY, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 },
  td:          { fontSize: 10, color: SURFACE_DARK },
  signRow:     { marginTop: 36, flexDirection: "row", gap: 24 },
  signBlock:   { flex: 1 },
  signLabel:   { fontSize: 9, color: GREY, textTransform: "uppercase", letterSpacing: 1, marginBottom: 28 },
  signLine:    { borderTopWidth: 0.5, borderTopColor: SURFACE_DARK, borderTopStyle: "solid", paddingTop: 4, fontSize: 9, color: GREY },
  footer:      { position: "absolute", left: 48, right: 48, bottom: 24, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: GREY, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: GREY_MID, borderTopStyle: "solid" },
});

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
  const generated = new Date();

  return (
    <Document
      title={`${workspaceName} — Equipment List — ${event.hireCustomer.productionName}`}
      creator="LogiTrak"
      producer="LogiTrak"
    >
      <Page size="A4" style={s.page} wrap>
        <View>
          <View style={s.headerBar} fixed />
          <View style={s.brandRow}>
            <Text style={s.brandName}>LOGITRAK</Text>
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
            <Text style={[s.td, { color: GREY }]}>{event.notes}</Text>
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
