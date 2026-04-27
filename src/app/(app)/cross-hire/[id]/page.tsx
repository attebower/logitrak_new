"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, XCircle, CheckSquare,
  AlertTriangle, User, Phone, Mail, MapPin,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const STATUS_STYLES: Record<string, string> = {
  active:    "bg-violet-100 text-violet-700",
  returned:  "bg-green-100  text-green-700",
  cancelled: "bg-gray-100   text-gray-600",
};

// ── Component ─────────────────────────────────────────────────────────────

export default function CrossHireDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { workspaceId } = useWorkspace();

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [confirmCancel, setConfirmCancel]     = useState(false);

  const utils = trpc.useUtils();

  const { data: event, isLoading, error } = trpc.crossHire["crossHire.getById"].useQuery({
    workspaceId,
    id,
  });

  const returnItemsMut = trpc.crossHire["crossHire.returnItems"].useMutation({
    onSuccess: () => {
      setSelectedItemIds(new Set());
      void utils.crossHire["crossHire.getById"].invalidate();
    },
  });

  const cancelMut = trpc.crossHire["crossHire.cancel"].useMutation({
    onSuccess: () => {
      setConfirmCancel(false);
      void utils.crossHire["crossHire.getById"].invalidate();
    },
  });

  if (isLoading) {
    return (
      <>
        <AppTopbar title="Cross Hire" />
        <div className="flex-1 flex items-center justify-center text-grey text-[13px]">
          Loading…
        </div>
      </>
    );
  }

  if (error || !event) {
    return (
      <>
        <AppTopbar title="Cross Hire" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[14px] font-medium text-surface-dark mb-2">Event not found</p>
            <Link href="/cross-hire">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  const now   = Date.now();
  const isOverdue =
    event.status === "active" &&
    event.endDate &&
    new Date(event.endDate).getTime() < now;

  const unreturned = event.equipmentItems.filter((i) => !i.returnedAt);

  function toggleItem(id: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedItemIds.size === unreturned.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(unreturned.map((i) => i.id)));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar
        title={event.hireCustomer.productionName}
        actions={
          <Link href="/cross-hire">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              All Cross Hires
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">

        {/* ── Header row ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[20px] font-bold text-surface-dark">
              {event.hireCustomer.productionName}
            </h1>
            <span className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold",
              STATUS_STYLES[event.status] ?? "bg-grey-mid text-surface-dark"
            )}>
              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide bg-red-100 text-red-600 px-2 py-0.5 rounded">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </span>
            )}
          </div>
          <p className="text-[12px] text-grey">
            Created {formatDate(event.createdAt)}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── Customer info ──────────────────────────────────────────── */}
          <div className="bg-white rounded-card border border-grey-mid shadow-card p-4 space-y-2">
            <h2 className="text-[13px] font-semibold text-surface-dark uppercase tracking-wide">
              Customer
            </h2>
            <div className="space-y-1.5">
              <p className="text-[14px] font-semibold text-surface-dark">
                {event.hireCustomer.productionName}
              </p>
              {event.hireCustomer.vatNumber && (
                <p className="text-[12px] text-grey">VAT: {event.hireCustomer.vatNumber}</p>
              )}
              {event.hireCustomer.contactName && (
                <div className="flex items-center gap-2 text-[12px] text-grey">
                  <User className="h-3.5 w-3.5" />
                  {event.hireCustomer.contactName}
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
                  <Phone className="h-3.5 w-3.5" />
                  {event.hireCustomer.contactPhone}
                </div>
              )}
              {(event.hireCustomer.city ?? event.hireCustomer.postcode) && (
                <div className="flex items-center gap-2 text-[12px] text-grey">
                  <MapPin className="h-3.5 w-3.5" />
                  {[event.hireCustomer.addressLine1, event.hireCustomer.city, event.hireCustomer.postcode]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}
            </div>
          </div>

          {/* ── Terms ──────────────────────────────────────────────────── */}
          <div className="bg-white rounded-card border border-grey-mid shadow-card p-4 space-y-2">
            <h2 className="text-[13px] font-semibold text-surface-dark uppercase tracking-wide">
              Terms
            </h2>
            <div className="space-y-1.5">
              <div>
                <span className="text-[11px] text-grey">Terms of Hire</span>
                <p className="text-[13px] text-surface-dark font-medium">{event.termsOfHire.replace(/\s*\([^)]*\)$/, "")}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] text-grey">Start Date</span>
                  <p className="text-[13px] text-surface-dark">{formatDate(event.startDate)}</p>
                </div>
                <div>
                  <span className="text-[11px] text-grey">End Date</span>
                  <p className="text-[13px] text-surface-dark">{formatDate(event.endDate)}</p>
                </div>
              </div>
              {event.returnedAt && (
                <div>
                  <span className="text-[11px] text-grey">Returned</span>
                  <p className="text-[13px] text-surface-dark">{formatDate(event.returnedAt)}</p>
                </div>
              )}
              {event.notes && (
                <div>
                  <span className="text-[11px] text-grey">Notes</span>
                  <p className="text-[13px] text-grey whitespace-pre-line">{event.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Action buttons ─────────────────────────────────────────── */}
        {event.status === "active" && (
          <div className="flex items-center gap-3 flex-wrap">
            {selectedItemIds.size > 0 && (
              <Button
                size="sm"
                className="bg-violet-600 hover:bg-violet-700"
                disabled={returnItemsMut.isPending}
                onClick={() =>
                  returnItemsMut.mutate({
                    workspaceId,
                    eventId: event.id,
                    itemIds: Array.from(selectedItemIds),
                  })
                }
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                {returnItemsMut.isPending
                  ? "Returning…"
                  : `Return Selected (${selectedItemIds.size})`}
              </Button>
            )}

            {!confirmCancel ? (
              <button
                onClick={() => setConfirmCancel(true)}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
              >
                <XCircle className="h-3 w-3" />
                Cancel Hire
              </button>
            ) : (
              <div className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-600">
                <span>Are you sure?</span>
                <button
                  disabled={cancelMut.isPending}
                  onClick={() => cancelMut.mutate({ workspaceId, eventId: event.id })}
                  className="px-1.5 rounded hover:bg-red-200 disabled:opacity-50"
                >
                  {cancelMut.isPending ? "…" : "Yes"}
                </button>
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="px-1.5 rounded text-red-600/70 hover:bg-red-200"
                >
                  No
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Items table ────────────────────────────────────────────── */}
        <div className="bg-white rounded-card border border-grey-mid shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-grey-mid flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-surface-dark">
              Equipment Items ({event.equipmentItems.length})
            </h2>
            {event.status === "active" && unreturned.length > 0 && (
              <button
                onClick={toggleAll}
                className="text-[11px] text-violet-700 hover:text-violet-900 font-medium"
              >
                {selectedItemIds.size === unreturned.length ? "Deselect all" : "Select all unreturned"}
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-grey-mid bg-grey-light/50">
                  {event.status === "active" && <th className="w-10 px-4 py-3" />}
                  <th className="text-left px-4 py-3 font-semibold text-surface-dark">Serial</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-dark">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-dark">Category</th>
                  <th className="text-right px-4 py-3 font-semibold text-surface-dark">Daily</th>
                  <th className="text-right px-4 py-3 font-semibold text-surface-dark">Weekly</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-dark">Notes</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-dark">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-mid">
                {event.equipmentItems.map((item) => {
                  const isReturned  = !!item.returnedAt;
                  const isSelected  = selectedItemIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "transition-colors",
                        isReturned   ? "opacity-50" : "hover:bg-grey-light/30",
                        isSelected   && "bg-violet-50"
                      )}
                    >
                      {event.status === "active" && (
                        <td className="px-4 py-3">
                          {!isReturned && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleItem(item.id)}
                              className="rounded border-grey-mid accent-violet-600"
                            />
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono font-semibold text-surface-dark">
                        {item.equipment.serial}
                      </td>
                      <td className="px-4 py-3 text-surface-dark">{item.equipment.name}</td>
                      <td className="px-4 py-3 text-grey">
                        {item.equipment.category?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-surface-dark">
                        £{Number(item.dailyRate).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-grey">
                        {item.weeklyRate ? `£${Number(item.weeklyRate).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-grey max-w-[200px] truncate">
                        {item.notes ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isReturned ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-green-100 text-green-700">
                            Returned {formatDate(item.returnedAt)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-100 text-violet-700">
                            On Hire
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals footer */}
          <div className="px-5 py-3 border-t border-grey-mid bg-grey-light/30 flex items-center justify-end gap-6">
            <span className="text-[12px] text-grey">
              Total Daily Rate:{" "}
              <span className="font-semibold text-surface-dark">
                £{event.equipmentItems
                  .reduce((sum, i) => sum + Number(i.dailyRate), 0)
                  .toFixed(2)}
                /day
              </span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
