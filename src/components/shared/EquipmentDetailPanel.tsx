/**
 * EquipmentDetailPanel — slide-in right drawer with equipment detail.
 *
 * Redesigned:
 *  - Rectangular StatusPill (coloured right edge) instead of round badge chips
 *  - Prettified enum values (no more `on_set`, `rigged_to_outside_of_set`)
 *  - Rich info: days issued, previous locations, durations
 *  - Card-based layout matching Reports / Equipment pages
 */

"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusPill, type StatusPillValue } from "@/components/shared/StatusPill";
import { formatDateTime, formatDate, durationFromNow, durationBetween, prettyPosition } from "@/lib/format";

// ── Data shapes ───────────────────────────────────────────────────────────

export interface LocationParts {
  studio?:     string | null;
  stage?:      string | null;
  set?:        string | null;
  onLocation?: string | null;
  position?:   string | null;
  exact?:      string | null;
}

export interface CheckEvent {
  id:          string;
  type:        "out" | "in";
  location?:   string;
  locationParts?: LocationParts;
  checkedBy:   string;
  timestamp:   string;
}

export interface DamageEvent {
  id:            string;
  description:   string;
  reportedBy:    string;
  timestamp:     string;
  status:        "damaged" | "under-repair" | "repaired";
  resolution?:   string;
  repairedBy?:   string;
  repairedAt?:   string;
}

export interface EquipmentDetail {
  id:            string;
  serial:        string;
  type:          string;
  category:      string;
  status:        StatusPillValue;
  /** Structured current location (when issued). If absent, shown as "In stock". */
  location?:     LocationParts | null;
  notes?:        string;
  addedAt:       string;
  /** When the item was last checked out (only present if currently issued) */
  issuedAt?:     string | null;
  checkHistory:  CheckEvent[];
  damageHistory: DamageEvent[];
}

// ── Panel ─────────────────────────────────────────────────────────────────

export interface EquipmentDetailPanelProps {
  equipment?: EquipmentDetail | null;
  isOpen:     boolean;
  onClose:    () => void;
  onReportDamage?: (id: string) => void;
}

