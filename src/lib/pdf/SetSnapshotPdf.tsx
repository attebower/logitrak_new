/**
 * Set Snapshot PDF renderer.
 *
 * Matches LogiTrak's app branding:
 *   - Brand-blue accent (#2563EB)
 *   - Status colours (green / amber / red / teal) from the app palette
 *   - Inter-style sans typography (falls back to Helvetica — @react-pdf
 *     ships with this out of the box)
 *
 * Export: renderSetSnapshotPdf(data) → Promise<Buffer>
 */

import {
  Document, Page, Text, View, StyleSheet, Image, pdf,
} from "@react-pdf/renderer";
import { getPdfTheme, type PdfTemplate, type PdfTheme } from "./PdfThemes";

// Status colours stay consistent across templates (damaged is always red etc.)
const STATUS_GREEN = "#16A34A";
const STATUS_AMBER = "#D97706";
const STATUS_RED   = "#DC2626";
const STATUS_TEAL  = "#0D9488";

function statusColour(status: string, damageStatus: string | null | undefined, theme: PdfTheme): string {
  if (damageStatus === "damaged")      return STATUS_RED;
  if (damageStatus === "under_repair") return STATUS_AMBER;
  if (damageStatus === "repaired")     return STATUS_TEAL;
  if (status === "available")          return STATUS_GREEN;
  if (status === "checked_out")        return STATUS_AMBER;
  if (status === "retired")            return theme.colors.grey;
  return theme.colors.surfaceDark;
}

