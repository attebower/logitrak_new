"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import {
  XCircle, AlertTriangle, ChevronRight,
  User, Phone, Mail, MapPin, ExternalLink,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_STYLES: Record<string, string> = {
  active:    "bg-violet-100 text-violet-700",
  returned:  "bg-green-100  text-green-700",
  cancelled: "bg-gray-100   text-gray-600",
};

// ── Panel ──────────────────────────────────────────────────────────────────

export interface CrossHireDetailPanelProps {
  workspaceId: string;
  eventId:     string | null;
  isOpen:      boolean;
  onClose:     () => void;
  onMutated?:  () => void;
}

export function CrossHireDetailPanel({
  workspaceId, eventId, isOpen, onClose, onMutated,
}: CrossHireDetailPanelProps) {
  const utils = trpc.useUtils();

  const { data: event, isLoading } = trpc.crossHire["crossHire.getById"].useQuery(
    { workspaceId, id: eventId ?? "" },
    { enabled: !!eventId && isOpen }
  );

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const invalidate = () => {
    void utils.crossHire["crossHire.getById"].invalidate();
    void utils.crossHire["crossHire.list"].invalidate();
    onMutated?.();
  };

  const cancelMut = trpc.crossHire["crossHire.cancel"].useMutation({
    onSuccess: () => {
      setConfirmCancel(false);
      // Event has been deleted — drop it from caches and close the drawer.
      void utils.equipment.list.invalidate();
      void utils.dashboard.stats.invalidate();
      invalidate();
      onClose();
    },
  });

  // Reset transient state when the panel opens with a new event
  // (confirm dialogs and expansion state from a previous event shouldn't carry over)
  const lastEventIdRef = useStableEventReset(eventId, () => {
    setConfirmCancel(false);
    setExpandedGroups(new Set());
  });
  void lastEventIdRef;

  const now = Date.now();

  const totalItems       = event?.equipmentItems.length ?? 0;
  const returnedItems    = event?.equipmentItems.filter((i) => i.returnedAt).length ?? 0;
  const unreturnedItems  = event?.equipmentItems.filter((i) => !i.returnedAt) ?? [];
  const outstandingCount = unreturnedItems.length;
  const pctReturned      = totalItems === 0 ? 0 : Math.round((returnedItems / totalItems) * 100);

  const endMs        = event?.endDate ? new Date(event.endDate).getTime() : null;
  const isOverdue    = !!(event?.status === "active" && endMs && endMs < now);
  const daysOverdue  = isOverdue && endMs ? Math.floor((now - endMs) / 86400000) : 0;

  const outstandingDailyRate = unreturnedItems.reduce((sum, i) => sum + Number(i.dailyRate), 0);
  const extraCost            = isOverdue ? daysOverdue * outstandingDailyRate : 0;

  // Group items by product name; multi-item groups can be expanded to see serials.
  const itemGroups = useMemo(() => {
    const items = event?.equipmentItems ?? [];
    type Item = typeof items[number];
    const map = new Map<string, Item[]>();
    for (const it of items) {
      const key = it.equipment.name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    const result: [string, Item[]][] = [];
    map.forEach((arr, key) => {
      arr.sort((a, b) => a.equipment.serial.localeCompare(b.equipment.serial));
      result.push([key, arr]);
    });
    return result;
  }, [event?.equipmentItems]);

  function toggleGroup(name: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }


  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden />
      )}

      <div
        className={cn(
          "fixed top-0 right-0 h-full w-[640px] max-w-[95vw] bg-grey-light shadow-device z-50",
          "flex flex-col transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-label="Cross hire detail"
        role="dialog"
        aria-modal="true"
      >
        {!eventId || isLoading ? (
          <div className="flex-1 flex items-center justify-center text-grey text-[13px]">Loading…</div>
        ) : !event ? (
          <div className="flex-1 flex items-center justify-center text-grey text-[13px]">Not found</div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white border-b border-grey-mid px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold",
                      STATUS_STYLES[event.status] ?? "bg-grey-mid text-surface-dark"
                    )}>
                      {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                    </span>
                    {isOverdue && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide bg-red-100 text-red-600 px-2 py-0.5 rounded">
                        <AlertTriangle className="h-3 w-3" />
                        Overdue {daysOverdue}d
                      </span>
                    )}
                  </div>
                  <h2 className="text-[18px] font-semibold text-surface-dark truncate">
                    {event.hireCustomer.productionName}
                  </h2>
                  <p className="text-[12px] text-grey mt-0.5">Created {formatDate(event.createdAt)}</p>
                </div>
                <button
                  onClick={onClose}
                  className="text-grey hover:text-surface-dark text-[20px] leading-none -mt-1"
                  aria-label="Close panel"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* Progress card */}
              <div className="bg-white rounded-card border border-grey-mid p-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[12px] font-semibold text-surface-dark uppercase tracking-wide">Progress</h3>
                  <span className="text-[12px] font-semibold text-surface-dark">{pctReturned}%</span>
                </div>
                <div className="w-full h-2 bg-grey-light rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all",
                      pctReturned === 100 ? "bg-status-green" : "bg-violet-500"
                    )}
                    style={{ width: `${pctReturned}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-[12px]">
                  <Stat label="Returned" value={`${returnedItems} / ${totalItems}`} />
                  <Stat label="Outstanding" value={outstandingCount} tone={outstandingCount > 0 && isOverdue ? "red" : "default"} />
                  <Stat label="Daily rate" value={`£${outstandingDailyRate.toFixed(2)}`} />
                </div>
              </div>

              {/* Dates / overdue card */}
              <div className="bg-white rounded-card border border-grey-mid p-3 space-y-2">
                <h3 className="text-[12px] font-semibold text-surface-dark uppercase tracking-wide">Dates</h3>
                <div className="grid grid-cols-3 gap-2 text-[12px]">
                  <Stat label="Start" value={formatDate(event.startDate)} />
                  <Stat label="Due back" value={formatDate(event.endDate)} tone={isOverdue ? "red" : "default"} />
                  <Stat
                    label={isOverdue ? "Days overdue" : event.returnedAt ? "Returned" : "Days left"}
                    value={
                      isOverdue
                        ? `${daysOverdue}d`
                        : event.returnedAt
                          ? formatDate(event.returnedAt)
                          : endMs
                            ? `${Math.max(0, Math.ceil((endMs - now) / 86400000))}d`
                            : "—"
                    }
                    tone={isOverdue ? "red" : "default"}
                  />
                </div>
                {isOverdue && extraCost > 0 && (
                  <div className="border-t border-grey-mid pt-2 flex items-center justify-between">
                    <span className="text-[12px] text-grey">Extra cost while still out</span>
                    <span className="text-[14px] font-semibold text-status-red">£{extraCost.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Customer card */}
              <div className="bg-white rounded-card border border-grey-mid p-4 space-y-2">
                <h3 className="text-[12px] font-semibold text-surface-dark uppercase tracking-wide">Customer</h3>
                {event.hireCustomer.vatNumber && (
                  <p className="text-[12px] text-grey">VAT: {event.hireCustomer.vatNumber}</p>
                )}
                {event.hireCustomer.contactName && (
                  <div className="flex items-center gap-2 text-[12px] text-grey">
                    <User className="h-3.5 w-3.5" />{event.hireCustomer.contactName}
                  </div>
                )}
                {event.hireCustomer.contactEmail && (
                  <div className="flex items-center gap-2 text-[12px] text-grey">
                    <Mail className="h-3.5 w-3.5" />
                    <a href={`mailto:${event.hireCustomer.contactEmail}`} className="hover:text-brand-blue">
                      {event.hireCustomer.contactEmail}
                    </a>
                  </div>
                )}
                {event.hireCustomer.contactPhone && (
                  <div className="flex items-center gap-2 text-[12px] text-grey">
                    <Phone className="h-3.5 w-3.5" />{event.hireCustomer.contactPhone}
                  </div>
                )}
                {(event.hireCustomer.city ?? event.hireCustomer.postcode) && (
                  <div className="flex items-start gap-2 text-[12px] text-grey">
                    <MapPin className="h-3.5 w-3.5 mt-0.5" />
                    <span>
                      {[event.hireCustomer.addressLine1, event.hireCustomer.city, event.hireCustomer.postcode]
                        .filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
                {event.notes && (
                  <p className="text-[12px] text-grey whitespace-pre-line border-t border-grey-mid pt-2">
                    {event.notes}
                  </p>
                )}
              </div>

              {/* Items list */}
              <div className="bg-white rounded-card border border-grey-mid overflow-hidden">
                <div className="px-4 py-2.5 border-b border-grey-mid">
                  <h3 className="text-[12px] font-semibold text-surface-dark uppercase tracking-wide">
                    Items ({totalItems})
                  </h3>
                </div>
                <div className="divide-y divide-grey-mid max-h-[40vh] overflow-y-auto">
                  {itemGroups.map(([name, items]) => {
                    const isMulti     = items.length > 1;
                    const isExpanded  = isMulti && expandedGroups.has(name);
                    const returned    = items.filter((i) => i.returnedAt).length;
                    const onHire      = items.length - returned;
                    const groupDaily  = items.reduce((sum, i) => sum + Number(i.dailyRate), 0);
                    const firstItem   = items[0];

                    return (
                      <div key={name}>
                        <div
                          role={isMulti ? "button" : undefined}
                          tabIndex={isMulti ? 0 : undefined}
                          onClick={isMulti ? () => toggleGroup(name) : undefined}
                          onKeyDown={isMulti ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleGroup(name);
                            }
                          } : undefined}
                          className={cn(
                            "px-4 py-2.5 flex items-center gap-3",
                            isMulti && "cursor-pointer hover:bg-brand-blue/[0.04]"
                          )}
                          aria-expanded={isMulti ? isExpanded : undefined}
                        >
                          {isMulti && (
                            <div className="w-4 flex-shrink-0 flex items-center justify-center">
                              <ChevronRight
                                className={cn("h-3.5 w-3.5 text-grey transition-transform",
                                  isExpanded && "rotate-90"
                                )}
                              />
                            </div>
                          )}
                          {!isMulti && (
                            <span className="font-mono text-[12px] font-semibold text-surface-dark w-14 flex-shrink-0">
                              {firstItem.equipment.serial}
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-surface-dark truncate">
                              {name}
                              {isMulti && <span className="text-grey font-normal ml-1">× {items.length}</span>}
                            </p>
                            <p className="text-[11px] text-grey">{firstItem.equipment.category?.name ?? "—"}</p>
                          </div>
                          <span className="text-[12px] text-grey whitespace-nowrap">
                            £{(isMulti ? groupDaily : Number(firstItem.dailyRate)).toFixed(2)}/day
                          </span>
                          <div className="flex items-center gap-1.5">
                            {onHire > 0 && (
                              <span className="text-[10px] font-semibold uppercase bg-violet-100 text-violet-700 px-2 py-0.5 rounded">
                                {isMulti ? `${onHire} On Hire` : "On Hire"}
                              </span>
                            )}
                            {returned > 0 && (
                              <span className="text-[10px] font-semibold uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                {isMulti ? `${returned} Returned` : "Returned"}
                              </span>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="bg-grey-light/30 divide-y divide-grey-mid/60">
                            {items.map((item) => (
                              <div key={item.id} className="px-4 py-1.5 pl-12 flex items-center gap-3">
                                <span className="font-mono text-[12px] font-semibold text-surface-dark w-14 flex-shrink-0">
                                  {item.equipment.serial}
                                </span>
                                <span className="text-[11px] text-grey flex-1 truncate">
                                  {item.returnedAt ? `Returned ${formatDate(item.returnedAt)}` : "On hire"}
                                </span>
                                <span className={cn(
                                  "text-[10px] font-semibold uppercase px-2 py-0.5 rounded",
                                  item.returnedAt
                                    ? "bg-green-100 text-green-700"
                                    : "bg-violet-100 text-violet-700"
                                )}>
                                  {item.returnedAt ? "Returned" : "On Hire"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white px-4 py-3 border-t border-grey-mid flex items-center gap-2 flex-wrap">
              {event.status === "active" && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmCancel(true)}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Cancel Hire
                </Button>
              )}
              <div className="ml-auto">
                <Link href={`/cross-hire/${event.id}`}>
                  <Button variant="primary" size="sm">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Open page
                  </Button>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Confirm cancel modal */}
      {confirmCancel && event && event.status === "active" && (
        <ConfirmDeleteCrossHireModal
          productionName={event.hireCustomer.productionName}
          itemCount={event.equipmentItems.filter((i) => !i.returnedAt).length}
          isPending={cancelMut.isPending}
          onConfirm={() => cancelMut.mutate({ workspaceId, eventId: event.id })}
          onClose={() => { if (!cancelMut.isPending) setConfirmCancel(false); }}
        />
      )}
    </>
  );
}

function ConfirmDeleteCrossHireModal({
  productionName, itemCount, isPending, onConfirm, onClose,
}: {
  productionName: string;
  itemCount: number;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="bg-white rounded-card shadow-device max-w-md w-full overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-status-red" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold text-surface-dark">Cancel this cross hire?</h2>
                <p className="text-[12px] text-grey mt-0.5 truncate">{productionName}</p>
              </div>
            </div>
            <div className="mt-4 text-[13px] text-surface-dark space-y-2">
              <p>This will <span className="font-semibold">permanently delete</span> this cross hire order. It cannot be undone.</p>
              {itemCount > 0 && (
                <p><span className="font-semibold">{itemCount}</span> item{itemCount === 1 ? "" : "s"} currently on hire will be returned to stock.</p>
              )}
            </div>
          </div>
          <div className="px-6 py-3 bg-grey-light/40 border-t border-grey-mid flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" disabled={isPending} onClick={onClose}>Keep hire</Button>
            <Button variant="destructive" size="sm" disabled={isPending} onClick={onConfirm}>
              {isPending ? "Deleting…" : "Yes, delete"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components / hooks ─────────────────────────────────────────────────

function Stat({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "red" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-grey">{label}</div>
      <div className={cn("text-[14px] font-semibold mt-0.5",
        tone === "red" ? "text-status-red" : "text-surface-dark"
      )}>
        {value}
      </div>
    </div>
  );
}

function useStableEventReset(eventId: string | null, onChange: () => void) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (eventId !== last.current) {
      last.current = eventId;
      onChange();
    }
  }, [eventId, onChange]);
  return last;
}
