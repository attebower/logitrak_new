"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { StatCard, StatGrid } from "@/components/shared/StatCard";
import { CrossHireDetailPanel } from "@/components/shared/CrossHireDetailPanel";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import { Handshake, PackageCheck, AlertCircle, Tag } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "active" | "returned" | "cancelled";

const FILTER_TABS: { id: StatusFilter; label: string }[] = [
  { id: "all",       label: "All"       },
  { id: "active",    label: "Active"    },
  { id: "returned",  label: "Returned"  },
  { id: "cancelled", label: "Cancelled" },
];

const STATUS_STYLES: Record<string, string> = {
  active:    "bg-violet-100 text-violet-700",
  returned:  "bg-green-100  text-green-700",
  cancelled: "bg-gray-100   text-gray-600",
};

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────

export default function CrossHireListPage() {
  const { workspaceId } = useWorkspace();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [openEventId,  setOpenEventId]  = useState<string | null>(null);

  const { data: events, isLoading } = trpc.crossHire["crossHire.list"].useQuery({
    workspaceId,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const { data: allEvents } = trpc.crossHire["crossHire.list"].useQuery({ workspaceId });

  const now = Date.now();
  const h48 = 48 * 60 * 60 * 1000;

  const stats = useMemo(() => {
    const active = (allEvents ?? []).filter((e) => e.status === "active");
    const itemsOut = active.reduce((sum, e) => sum + e._count.equipmentItems, 0);
    const dueSoon = active.filter(
      (e) => e.endDate && new Date(e.endDate).getTime() - now < h48 && new Date(e.endDate).getTime() > now
    ).length;
    return { activeCount: active.length, itemsOut, dueSoon };
  }, [allEvents, now]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar
        title="Cross Hire"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/cross-hire/rental-rates">
              <Button variant="secondary" size="sm">
                <Tag className="h-4 w-4 mr-1.5" />
                Rental Rates
              </Button>
            </Link>
            <Link href="/cross-hire/new">
              <Button size="sm">
                <Handshake className="h-4 w-4 mr-1.5" />
                New Cross Hire
              </Button>
            </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <StatGrid>
          <StatCard color="violet" icon={<Handshake className="h-5 w-5" />}    label="Currently Out" value={stats.activeCount} />
          <StatCard color="violet" icon={<PackageCheck className="h-5 w-5" />} label="Items on Hire" value={stats.itemsOut} />
          <StatCard color="amber"  icon={<AlertCircle className="h-5 w-5" />}  label="Due Within 48h" value={stats.dueSoon} />
        </StatGrid>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-grey-light rounded-btn p-1 w-fit">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                "px-3 py-1.5 rounded-[6px] text-[12px] font-semibold transition-colors",
                statusFilter === tab.id
                  ? "bg-white text-surface-dark shadow-card"
                  : "text-grey hover:text-surface-dark"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-card border border-grey-mid shadow-card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-[13px] text-grey">Loading…</div>
          ) : !events || events.length === 0 ? (
            <div className="p-12 text-center">
              <Handshake className="h-10 w-10 text-grey mx-auto mb-3" />
              <p className="text-[14px] font-medium text-surface-dark mb-1">No cross hire events</p>
              <p className="text-[12px] text-grey mb-4">
                {statusFilter === "all"
                  ? "Create your first cross hire to loan equipment to an external production."
                  : `No ${statusFilter} cross hire events found.`}
              </p>
              {statusFilter === "all" && (
                <Link href="/cross-hire/new">
                  <Button size="sm">New Cross Hire</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-grey-mid bg-grey-light/50">
                    <th className="text-left  px-4 py-3 font-semibold text-surface-dark">Production</th>
                    <th className="text-left  px-4 py-3 font-semibold text-surface-dark">Start</th>
                    <th className="text-left  px-4 py-3 font-semibold text-surface-dark">Due back</th>
                    <th className="text-left  px-4 py-3 font-semibold text-surface-dark">Progress</th>
                    <th className="text-right px-4 py-3 font-semibold text-surface-dark">Total/day</th>
                    <th className="text-left  px-4 py-3 font-semibold text-surface-dark">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grey-mid">
                  {events.map((event) => {
                    const total      = event.equipmentItems.length;
                    const returned   = event.equipmentItems.filter((i) => i.returnedAt).length;
                    const pct        = total === 0 ? 0 : Math.round((returned / total) * 100);
                    const endMs      = event.endDate ? new Date(event.endDate).getTime() : null;
                    const isOverdue  = event.status === "active" && !!endMs && endMs < now;
                    const daysOver   = isOverdue && endMs ? Math.floor((now - endMs) / 86400000) : 0;

                    return (
                      <tr
                        key={event.id}
                        onClick={() => setOpenEventId(event.id)}
                        className="hover:bg-grey-light/30 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 font-medium text-surface-dark">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{event.hireCustomer.productionName}</span>
                            {isOverdue && (
                              <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                                {daysOver}d overdue
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-grey">{formatDate(event.startDate)}</td>
                        <td className={cn("px-4 py-3", isOverdue ? "text-status-red font-medium" : "text-grey")}>
                          {formatDate(event.endDate)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-[160px]">
                            <div className="flex-1 h-1.5 bg-grey-light rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full",
                                  pct === 100 ? "bg-status-green" : "bg-violet-500"
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-grey tabular-nums whitespace-nowrap">
                              {returned}/{total} · {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-surface-dark">
                          £{event.totalDailyRate.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold",
                            STATUS_STYLES[event.status] ?? "bg-grey-mid text-surface-dark"
                          )}>
                            {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <CrossHireDetailPanel
        workspaceId={workspaceId}
        eventId={openEventId}
        isOpen={!!openEventId}
        onClose={() => setOpenEventId(null)}
      />
    </>
  );
}
