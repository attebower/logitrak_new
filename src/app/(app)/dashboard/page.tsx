"use client";

/**
 * Dashboard — wired to live tRPC data.
 *
 * trpc.dashboard.stats  → stat cards (total, available, checked out, damaged)
 * trpc.activity.list    → activity feed (last 20 events)
 */

import Link from "next/link";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { StatCard, StatGrid } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import type { BadgeProps } from "@/components/ui/badge";
import {
  LayoutDashboard, CheckCircle2, ArrowLeftRight, AlertTriangle,
  RotateCcw, Plus, List, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Quick actions (static — no data dependency) ────────────────────────────

const QUICK_ACTIONS: Array<{ label: string; icon: LucideIcon; desc: string; href: string }> = [
  { label: "Check Out",      icon: ArrowLeftRight, desc: "Sign out items to crew",  href: "/checkinout" },
  { label: "Check In",       icon: RotateCcw,      desc: "Return items to stock",   href: "/checkinout" },
  { label: "Report Damage",  icon: AlertTriangle,  desc: "Log a damaged item",      href: "/damage" },
  { label: "Add Equipment",  icon: Plus,           desc: "Register new assets",     href: "/equipment" },
  { label: "Equipment List", icon: List,           desc: "Browse all assets",       href: "/equipment" },
  { label: "Repair Log",     icon: Wrench,         desc: "View repair history",     href: "/damage/repair" },
];

// ── Activity event → display label ────────────────────────────────────────

function eventActionLabel(eventType: string): string {
  const map: Record<string, string> = {
    check_out:     "checked out",
    check_in:      "returned",
    damage_report: "reported damage on",
    repair_logged: "marked repaired",
    equipment_add: "added",
    status_change: "updated",
  };
  return map[eventType] ?? eventType.replace(/_/g, " ");
}

function eventBadgeVariant(eventType: string): BadgeProps["variant"] {
  const map: Record<string, BadgeProps["variant"]> = {
    check_out:     "checked-out",
    check_in:      "available",
    damage_report: "damaged",
    repair_logged: "repaired",
  };
  return map[eventType] ?? "default";
}

function relativeTime(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { workspaceId, workspaceName } = useWorkspace();

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery(
    { workspaceId },
    { refetchInterval: 30_000 } // refresh every 30s
  );

  const { data: activity, isLoading: activityLoading } = trpc.activity.list.useQuery(
    { workspaceId, limit: 20 },
    { refetchInterval: 30_000 }
  );

  return (
    <>
      <AppTopbar
        title="Dashboard"
        context={workspaceName}
        actions={
          <>
            <Button variant="secondary" size="sm">Export</Button>
            <Button variant="primary" size="sm" asChild>
              <Link href="/equipment">+ Add Equipment</Link>
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Stat cards */}
        <StatGrid>
          <StatCard
            color="blue"
            icon={<LayoutDashboard className="h-5 w-5" />}
            label="Total Assets"
            value={statsLoading ? "—" : (stats?.totalEquipment ?? 0)}
          />
          <StatCard
            color="green"
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Available"
            value={statsLoading ? "—" : (stats?.available ?? 0)}
            change={
              stats && stats.totalEquipment > 0
                ? `${((stats.available / stats.totalEquipment) * 100).toFixed(1)}% of total`
                : undefined
            }
            changeColor="grey"
          />
          <StatCard
            color="amber"
            icon={<ArrowLeftRight className="h-5 w-5" />}
            label="Checked Out"
            value={statsLoading ? "—" : (stats?.checkedOut ?? 0)}
          />
          <StatCard
            color="red"
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Damaged"
            value={statsLoading ? "—" : (stats?.damaged ?? 0)}
            changeColor="red"
          />
        </StatGrid>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity feed */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-card border border-grey-mid shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-grey-mid">
                <h2 className="text-[14px] font-semibold text-surface-dark">Recent Activity</h2>
              </div>

              {activityLoading ? (
                <ActivitySkeleton />
              ) : !activity || activity.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px] text-grey">
                  No activity yet — check out some equipment to get started.
                </div>
              ) : (
                <div className="divide-y divide-grey-mid">
                  {activity.map((event) => (
                    <div key={event.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="text-[11px] text-grey w-14 flex-shrink-0 text-right">
                        {relativeTime(event.createdAt)}
                      </div>
                      <div className="flex-1 text-[13px] text-surface-dark">
                        <span className="font-medium">
                          {event.actor?.displayName ?? event.actor?.email ?? "System"}
                        </span>{" "}
                        <span className="text-grey">{eventActionLabel(event.eventType)}</span>
                        {event.equipmentName && (
                          <> <span>{event.equipmentName}</span></>
                        )}
                      </div>
                      <Badge variant={eventBadgeVariant(event.eventType)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div>
            <div className="bg-white rounded-card border border-grey-mid shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-grey-mid">
                <h2 className="text-[14px] font-semibold text-surface-dark">Quick Actions</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                {QUICK_ACTIONS.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="rounded-[10px] border border-grey-mid hover:border-brand-blue/20 hover:bg-brand-blue/[0.03] transition-colors p-4 text-left group"
                  >
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] bg-grey-light group-hover:bg-brand-blue/10 transition-colors">
                      <action.icon className="h-[18px] w-[18px] text-grey group-hover:text-brand-blue transition-colors" />
                    </div>
                    <div className="text-[12px] font-semibold text-surface-dark group-hover:text-brand-blue transition-colors">
                      {action.label}
                    </div>
                    <div className="text-[11px] text-grey mt-0.5">{action.desc}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ActivitySkeleton() {
  return (
    <div className="divide-y divide-grey-mid">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
          <div className="w-14 h-3 bg-grey-mid rounded" />
          <div className="flex-1 h-3 bg-grey-mid rounded" />
          <div className="w-16 h-5 bg-grey-mid rounded-badge" />
        </div>
      ))}
    </div>
  );
}
