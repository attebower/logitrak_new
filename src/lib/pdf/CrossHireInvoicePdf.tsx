/**
 * Cross-hire Invoice PDF.
 *
 * Lays out a tax-invoice-style document for a cross hire event:
 *   From: workspace (owner)        To: customer (production)
 *   Period dates · invoice #
 *   Line items: serial, description, days, daily rate, line total
 *   Totals: subtotal, optional VAT, total
 *
 * Note: workspace currently only stores `name`. Owner address/VAT/contact
 * fields are not yet on the schema — when added (Workspace settings page),
 * pass them through `owner` here and they'll render in the From block.
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

// Days helper — prefer event.totalDays, fall back to (end - start), else 1.
function computeDays(startDate: Date | string, endDate: Date | string | null | undefined, totalDays: number | null | undefined): number {
  if (totalDays && totalDays > 0) return totalDays;
  if (endDate) {
    const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
    if (ms > 0) return Math.max(1, Math.ceil(ms / 86400000));
  }
  return 1;
}

const s = StyleSheet.create({
  page:        { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 10, color: SURFACE_DARK, backgroundColor: "#FFFFFF" },
  headerBar:   { height: 4, backgroundColor: BRAND, marginBottom: 20 },
  brandRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  brandName:   { fontSize: 12, color: BRAND, fontWeight: 700, letterSpacing: 1.2 },
  documentKind:{ fontSize: 9, color: GREY, textTransform: "uppercase", letterSpacing: 1.2 },
  title:       { fontSize: 24, fontWeight: 700, marginTop: 4 },
  subtitle:    { fontSize: 12, color: GREY, marginTop: 4 },

  partyRow:    { flexDirection: "row", gap: 24, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: GREY_MID, borderTopStyle: "solid" },
  partyBlock:  { flex: 1 },
  partyLabel:  { fontSize: 8, color: GREY, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  partyLine:   { fontSize: 11, color: SURFACE_DARK, lineHeight: 1.4 },

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

  totalsBlock: { marginTop: 12, alignSelf: "flex-end", width: 240 },
  totalRow:    { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalLabel:  { fontSize: 10, color: GREY },
  totalValue:  { fontSize: 10, color: SURFACE_DARK },
  grandRow:    { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: SURFACE_DARK, borderTopStyle: "solid" },
  grandLabel:  { fontSize: 12, fontWeight: 700, color: SURFACE_DARK },
  grandValue:  { fontSize: 14, fontWeight: 700, color: SURFACE_DARK },

  notesTitle:  { fontSize: 9, color: GREY, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  notesText:   { fontSize: 10, color: GREY },

  footer:      { position: "absolute", left: 48, right: 48, bottom: 24, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: GREY, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: GREY_MID, borderTopStyle: "solid" },
});

// ── Types ─────────────────────────────────────────────────────────────────

export interface CrossHireInvoiceOwner {
  /** Required — falls back to workspaceName if absent */
  businessName?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?:         string | null;
  county?:       string | null;
  postcode?:     string | null;
  country?:      string | null;
  vatNumber?:    string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

/** Numeric coming back from Prisma can be `Decimal | number | string`. */
type DecimalLike = { toString(): string } | number | string;

export interface CrossHireInvoiceItem {
  equipment:  { serial: string; name: string };
  dailyRate:  DecimalLike;
  weeklyRate: DecimalLike | null;
  notes:      string | null;
}