function statusLabel(status: string, damageStatus?: string | null): string {
  if (damageStatus && damageStatus !== "normal") {
    return damageStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (status === "checked_out") return "Issued";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}
function fmtDateTime(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Styles (theme-driven) ─────────────────────────────────────────────────

function buildStyles(theme: PdfTheme) {
  const { colors, page, font, spacing, table, footer } = theme;
  return StyleSheet.create({
    page: { paddingTop: page.paddingTop, paddingBottom: page.paddingBottom + 16, paddingHorizontal: page.paddingHorizontal, fontFamily: font.family, fontSize: font.baseSize, color: colors.surfaceDark, backgroundColor: "#FFFFFF" },
    headerBar: { height: theme.header.barHeight, backgroundColor: colors.brand, marginBottom: 20 },
    brandRow: { flexDirection: "row", alignItems: "center", justifyContent: theme.header.align === "center" ? "center" : "space-between", marginBottom: 6, gap: theme.header.align === "center" ? 12 : 0 },
    brandName: { fontSize: font.baseSize + 2, color: colors.brand, fontWeight: 700, letterSpacing: 1.2 },
    documentKind: { fontSize: font.metaSize, color: colors.grey, textTransform: "uppercase", letterSpacing: 1.2 },
    title: { fontSize: font.titleSize, fontWeight: 700, marginTop: 4, textAlign: theme.header.align },
    subtitle: { fontSize: font.baseSize + 2, color: colors.grey, marginTop: 4, textAlign: theme.header.align },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.greyMid, borderTopStyle: "solid" },
    metaLabel: { fontSize: font.metaSize - 1, color: colors.grey, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
    metaValue: { fontSize: font.baseSize + 1, color: colors.surfaceDark },
    section: { marginTop: spacing.section },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.greyMid, borderBottomStyle: "solid" },
    sectionTitle: { fontSize: font.baseSize + 4, fontWeight: 700, color: colors.surfaceDark, textTransform: table.headerCase === "upper" ? "uppercase" : "none", letterSpacing: table.headerCase === "upper" ? 1 : 0 },
    sectionCount: { fontSize: font.baseSize, color: colors.grey },
    tableHeader: { flexDirection: "row", backgroundColor: table.headerBackground, paddingVertical: spacing.row - 2, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: table.rowBorderColor, borderBottomStyle: "solid" },
    tableRow: { flexDirection: "row", paddingVertical: spacing.row - 2, paddingHorizontal: 8, ...(table.rowBorder !== "none" && { borderBottomWidth: 0.5, borderBottomColor: colors.greyMid, borderBottomStyle: "solid" as const }) },
    th: { fontSize: font.metaSize, color: table.headerColor, textTransform: table.headerCase === "upper" ? "uppercase" : "none", fontWeight: 700, letterSpacing: 0.5 },
    td: { fontSize: font.baseSize, color: colors.surfaceDark },
    colSerial:   { width: 70 },
    colName:     { flex: 1, paddingRight: 8 },
    colCategory: { width: 90 },
    colStatus:   { width: 80 },
    colUser:     { width: 90 },
    mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    mediaCard: { width: "48%", marginBottom: 12 },
    mediaImage: { width: "100%", height: 180, objectFit: "cover", borderWidth: 1, borderColor: colors.greyMid, borderStyle: "solid", borderRadius: 4 },
    mediaCaption: { fontSize: font.metaSize, color: colors.grey, marginTop: 4 },
    mediaTitle:   { fontSize: font.baseSize, fontWeight: 700, marginTop: 4 },
    layoutCard: { marginBottom: 16, borderWidth: 1, borderColor: colors.greyMid, borderStyle: "solid", borderRadius: 4, padding: 10 },
    layoutImage: { width: "100%", height: 300, objectFit: "contain", marginTop: 6 },
    damageCard: { borderLeftWidth: 3, borderLeftColor: STATUS_RED, borderLeftStyle: "solid", paddingLeft: 10, paddingVertical: 6, marginBottom: 12 },
    damageRepaired: { borderLeftColor: STATUS_TEAL },
    damageHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
    damageEquip:  { fontSize: font.baseSize + 1, fontWeight: 700 },
    damageWhen:   { fontSize: font.metaSize, color: colors.grey },
    damageBody:   { fontSize: font.baseSize, color: colors.surfaceDark, marginTop: 2 },
    damageMeta:   { fontSize: font.metaSize, color: colors.grey, marginTop: 3 },
    repairBlock:  { marginTop: 6, paddingTop: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: STATUS_TEAL, borderLeftStyle: "solid" },
    empty: { fontSize: font.baseSize, color: colors.grey, fontStyle: "italic", paddingVertical: 10 },
    footer: { position: "absolute", left: page.paddingHorizontal, right: page.paddingHorizontal, bottom: 24, flexDirection: "row", justifyContent: footer.align === "center" ? "center" : "space-between", fontSize: font.metaSize, color: colors.grey, paddingTop: 6, ...(footer.showBar && { borderTopWidth: 0.5, borderTopColor: colors.greyMid, borderTopStyle: "solid" as const }), fontStyle: footer.italic ? "italic" : "normal", gap: footer.align === "center" ? 8 : 0 },
  });
}

type Styles = ReturnType<typeof buildStyles>;

// ── Input types ───────────────────────────────────────────────────────────

export interface SnapshotData {
  project: {
    name: string;
    industryType: string;
    studioName: string | null;
    eventLocation: string | null;
  };
  set: {
    name: string;
    stageName: string;
    studioName: string;
    notes: string | null;
    onLocation: {
      name:        string;
      address:     string | null;
      description: string | null;
    } | null;
  };
  generatedBy: string;
  generatedAt: Date;
  equipment: Array<{
    serial: string;
    name: string;
    category: string | null;
    status: string;
    damageStatus: string | null;
    issuedTo: string | null;
    issuedAt: Date | string | null;
  }>;
  photos: Array<{
    dataUrl: string | null;
    caption: string | null;
    filename: string;
  }>;
  layouts: Array<{
    dataUrl: string | null;
    title: string | null;
    description: string | null;
    filename: string;
    isPdf: boolean;
  }>;
  damage: Array<{
    equipmentSerial: string;
    equipmentName: string;
    description: string;
    damageLocation: string | null;
    itemLocation: string | null;
    reportedBy: string;
    reportedAt: Date | string;
    repair: {
      description: string;
      repairedByName: string;
      repairedAt: Date | string | null;
    } | null;
  }>;
  /** Visual template — driven by /settings/documents. Defaults to modern. */
  template?: PdfTemplate;
}

// ── Components ────────────────────────────────────────────────────────────

interface CtxProps { s: Styles; theme: PdfTheme }

function Header({ data, s, theme }: { data: SnapshotData } & CtxProps) {
  const onLoc = data.set.onLocation;
  const projectLocation = data.project.studioName
    ?? data.project.eventLocation
    ?? "—";

  return (
    <View>
      {theme.header.showBar && <View style={s.headerBar} fixed />}
      <View style={s.brandRow}>
        <Text style={s.brandName}>LOGITRAK</Text>
        <Text style={s.documentKind}>Set Snapshot</Text>
      </View>
      <Text style={s.title}>{data.set.name}</Text>
      <Text style={s.subtitle}>
        {data.project.name} · {onLoc ? `On Location — ${onLoc.name}` : `${data.set.studioName} — ${data.set.stageName}`}
      </Text>

      <View style={s.metaRow}>
        <View>
          <Text style={s.metaLabel}>Project</Text>
          <Text style={s.metaValue}>{data.project.name}</Text>
        </View>
        {onLoc ? (
          <>
            <View>
              <Text style={s.metaLabel}>Location</Text>
              <Text style={s.metaValue}>{onLoc.name}</Text>
            </View>
            {onLoc.address && (
              <View>
                <Text style={s.metaLabel}>Where</Text>
                <Text style={s.metaValue}>{onLoc.address}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <View>
              <Text style={s.metaLabel}>{data.project.industryType === "events" ? "Event Location" : "Studio"}</Text>
              <Text style={s.metaValue}>{projectLocation}</Text>
            </View>
            <View>
              <Text style={s.metaLabel}>Stage</Text>
              <Text style={s.metaValue}>{data.set.stageName}</Text>
            </View>
          </>
        )}
        <View>
          <Text style={s.metaLabel}>Generated</Text>
          <Text style={s.metaValue}>{fmtDateTime(data.generatedAt)}</Text>
        </View>
        <View>
          <Text style={s.metaLabel}>By</Text>
          <Text style={s.metaValue}>{data.generatedBy}</Text>
        </View>
      </View>

      {onLoc?.description && (
        <View style={{ marginTop: 14 }}>
          <Text style={s.metaLabel}>Location Details</Text>
          <Text style={{ fontSize: theme.font.baseSize, marginTop: 2, color: theme.colors.surfaceDark }}>{onLoc.description}</Text>
        </View>
      )}

      {data.set.notes && (
        <View style={{ marginTop: 14 }}>
          <Text style={s.metaLabel}>Notes</Text>
          <Text style={{ fontSize: theme.font.baseSize, marginTop: 2, color: theme.colors.surfaceDark }}>{data.set.notes}</Text>
        </View>
      )}
    </View>
  );
}

function EquipmentSection({ data, s, theme }: { data: SnapshotData } & CtxProps) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Equipment on Set</Text>
        <Text style={s.sectionCount}>{data.equipment.length} item{data.equipment.length === 1 ? "" : "s"}</Text>
      </View>

      {data.equipment.length === 0 ? (
        <Text style={s.empty}>No equipment currently on this set.</Text>
      ) : (
        <View>
          <View style={s.tableHeader} fixed>
            <Text style={[s.th, s.colSerial]}>Serial</Text>
            <Text style={[s.th, s.colName]}>Name</Text>
            <Text style={[s.th, s.colCategory]}>Category</Text>
            <Text style={[s.th, s.colStatus]}>Status</Text>
            <Text style={[s.th, s.colUser]}>Issued To</Text>
          </View>
          {data.equipment.map((e, i) => (
            <View key={`${e.serial}-${i}`} style={s.tableRow} wrap={false}>
              <Text style={[s.td, s.colSerial, { fontWeight: 700 }]}>{e.serial}</Text>
              <Text style={[s.td, s.colName]}>{e.name}</Text>
              <Text style={[s.td, s.colCategory, { color: theme.colors.grey }]}>{e.category ?? "—"}</Text>
              <Text style={[s.td, s.colStatus, { color: statusColour(e.status, e.damageStatus, theme), fontWeight: 700 }]}>
                {statusLabel(e.status, e.damageStatus)}
              </Text>
              <Text style={[s.td, s.colUser, { color: theme.colors.grey }]}>{e.issuedTo ?? "—"}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function PhotosSection({ data, s, theme }: { data: SnapshotData } & CtxProps) {
  return (
    <View style={s.section} break={data.equipment.length > 15}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Photos</Text>
        <Text style={s.sectionCount}>{data.photos.length} image{data.photos.length === 1 ? "" : "s"}</Text>
      </View>
      {data.photos.length === 0 ? (
        <Text style={s.empty}>No photos uploaded for this set.</Text>
      ) : (
        <View style={s.mediaGrid}>
          {data.photos.map((p, i) => (
            <View key={i} style={s.mediaCard} wrap={false}>
              {p.dataUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={p.dataUrl} style={s.mediaImage} />
              ) : (
                <View style={[s.mediaImage, { backgroundColor: theme.colors.greyLight, alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ fontSize: theme.font.metaSize, color: theme.colors.grey }}>Preview unavailable</Text>
                </View>
              )}
              {p.caption && <Text style={s.mediaCaption}>{p.caption}</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function LayoutsSection({ data, s }: { data: SnapshotData } & CtxProps) {
  return (
    <View style={s.section} break>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Lighting Layouts</Text>
        <Text style={s.sectionCount}>{data.layouts.length} file{data.layouts.length === 1 ? "" : "s"}</Text>
      </View>
      {data.layouts.length === 0 ? (
        <Text style={s.empty}>No lighting layouts uploaded for this set.</Text>
      ) : (
        <View>
          {data.layouts.map((l, i) => (
            <View key={i} style={s.layoutCard} wrap={false}>
              <Text style={s.mediaTitle}>{l.title ?? l.filename}</Text>
              {l.description && <Text style={s.mediaCaption}>{l.description}</Text>}
              {l.isPdf ? (
                <Text style={[s.mediaCaption, { marginTop: 6 }]}>
                  PDF attachment: {l.filename} (download from LogiTrak for full drawing)
                </Text>
              ) : l.dataUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={l.dataUrl} style={s.layoutImage} />
              ) : (
                <Text style={[s.mediaCaption, { marginTop: 6 }]}>Preview unavailable.</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function DamageSection({ data, s, theme }: { data: SnapshotData } & CtxProps) {
  return (
    <View style={s.section} break>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Damage & Repairs</Text>
        <Text style={s.sectionCount}>{data.damage.length} report{data.damage.length === 1 ? "" : "s"}</Text>
      </View>
      {data.damage.length === 0 ? (
        <Text style={s.empty}>No damage reported for equipment on this set.</Text>
      ) : (
        data.damage.map((d, i) => (
          <View key={i} style={[s.damageCard, d.repair ? s.damageRepaired : {}]} wrap={false}>
            <View style={s.damageHeader}>
              <Text style={s.damageEquip}>
                {d.equipmentName} <Text style={{ color: theme.colors.grey }}>· {d.equipmentSerial}</Text>
              </Text>
              <Text style={s.damageWhen}>{fmtDate(d.reportedAt)}</Text>
            </View>
            <Text style={s.damageBody}>{d.description}</Text>
            <Text style={s.damageMeta}>
              Reported by {d.reportedBy}
              {d.itemLocation   ? ` · On item: ${d.itemLocation}` : ""}
              {d.damageLocation ? ` · On set: ${d.damageLocation}` : ""}
            </Text>
            {d.repair && (
              <View style={s.repairBlock}>
                <Text style={{ fontSize: theme.font.baseSize, fontWeight: 700, color: STATUS_TEAL }}>
                  Repaired · {fmtDate(d.repair.repairedAt)}
                </Text>
                <Text style={[s.damageBody, { marginTop: 2 }]}>{d.repair.description}</Text>
                <Text style={s.damageMeta}>By {d.repair.repairedByName}</Text>
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );
}

function Footer({ data, s }: { data: SnapshotData } & CtxProps) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {data.project.name} · {data.set.name}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      <Text>
        Generated {fmtDateTime(data.generatedAt)} by LogiTrak
      </Text>
    </View>
  );
}

function SnapshotDocument({ data }: { data: SnapshotData }) {
  const theme = getPdfTheme(data.template);
  const s     = buildStyles(theme);
  const ctx: CtxProps = { s, theme };
  return (
    <Document
      title={`${data.project.name} — ${data.set.name} snapshot`}
      author={data.generatedBy}
      creator="LogiTrak"
      producer="LogiTrak"
    >
      <Page size="A4" style={s.page} wrap>
        <Header           data={data} {...ctx} />
        <EquipmentSection data={data} {...ctx} />
        <PhotosSection    data={data} {...ctx} />
        <LayoutsSection   data={data} {...ctx} />
        <DamageSection    data={data} {...ctx} />
        <Footer           data={data} {...ctx} />
      </Page>
    </Document>
  );
}

// ── Public API ────────────────────────────────────────────────────────────

export async function renderSetSnapshotPdf(data: SnapshotData): Promise<Buffer> {
  const instance = pdf(<SnapshotDocument data={data} />);
  const blob     = await instance.toBlob();
  return Buffer.from(await blob.arrayBuffer());
}
