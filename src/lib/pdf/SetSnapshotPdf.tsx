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

// ── Palette (mirrors Tailwind config) ─────────────────────────────────────

const BRAND = "#2563EB";         // brand-blue
const SURFACE_DARK = "#0F172A";  // slate-900-ish
const GREY = "#64748B";          // slate-500
const GREY_MID = "#CBD5E1";      // slate-300
const GREY_LIGHT = "#F1F5F9";    // slate-100
const STATUS_GREEN = "#16A34A";
const STATUS_AMBER = "#D97706";
const STATUS_RED   = "#DC2626";
const STATUS_TEAL  = "#0D9488";

function statusColour(status: string, damageStatus?: string | null): string {
  if (damageStatus === "damaged")      return STATUS_RED;
  if (damageStatus === "under_repair") return STATUS_AMBER;
  if (damageStatus === "repaired")     return STATUS_TEAL;
  if (status === "available")          return STATUS_GREEN;
  if (status === "checked_out")        return STATUS_AMBER;
  if (status === "retired")            return GREY;
  return SURFACE_DARK;
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

// ── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48,
    fontFamily: "Helvetica", fontSize: 10, color: SURFACE_DARK,
    backgroundColor: "#FFFFFF",
  },
  // Header
  headerBar: {
    height: 4, backgroundColor: BRAND, marginBottom: 20,
  },
  brandRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 6,
  },
  brandName: { fontSize: 12, color: BRAND, fontWeight: 700, letterSpacing: 1.2 },
  documentKind: { fontSize: 9, color: GREY, textTransform: "uppercase", letterSpacing: 1.2 },
  title: { fontSize: 24, fontWeight: 700, marginTop: 4 },
  subtitle: { fontSize: 12, color: GREY, marginTop: 4 },
  metaRow: {
    flexDirection: "row", flexWrap: "wrap",
    gap: 16, marginTop: 18, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: GREY_MID,
    borderTopStyle: "solid",
  },
  metaLabel: { fontSize: 8, color: GREY, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  metaValue: { fontSize: 11, color: SURFACE_DARK },

  // Section
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 10, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: GREY_MID, borderBottomStyle: "solid",
  },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: SURFACE_DARK },
  sectionCount: { fontSize: 10, color: GREY },

  // Equipment table
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
  colSerial:   { width: 70 },
  colName:     { flex: 1, paddingRight: 8 },
  colCategory: { width: 90 },
  colStatus:   { width: 80 },
  colUser:     { width: 90 },

  // Photos / Layouts
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  mediaCard: { width: "48%", marginBottom: 12 },
  mediaImage: {
    width: "100%", height: 180, objectFit: "cover",
    borderWidth: 1, borderColor: GREY_MID, borderStyle: "solid",
    borderRadius: 4,
  },
  mediaCaption: { fontSize: 9, color: GREY, marginTop: 4 },
  mediaTitle:   { fontSize: 10, fontWeight: 700, marginTop: 4 },

  layoutCard: {
    marginBottom: 16,
    borderWidth: 1, borderColor: GREY_MID, borderStyle: "solid",
    borderRadius: 4, padding: 10,
  },
  layoutImage: {
    width: "100%", height: 300, objectFit: "contain",
    marginTop: 6,
  },

  // Damage
  damageCard: {
    borderLeftWidth: 3, borderLeftColor: STATUS_RED, borderLeftStyle: "solid",
    paddingLeft: 10, paddingVertical: 6, marginBottom: 12,
  },
  damageRepaired: {
    borderLeftColor: STATUS_TEAL,
  },
  damageHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  damageEquip:  { fontSize: 11, fontWeight: 700 },
  damageWhen:   { fontSize: 9, color: GREY },
  damageBody:   { fontSize: 10, color: SURFACE_DARK, marginTop: 2 },
  damageMeta:   { fontSize: 9, color: GREY, marginTop: 3 },
  repairBlock:  {
    marginTop: 6, paddingTop: 6, paddingLeft: 8,
    borderLeftWidth: 2, borderLeftColor: STATUS_TEAL, borderLeftStyle: "solid",
  },

  // Empty state
  empty: {
    fontSize: 10, color: GREY, fontStyle: "italic",
    paddingVertical: 10,
  },

  // Footer
  footer: {
    position: "absolute", left: 48, right: 48, bottom: 24,
    flexDirection: "row", justifyContent: "space-between",
    fontSize: 8, color: GREY,
    paddingTop: 6,
    borderTopWidth: 0.5, borderTopColor: GREY_MID, borderTopStyle: "solid",
  },
});

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
}

// ── Components ────────────────────────────────────────────────────────────

function Header({ data }: { data: SnapshotData }) {
  const onLoc = data.set.onLocation;
  const projectLocation = data.project.studioName
    ?? data.project.eventLocation
    ?? "—";

  return (
    <View>
      <View style={s.headerBar} fixed />
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
          <Text style={{ fontSize: 10, marginTop: 2, color: SURFACE_DARK }}>{onLoc.description}</Text>
        </View>
      )}

      {data.set.notes && (
        <View style={{ marginTop: 14 }}>
          <Text style={s.metaLabel}>Notes</Text>
          <Text style={{ fontSize: 10, marginTop: 2, color: SURFACE_DARK }}>{data.set.notes}</Text>
        </View>
      )}
    </View>
  );
}

function EquipmentSection({ data }: { data: SnapshotData }) {
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
              <Text style={[s.td, s.colCategory, { color: GREY }]}>{e.category ?? "—"}</Text>
              <Text style={[s.td, s.colStatus, { color: statusColour(e.status, e.damageStatus), fontWeight: 700 }]}>
                {statusLabel(e.status, e.damageStatus)}
              </Text>
              <Text style={[s.td, s.colUser, { color: GREY }]}>{e.issuedTo ?? "—"}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function PhotosSection({ data }: { data: SnapshotData }) {
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
                <View style={[s.mediaImage, { backgroundColor: GREY_LIGHT, alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ fontSize: 9, color: GREY }}>Preview unavailable</Text>
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

function LayoutsSection({ data }: { data: SnapshotData }) {
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

function DamageSection({ data }: { data: SnapshotData }) {
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
                {d.equipmentName} <Text style={{ color: GREY }}>· {d.equipmentSerial}</Text>
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
                <Text style={{ fontSize: 10, fontWeight: 700, color: STATUS_TEAL }}>
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

function Footer({ data }: { data: SnapshotData }) {
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
  return (
    <Document
      title={`${data.project.name} — ${data.set.name} snapshot`}
      author={data.generatedBy}
      creator="LogiTrak"
      producer="LogiTrak"
    >
      <Page size="A4" style={s.page} wrap>
        <Header data={data} />
        <EquipmentSection data={data} />
        <PhotosSection data={data} />
        <LayoutsSection data={data} />
        <DamageSection data={data} />
        <Footer data={data} />
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