export function EquipmentDetailPanel({
  equipment,
  isOpen,
  onClose,
  onReportDamage,
}: EquipmentDetailPanelProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
          aria-hidden
        />
      )}

      <div
        className={cn(
          "fixed top-0 right-0 h-full w-[520px] max-w-[95vw] bg-grey-light shadow-device z-50",
          "flex flex-col transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-label="Equipment detail"
        role="dialog"
        aria-modal="true"
      >
        {equipment ? (
          <>
            {/* ── Header ── */}
            <div className="bg-white border-b border-grey-mid px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-semibold text-grey uppercase tracking-wide">Serial</span>
                    <span className="text-[13px] font-semibold text-surface-dark">{equipment.serial}</span>
                  </div>
                  <h2 className="text-[18px] font-semibold text-surface-dark truncate">{equipment.type}</h2>
                  <p className="text-[12px] text-grey mt-0.5">{equipment.category}</p>
                </div>
                <button
                  onClick={onClose}
                  className="text-grey hover:text-surface-dark text-[20px] leading-none -mt-1"
                  aria-label="Close panel"
                >
                  ×
                </button>
              </div>
              <div className="mt-3">
                <StatusPill status={equipment.status} />
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              <LocationCard
                location={equipment.location ?? null}
                issuedFor={equipment.issuedAt ? durationFromNow(equipment.issuedAt) : null}
              />

              <InfoCard>
                <InfoRow label="Category" value={equipment.category} />
                <InfoRow label="Added" value={formatDate(equipment.addedAt)} />
                {equipment.notes && <InfoRow label="Notes" value={equipment.notes} wrap />}
              </InfoCard>

              <SectionCard title="Check History" count={equipment.checkHistory.length}>
                {equipment.checkHistory.length === 0 ? (
                  <EmptyState>No check events yet</EmptyState>
                ) : (
                  <div className="divide-y divide-grey-mid">
                    {equipment.checkHistory.map((ev, idx) => {
                      // Duration between this and the previous (next in array) event
                      const nextEv = equipment.checkHistory[idx + 1];
                      const duration = nextEv
                        ? durationBetween(nextEv.timestamp, ev.timestamp)
                        : null;
                      return (
                        <CheckEventRow key={ev.id} event={ev} durationSincePrev={duration ?? undefined} />
                      );
                    })}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Damage History" count={equipment.damageHistory.length}>
                {equipment.damageHistory.length === 0 ? (
                  <EmptyState>No damage reported</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {equipment.damageHistory.map((ev) => (
                      <DamageEventRow key={ev.id} event={ev} />
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* ── Footer ── */}
            <div className="bg-white px-6 py-4 border-t border-grey-mid flex gap-2">
              {equipment.status === "damaged" || equipment.status === "under_repair" ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    window.location.href = `/damage?equipmentId=${equipment.id}`;
                  }}
                >
                  Go to Damage Report
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onReportDamage?.(equipment.id)}
                  className="flex-1"
                >
                  Report Damage
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">
                Close
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-grey text-[13px]">
            Loading…
          </div>
        )}
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      <dl className="divide-y divide-grey-mid">{children}</dl>
    </div>
  );
}

function InfoRow({ label, value, wrap }: { label: string; value: string; wrap?: boolean }) {
  return (
    <div className="px-4 py-2.5 flex items-start gap-4">
      <dt className="text-[11px] font-semibold text-grey uppercase tracking-wide w-32 shrink-0 mt-0.5">{label}</dt>
      <dd className={cn("text-[13px] text-surface-dark flex-1", wrap ? "whitespace-pre-wrap" : "truncate")}>{value}</dd>
    </div>
  );
}

function SectionCard({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      <div className="px-4 py-2.5 border-b border-grey-mid flex items-center justify-between">
        <h3 className="text-[12px] font-semibold text-surface-dark">{title}</h3>
        {typeof count === "number" && count > 0 && (
          <span className="text-[11px] text-grey">{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-6 text-center text-[12px] text-grey">{children}</div>
  );
}

function CheckEventRow({ event, durationSincePrev }: { event: CheckEvent; durationSincePrev?: string }) {
  const isOut = event.type === "out";
  const parts = event.locationParts;
  const venue = parts?.onLocation
    ? parts.onLocation
    : [parts?.studio, parts?.stage, parts?.set].filter(Boolean).join(" → ");
  const position = parts?.position ? prettyPosition(parts.position) : null;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div
        className={cn(
          "w-2 h-2 rounded-full mt-[6px] flex-shrink-0",
          isOut ? "bg-status-amber" : "bg-status-green"
        )}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-semibold text-surface-dark">
            {isOut ? "Issued" : "Returned"}
          </span>
          {venue && <span className="text-[12px] text-grey">to {venue}</span>}
        </div>
        {(position || parts?.exact) && (
          <p className="text-[11px] text-grey mt-0.5">
            {position && <span>{position}</span>}
            {position && parts?.exact && <span> · </span>}
            {parts?.exact && <span className="whitespace-pre-wrap">{parts.exact}</span>}
          </p>
        )}
        <p className="text-[11px] text-grey mt-0.5">
          {event.checkedBy} · {formatDateTime(event.timestamp)}
          {durationSincePrev && <> · {isOut ? "held for" : "was out for"} {durationSincePrev}</>}
        </p>
      </div>
    </div>
  );
}

// ── Location card (dedicated, roomy, wraps long descriptions) ────────────

function LocationCard({
  location,
  issuedFor,
}: {
  location: LocationParts | null;
  issuedFor: string | null;
}) {
  const isInStock = !location || (
    !location.studio && !location.stage && !location.set &&
    !location.onLocation && !location.position && !location.exact
  );

  if (isInStock) {
    return (
      <InfoCard>
        <InfoRow label="Location" value="In stock" />
      </InfoCard>
    );
  }

  const loc = location!;
  const position = loc.position ? prettyPosition(loc.position) : null;

  return (
    <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
      <div className="px-4 py-1.5 border-b border-grey-mid flex items-center justify-between bg-grey-light/50">
        <h3 className="text-[10px] font-semibold text-grey uppercase tracking-wider">Current Location</h3>
        {issuedFor && <span className="text-[10px] text-grey">issued {issuedFor} ago</span>}
      </div>
      <dl className="divide-y divide-grey-mid">
        {loc.onLocation ? (
          <LocRow label="On Location" value={loc.onLocation} />
        ) : (
          <>
            {loc.studio && <LocRow label="Studio" value={loc.studio} />}
            {loc.stage  && <LocRow label="Stage"  value={loc.stage}  />}
            {loc.set    && <LocRow label="Set"    value={loc.set}    />}
          </>
        )}
        {position     && <LocRow label="Position" value={position}   />}
        {loc.exact    && <LocRow label="Details"  value={loc.exact} wrap />}
      </dl>
    </div>
  );
}

function LocRow({ label, value, wrap }: { label: string; value: string; wrap?: boolean }) {
  return (
    <div className="px-4 py-2.5 flex items-start gap-4">
      <dt className="text-[11px] font-semibold text-grey uppercase tracking-wide w-32 shrink-0 mt-0.5">{label}</dt>
      <dd className={cn("text-[13px] text-surface-dark flex-1 min-w-0", wrap ? "whitespace-pre-wrap break-words" : "")}>{value}</dd>
    </div>
  );
}

function DamageEventRow({ event }: { event: DamageEvent }) {
  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <StatusPill status={event.status === "repaired" ? "repaired" : event.status === "under-repair" ? "under_repair" : "damaged"} size="sm" />
        <span className="text-[11px] text-grey">{formatDateTime(event.timestamp)}</span>
      </div>
      <p className="text-[12px] text-surface-dark">{event.description}</p>
      <p className="text-[11px] text-grey">Reported by {event.reportedBy}</p>
      {event.resolution && (
        <div className="pt-1.5 mt-1 border-t border-grey-mid">
          <p className="text-[11px] font-semibold text-status-teal">
            Repaired by {event.repairedBy}{event.repairedAt ? ` · ${formatDateTime(event.repairedAt)}` : ""}
          </p>
          <p className="text-[12px] text-surface-dark">{event.resolution}</p>
        </div>
      )}
    </div>
  );
}

// Re-export for convenience
export { prettyPosition };
