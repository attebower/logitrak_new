/**
 * LogiTrak EquipmentDetailPanel Component
 * Slide-in drawer showing full equipment info, check event history, and damage history.
 *
 * Built as a right-side drawer (Sheet pattern from shadcn) — not a modal.
 * Nova: wire to the router or a drawer state; open when View is clicked in the equipment table.
 *
 * Usage:
 *   <EquipmentDetailPanel
 *     equipment={selectedItem}
 *     isOpen={!!selectedId}
 *     onClose={() => setSelectedId(null)}
 *   />
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EquipmentStatus } from "./EquipmentListRow";
import type { BadgeProps } from "@/components/ui/badge";

// ── Data shapes ───────────────────────────────────────────────────────────

export interface CheckEvent {
  id:          string;
  type:        "out" | "in";
  location?:   string;
  checkedBy:   string;
  timestamp:   string; // ISO string
  itemCount?:  number; // if batch
}

export interface DamageEvent {
  id:            string;
  description:   string;
  reportedBy:    string;
  timestamp:     string;
  status:        "damaged" | "under-repair" | "repaired";
  resolution?:   string;    // filled when repaired
  repairedBy?:   string;
  repairedAt?:   string;
}

export interface EquipmentDetail {
  id:            string;
  serial:        string;
  type:          string;
  category:      string;
  status:        EquipmentStatus;
  location?:     string;
  notes?:        string;
  addedAt:       string;
  checkHistory:  CheckEvent[];
  damageHistory: DamageEvent[];
}

// ── Status → badge variant ────────────────────────────────────────────────

const statusVariant: Record<EquipmentStatus, BadgeProps["variant"]> = {
  available:     "available",
  "checked-out": "checked-out",
  damaged:       "damaged",
  repaired:      "repaired",
  "under-repair": "under-repair",
};

const statusLabel: Record<EquipmentStatus, string> = {
  available:     "Available",
  "checked-out": "Checked Out",
  damaged:       "Damaged",
  repaired:      "Repaired",
  "under-repair": "Under Repair",
};

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
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-[480px] bg-white shadow-device z-50",
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
            <div className="flex items-start justify-between px-6 py-5 border-b border-grey-mid">
              <div>
                <div className="text-serial text-surface-dark text-[18px] mb-1">
                  {equipment.serial}
                </div>
                <div className="text-body text-grey">{equipment.type}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={statusVariant[equipment.status]}>
                    {statusLabel[equipment.status]}
                  </Badge>
                  <Badge variant="category">{equipment.category}</Badge>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-grey hover:text-surface-dark text-xl leading-none mt-1"
                aria-label="Close panel"
              >
                ×
              </button>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Info grid */}
              <Section title="Details">
                <InfoGrid>
                  <InfoItem label="Location" value={equipment.location ?? "In Stock"} />
                  <InfoItem label="Category" value={equipment.category} />
                  <InfoItem label="Added" value={formatDate(equipment.addedAt)} />
                  {equipment.notes && (
                    <InfoItem label="Notes" value={equipment.notes} fullWidth />
                  )}
                </InfoGrid>
              </Section>

              {/* Check event history */}
              <Section title="Check History">
                {equipment.checkHistory.length === 0 ? (
                  <EmptyState>No check events yet</EmptyState>
                ) : (
                  <div className="space-y-0 divide-y divide-grey-mid">
                    {equipment.checkHistory.map((ev) => (
                      <CheckEventRow key={ev.id} event={ev} />
                    ))}
                  </div>
                )}
              </Section>

              {/* Damage history */}
              <Section title="Damage History">
                {equipment.damageHistory.length === 0 ? (
                  <EmptyState>No damage reported</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {equipment.damageHistory.map((ev) => (
                      <DamageEventRow key={ev.id} event={ev} />
                    ))}
                  </div>
                )}
              </Section>
            </div>

            {/* ── Footer actions ── */}
            <div className="px-6 py-4 border-t border-grey-mid flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onReportDamage?.(equipment.id)}
                className="flex-1"
              >
                Report Damage
              </Button>
              <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">
                Close
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-grey text-body">
            Loading…
          </div>
        )}
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-caption text-grey uppercase mb-3">{title}</h3>
      {children}
    </div>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>;
}

function InfoItem({
  label,
  value,
  fullWidth,
}: {
  label:     string;
  value:     string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <dt className="text-caption text-grey uppercase mb-0.5">{label}</dt>
      <dd className="text-body text-surface-dark">{value}</dd>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-4 text-center text-[12px] text-grey border border-grey-mid rounded-card">
      {children}
    </div>
  );
}

function CheckEventRow({ event }: { event: CheckEvent }) {
  const isOut = event.type === "out";
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div
        className={cn(
          "w-2 h-2 rounded-full mt-[5px] flex-shrink-0",
          isOut ? "bg-status-amber" : "bg-status-green"
        )}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-surface-dark">
          {isOut ? "Checked out" : "Checked in"}
          {event.location && (
            <> to <strong>{event.location}</strong></>
          )}
        </p>
        <p className="text-[11px] text-grey mt-0.5">
          {event.checkedBy} · {formatDate(event.timestamp)}
        </p>
      </div>
    </div>
  );
}

function DamageEventRow({ event }: { event: DamageEvent }) {
  return (
    <div className="bg-grey-light rounded-card border border-grey-mid px-4 py-3 space-y-1">
      <div className="flex items-center gap-2">
        <Badge variant={event.status === "repaired" ? "repaired" : "damaged"}>
          {event.status === "repaired" ? "Repaired" : "Damaged"}
        </Badge>
        <span className="text-[11px] text-grey">{formatDate(event.timestamp)}</span>
      </div>
      <p className="text-[12px] text-surface-dark">{event.description}</p>
      <p className="text-[11px] text-grey">Reported by {event.reportedBy}</p>
      {event.resolution && (
        <div className="pt-1 border-t border-grey-mid mt-1">
          <p className="text-[11px] text-status-teal font-semibold">
            Repaired by {event.repairedBy} · {event.repairedAt && formatDate(event.repairedAt)}
          </p>
          <p className="text-[12px] text-surface-dark">{event.resolution}</p>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day:   "numeric",
      month: "short",
      year:  "numeric",
      hour:  "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