export interface CrossHireInvoiceData {
  workspaceName: string;
  /** Optional richer owner block (when workspace settings start storing this). */
  owner?: CrossHireInvoiceOwner;
  /** Optional VAT rate (e.g. 0.2 for 20%). When undefined, no VAT line is shown. */
  vatRate?: number;
  event: {
    id:             string;
    invoiceNumber:  string | null;
    startDate:      Date | string;
    endDate:        Date | string | null;
    totalDays:      number | null;
    termsOfHire:    string;
    notes:          string | null;
    hireCustomer: {
      productionName: string;
      vatNumber:      string | null;
      contactName:    string | null;
      contactEmail:   string | null;
      contactPhone:   string | null;
      addressLine1:   string | null;
      addressLine2:   string | null;
      city:           string | null;
      county:         string | null;
      postcode:       string | null;
      country:        string | null;
    };
    equipmentItems: CrossHireInvoiceItem[];
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function joinAddress(parts: Array<string | null | undefined>): string[] {
  return parts.map((p) => (p ?? "").trim()).filter((p) => p.length > 0);
}

// ── Document ──────────────────────────────────────────────────────────────

function InvoiceDocument({ data }: { data: CrossHireInvoiceData }) {
  const { workspaceName, owner, event, vatRate } = data;
  const generated = new Date();

  const days = computeDays(event.startDate, event.endDate, event.totalDays);
  const lineItems = event.equipmentItems.map((item) => {
    const daily        = Number(item.dailyRate.toString());
    const gross        = daily * days;
    const discountPct  = item.weeklyRate != null ? Number(item.weeklyRate.toString()) : 0;
    const applyDiscount = days >= 7 && discountPct > 0;
    const lineDiscount = applyDiscount ? gross * (discountPct / 100) : 0;
    const subtotal     = gross - lineDiscount;
    return { ...item, daily, days, gross, discountPct, lineDiscount, subtotal };
  });
  const grossTotal     = lineItems.reduce((sum, l) => sum + l.gross,        0);
  const discountTotal  = lineItems.reduce((sum, l) => sum + l.lineDiscount, 0);
  const subtotal       = grossTotal - discountTotal;
  const vat            = vatRate ? subtotal * vatRate : 0;
  const total          = subtotal + vat;

  const ownerName    = owner?.businessName?.trim() || workspaceName;
  const ownerAddress = joinAddress([owner?.addressLine1, owner?.addressLine2, owner?.city, owner?.county, owner?.postcode, owner?.country]);

  const customerAddress = joinAddress([
    event.hireCustomer.addressLine1, event.hireCustomer.addressLine2,
    event.hireCustomer.city, event.hireCustomer.county,
    event.hireCustomer.postcode, event.hireCustomer.country,
  ]);

  const invoiceNo = event.invoiceNumber ?? event.id.slice(-8).toUpperCase();

  return (
    <Document
      title={`${ownerName} — Invoice — ${event.hireCustomer.productionName}`}
      creator="LogiTrak"
      producer="LogiTrak"
    >
      <Page size="A4" style={s.page} wrap>
        <View>
          <View style={s.headerBar} fixed />
          <View style={s.brandRow}>
            <Text style={s.brandName}>LOGITRAK</Text>
            <Text style={s.documentKind}>Invoice</Text>
          </View>
          <Text style={s.title}>Invoice #{invoiceNo}</Text>
          <Text style={s.subtitle}>{event.hireCustomer.productionName}</Text>

          <View style={s.partyRow}>
            <View style={s.partyBlock}>
              <Text style={s.partyLabel}>From</Text>
              <Text style={[s.partyLine, { fontWeight: 700 }]}>{ownerName}</Text>
              {ownerAddress.map((line, i) => <Text key={i} style={s.partyLine}>{line}</Text>)}
              {owner?.contactPhone && <Text style={s.partyLine}>{owner.contactPhone}</Text>}
              {owner?.contactEmail && <Text style={s.partyLine}>{owner.contactEmail}</Text>}
              {owner?.vatNumber    && <Text style={s.partyLine}>VAT: {owner.vatNumber}</Text>}
            </View>
            <View style={s.partyBlock}>
              <Text style={s.partyLabel}>To</Text>
              <Text style={[s.partyLine, { fontWeight: 700 }]}>{event.hireCustomer.productionName}</Text>
              {event.hireCustomer.contactName && <Text style={s.partyLine}>{event.hireCustomer.contactName}</Text>}
              {customerAddress.map((line, i) => <Text key={i} style={s.partyLine}>{line}</Text>)}
              {event.hireCustomer.contactPhone && <Text style={s.partyLine}>{event.hireCustomer.contactPhone}</Text>}
              {event.hireCustomer.contactEmail && <Text style={s.partyLine}>{event.hireCustomer.contactEmail}</Text>}
              {event.hireCustomer.vatNumber    && <Text style={s.partyLine}>VAT: {event.hireCustomer.vatNumber}</Text>}
            </View>
          </View>

          <View style={s.metaRow}>
            <View>
              <Text style={s.metaLabel}>Invoice #</Text>
              <Text style={s.metaValue}>{invoiceNo}</Text>
            </View>
            <View>
              <Text style={s.metaLabel}>Issued</Text>
              <Text style={s.metaValue}>{fmtDate(generated)}</Text>
            </View>
            <View>
              <Text style={s.metaLabel}>Period</Text>
              <Text style={s.metaValue}>{fmtDate(event.startDate)}{event.endDate ? ` — ${fmtDate(event.endDate)}` : ""}</Text>
            </View>
            <View>
              <Text style={s.metaLabel}>Days</Text>
              <Text style={s.metaValue}>{days}</Text>
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
            <Text style={s.sectionCount}>{lineItems.length} {lineItems.length === 1 ? "line" : "lines"}</Text>
          </View>

          <View style={s.tableHeader} fixed>
            <Text style={[s.th, { width: 70 }]}>Serial</Text>
            <Text style={[s.th, { flex: 2 }]}>Description</Text>
            <Text style={[s.th, { width: 50, textAlign: "right" }]}>Days</Text>
            <Text style={[s.th, { width: 70, textAlign: "right" }]}>Rate</Text>
            <Text style={[s.th, { width: 80, textAlign: "right" }]}>Amount</Text>
          </View>

          {lineItems.map((item, i) => (
            <View key={i} style={s.tableRow} wrap={false}>
              <Text style={[s.td, { width: 70, fontFamily: "Courier", fontWeight: 700 }]}>{item.equipment.serial}</Text>
              <View style={{ flex: 2 }}>
                <Text style={s.td}>{item.equipment.name}</Text>
                {item.notes && <Text style={[s.td, { color: GREY, fontSize: 9 }]}>{item.notes}</Text>}
                {item.lineDiscount > 0 && (
                  <Text style={[s.td, { color: GREY, fontSize: 9 }]}>
                    {item.discountPct.toFixed(1)}% weekly discount (−{fmtMoney(item.lineDiscount)})
                  </Text>
                )}
              </View>
              <Text style={[s.td, { width: 50, textAlign: "right" }]}>{item.days}</Text>
              <Text style={[s.td, { width: 70, textAlign: "right" }]}>{fmtMoney(item.daily)}/day</Text>
              <Text style={[s.td, { width: 80, textAlign: "right", fontWeight: 700 }]}>{fmtMoney(item.subtotal)}</Text>
            </View>
          ))}

          <View style={s.totalsBlock}>
            {discountTotal > 0 && (
              <>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Gross</Text>
                  <Text style={s.totalValue}>{fmtMoney(grossTotal)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Weekly discount</Text>
                  <Text style={s.totalValue}>−{fmtMoney(discountTotal)}</Text>
                </View>
              </>
            )}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>{fmtMoney(subtotal)}</Text>
            </View>
            {vatRate != null && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>VAT ({Math.round(vatRate * 100)}%)</Text>
                <Text style={s.totalValue}>{fmtMoney(vat)}</Text>
              </View>
            )}
            <View style={s.grandRow}>
              <Text style={s.grandLabel}>Total</Text>
              <Text style={s.grandValue}>{fmtMoney(total)}</Text>
            </View>
          </View>
        </View>

        {event.notes && (
          <View style={s.section}>
            <Text style={s.notesTitle}>Notes</Text>
            <Text style={s.notesText}>{event.notes}</Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>{ownerName} · Invoice #{invoiceNo}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          <Text>Generated {fmtDate(generated)}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Public API ────────────────────────────────────────────────────────────

export async function downloadCrossHireInvoicePdf(
  data: CrossHireInvoiceData,
  filename: string,
): Promise<void> {
  const instance = pdf(<InvoiceDocument data={data} />);
  const blob = await instance.toBlob();
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
