/**
 * Cross-hire Invoice PDF.
 *
 * Lays out a tax-invoice-style document for a cross hire event:
 *   From: workspace (owner)        To: customer (production)
 *   Period dates · invoice #
 *   Line items: serial, description, days, daily rate, line total
 *   Totals: subtotal, optional VAT, total
 *   Optional payment terms + footer text
 *
 * Visual variant is controlled by the `template` field (modern/classic/minimal),
 * sourced from /settings/invoicing. See src/lib/pdf/PdfThemes.ts.
 */

import {
  Document, Page, Text, View, StyleSheet, Image, pdf,
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

function computeDays(startDate: Date | string, endDate: Date | string | null | undefined, totalDays: number | null | undefined): number {
  if (totalDays && totalDays > 0) return totalDays;
  if (endDate) {
    const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
    if (ms > 0) return Math.max(1, Math.ceil(ms / 86400000));
  }
  return 1;
}

// ── Theme-driven StyleSheet ───────────────────────────────────────────────

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

    partyRow:    { flexDirection: "row", gap: 24, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.greyMid, borderTopStyle: "solid" },
    partyBlock:  { flex: 1 },
    partyLabel:  { fontSize: font.metaSize - 1, color: colors.grey, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
    partyLine:   { fontSize: font.baseSize + 1, color: colors.surfaceDark, lineHeight: font.lineHeight },

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

    totalsBlock: { marginTop: 12, alignSelf: "flex-end", width: 240 },
    totalRow:    { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
    totalLabel:  { fontSize: font.baseSize, color: colors.grey },
    totalValue:  { fontSize: font.baseSize, color: colors.surfaceDark },
    grandRow:    { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.surfaceDark, borderTopStyle: "solid" },
    grandLabel:  { fontSize: font.baseSize + 2, fontWeight: 700, color: colors.surfaceDark },
    grandValue:  { fontSize: font.baseSize + 4, fontWeight: 700, color: colors.surfaceDark },

    notesTitle:  { fontSize: font.metaSize, color: colors.grey, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
    notesText:   { fontSize: font.baseSize, color: colors.grey, lineHeight: font.lineHeight },
    footerBlock: { fontSize: font.baseSize, color: colors.surfaceDark, lineHeight: font.lineHeight, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.greyMid, borderTopStyle: "solid", marginTop: spacing.section },

    pageFooter:  { position: "absolute", left: theme.page.paddingHorizontal, right: theme.page.paddingHorizontal, bottom: 24, flexDirection: "row", justifyContent: footer.align === "center" ? "center" : "space-between", fontSize: font.metaSize, color: colors.grey, paddingTop: 6, ...(footer.showBar && { borderTopWidth: 0.5, borderTopColor: colors.greyMid, borderTopStyle: "solid" as const }), fontStyle: footer.italic ? "italic" : "normal", gap: footer.align === "center" ? 8 : 0 },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface CrossHireInvoiceOwner {
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
  bankDetails?:  string | null;
  logoUrl?:      string | null;
}

type DecimalLike = { toString(): string } | number | string;

export interface CrossHireInvoiceItem {
  equipment:  { serial: string; name: string };
  dailyRate:  DecimalLike;
  weeklyRate: DecimalLike | null;
  notes:      string | null;
}

export interface CrossHireInvoiceData {
  workspaceName: string;
  owner?: CrossHireInvoiceOwner;
  /** VAT rate as decimal (0.2 for 20%). Omit/zero to suppress the VAT line. */
  vatRate?: number;
  /** Visual template — driven by /settings/invoicing. Defaults to modern. */
  template?: PdfTemplate;
  /** Free-text payment terms (e.g. "Net 30 from invoice date"). Falls back to "Net X days" when paymentTermsDays supplied. */
  paymentTermsText?: string | null;
  paymentTermsDays?: number | null;
  /** Free-text footer block printed below the totals. */
  invoiceFooter?: string | null;
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

function joinAddress(parts: Array<string | null | undefined>): string[] {
  return parts.map((p) => (p ?? "").trim()).filter((p) => p.length > 0);
}

// ── Document ──────────────────────────────────────────────────────────────

function InvoiceDocument({ data }: { data: CrossHireInvoiceData }) {
  const theme = getPdfTheme(data.template);
  const s     = buildStyles(theme);

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

  // Compute the "terms" display: prefer free-text, otherwise "Net X days"
  const termsLine =
    data.paymentTermsText?.trim()
      ? data.paymentTermsText.trim()
      : (data.paymentTermsDays != null ? `Net ${data.paymentTermsDays} days` : null);

  return (
    <Document
      title={`${ownerName} — Invoice — ${event.hireCustomer.productionName}`}
      creator="LogiTrak"
      producer="LogiTrak"
    >
      <Page size="A4" style={s.page} wrap>
        <View>
          {theme.header.showBar && <View style={s.headerBar} fixed />}
          <View style={s.brandRow}>
            {owner?.logoUrl
              ? <Image src={owner.logoUrl} style={{ height: theme.header.logoStyle === "inline" ? 16 : 24, maxWidth: 140, objectFit: "contain" }} />
              : <Text style={s.brandName}>{ownerName.toUpperCase()}</Text>}
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
            {termsLine && (
              <View>
                <Text style={s.metaLabel}>Payment terms</Text>
                <Text style={s.metaValue}>{termsLine}</Text>
              </View>
            )}
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
                {item.notes && <Text style={[s.td, { color: theme.colors.grey, fontSize: theme.font.metaSize }]}>{item.notes}</Text>}
                {item.lineDiscount > 0 && (
                  <Text style={[s.td, { color: theme.colors.grey, fontSize: theme.font.metaSize }]}>
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
            {vatRate != null && vatRate > 0 && (
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

        {owner?.bankDetails && (
          <View style={s.section}>
            <Text style={s.notesTitle}>Payment</Text>
            <Text style={s.notesText}>{owner.bankDetails}</Text>
          </View>
        )}

        {data.invoiceFooter && (
          <View style={s.footerBlock}>
            <Text style={s.notesText}>{data.invoiceFooter}</Text>
          </View>
        )}

        <View style={s.pageFooter} fixed>
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
