"use client";

/**
 * Dashboard — wired to live tRPC data.
 *
 * Top row: stat cards (unchanged).
 * Below: 3 × 2 widget grid — Quick Actions, Recent Activity, Low Stock,
 * Team Members, Most Used, Projects.
 */

import Link from "next/link";
import { useState } from "react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { StatCard, StatGrid } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import type { BadgeProps } from "@/components/ui/badge";
import {
  LayoutDashboard, CheckCircle2, ArrowLeftRight, AlertTriangle,
  RotateCcw, Plus, List, Wrench, PackageOpen, Users, TrendingUp, Film, Handshake,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Quick actions (static — no data dependency) ────────────────────────────

const QUICK_ACTIONS: Array<{ label: string; icon: LucideIcon; desc: string; href: string }> = [
  { label: "Issue",          icon: ArrowLeftRight, desc: "Sign out items to crew",  href: "/issue" },
  { label: "Return",         icon: RotateCcw,      desc: "Return items to stock",   href: "/return" },
  { label: "Report Damage",  icon: AlertTriangle,  desc: "Log a damaged item",      href: "/damage" },
  { label: "Add Equipment",  icon: Plus,           desc: "Register new assets",     href: "/equipment/new" },
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

function eventVerbColor(eventType: string): string {
  const map: Record<string, string> = {
    check_out:     "text-brand-blue",
    check_in:      "text-status-green",
    damage_report: "text-status-red",
    repair_logged: "text-status-teal",
    equipment_add: "text-brand-blue",
  };
  return map[eventType] ?? "text-grey";
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
    { refetchInterval: 30_000 }
  );

  return (
    <>
      <AppTopbar title="Dashboard" context={workspaceName} />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stat cards (unchanged) */}
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
            color="blue"
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
          <StatCard
            color="violet"
            icon={<Handshake className="h-5 w-5" />}
            label="Cross Hired"
            value={statsLoading ? "—" : (stats?.crossHired ?? 0)}
          />
        </StatGrid>

        {/* 3 × 2 widget grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <QuickActionsWidget />
          <RecentActivityWidget workspaceId={workspaceId} />
          <LowStockWidget workspaceId={workspaceId} />
          <TeamMembersWidget workspaceId={workspaceId} />
          <MostUsedWidget workspaceId={workspaceId} />
          <ProjectsWidget workspaceId={workspaceId} />
          <ActiveCrossHiresWidget workspaceId={workspaceId} />
        </div>
      </div>
    </>
  );
}

// ── Widget shell ──────────────────────────────────────────────────────────

function Widget({
  title, action, children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-card border border-grey-mid shadow-card overflow-hidden flex flex-col h-[300px]">
      <div className="px-5 py-3.5 border-b border-grey-mid flex items-center justify-between gap-3 flex-shrink-0">
        <h2 className="text-[14px] font-semibold text-surface-dark">{title}</h2>
        {action}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}

function EmptyWidget({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-8 text-center text-[13px] text-grey">
      {children}
    </div>
  );
}

function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-grey-mid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
          <div className="flex-1 h-3 bg-grey-mid rounded" />
          <div className="w-16 h-3 bg-grey-mid rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Quick Actions ─────────────────────────────────────────────────────────

function QuickActionsWidget() {
  return (
    <Widget title="Quick Actions">
      <div className="grid grid-cols-2 gap-2 p-3">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="rounded-[8px] border border-grey-mid hover:border-brand-blue/20 hover:bg-brand-blue/[0.03] transition-colors px-3 py-2 text-left group flex items-center gap-2.5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-grey-light group-hover:bg-brand-blue/10 transition-colors flex-shrink-0">
              <action.icon className="h-[15px] w-[15px] text-grey group-hover:text-brand-blue transition-colors" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-surface-dark group-hover:text-brand-blue transition-colors truncate">
                {action.label}
              </div>
              <div className="text-[10px] text-grey truncate">{action.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </Widget>
  );
}

// ── Recent Activity ───────────────────────────────────────────────────────

function RecentActivityWidget({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = trpc.activity.list.useQuery(
    { workspaceId, limit: 5 },
    { refetchInterval: 30_000 }
  );

  return (
    <Widget title="Recent Activity">
      {isLoading ? (
        <SkeletonRows count={5} />
      ) : !data || data.length === 0 ? (
        <EmptyWidget>No activity yet.</EmptyWidget>
      ) : (
        <div className="divide-y divide-grey-mid">
          {data.map((event) => (
            <div key={event.id} className="flex items-center gap-3 px-5 py-2.5">
              <div className="text-[11px] text-grey w-14 flex-shrink-0 text-right whitespace-nowrap">
                {relativeTime(event.createdAt)}
              </div>
              <div className="flex-1 text-[12px] text-surface-dark truncate">
                <span className="font-medium">
                  {event.actor?.displayName ?? event.actor?.email ?? "System"}
                </span>{" "}
                <span className={cn("font-medium", eventVerbColor(event.eventType))}>
                  {eventActionLabel(event.eventType)}
                </span>
                {event.equipmentName && <> <span>{event.equipmentName}</span></>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

// ── Low Stock ─────────────────────────────────────────────────────────────

function LowStockWidget({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = trpc.dashboard.lowStock.useQuery(
    { workspaceId },
    { refetchInterval: 60_000 }
  );

  return (
    <Widget
      title="Low Stock"
      action={
        !isLoading && data && data.length > 0 ? (
          <span className="text-[11px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
            {data.length} {data.length === 1 ? "item" : "items"}
          </span>
        ) : null
      }
    >
      {isLoading ? (
        <SkeletonRows count={4} />
      ) : !data || data.length === 0 ? (
        <EmptyWidget>
          <PackageOpen className="h-5 w-5 text-grey mx-auto mb-2" />
          All products well stocked.
        </EmptyWidget>
      ) : (
        <div className="divide-y divide-grey-mid">
          {data.map((item) => {
            const critical = item.available === 0;
            return (
              <div key={item.productId} className="flex items-center gap-3 px-5 py-2.5">
                <div className="flex-1 text-[12px] font-medium text-surface-dark truncate">{item.name}</div>
                <div className={cn(
                  "text-[11px] font-semibold whitespace-nowrap",
                  critical ? "text-status-red" : "text-status-amber"
                )}>
                  {item.available} of {item.total} available
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

// ── Team Members ──────────────────────────────────────────────────────────

function TeamMembersWidget({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = trpc.team.list.useQuery({ workspaceId });

  function initials(name: string | null | undefined, email: string): string {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  }

  return (
    <Widget
      title="Team Members"
      action={
        <Link href="/team" className="text-[11px] text-grey hover:text-brand-blue">Manage</Link>
      }
    >
      {isLoading ? (
        <SkeletonRows count={4} />
      ) : !data || data.length === 0 ? (
        <EmptyWidget>
          <Users className="h-5 w-5 text-grey mx-auto mb-2" />
          No members yet.
        </EmptyWidget>
      ) : (
        <div className="divide-y divide-grey-mid">
          {data.slice(0, 5).map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-2.5">
              <div className="h-7 w-7 rounded-full bg-brand-blue/10 flex items-center justify-center text-[10px] font-semibold text-brand-blue flex-shrink-0">
                {initials(m.user.displayName, m.user.email)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-surface-dark truncate">
                  {m.user.displayName ?? m.user.email}
                </div>
                {m.user.displayName && (
                  <div className="text-[11px] text-grey truncate">{m.user.email}</div>
                )}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-grey whitespace-nowrap">
                {m.role.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

// ── Most Used ─────────────────────────────────────────────────────────────

function MostUsedWidget({ workspaceId }: { workspaceId: string }) {
  const [window, setWindow] = useState<"30d" | "all">("30d");
  const { data, isLoading } = trpc.dashboard.mostUsed.useQuery(
    { workspaceId, window, limit: 5 },
    { refetchInterval: 60_000 }
  );

  return (
    <Widget
      title="Most Used"
      action={
        <div className="flex items-center gap-0.5 bg-grey-light rounded-btn p-0.5">
          <WindowTab active={window === "30d"} onClick={() => setWindow("30d")}>30d</WindowTab>
          <WindowTab active={window === "all"} onClick={() => setWindow("all")}>All</WindowTab>
        </div>
      }
    >
      {isLoading ? (
        <SkeletonRows count={5} />
      ) : !data || data.length === 0 ? (
        <EmptyWidget>
          <TrendingUp className="h-5 w-5 text-grey mx-auto mb-2" />
          No check-outs yet.
        </EmptyWidget>
      ) : (
        <div className="divide-y divide-grey-mid">
          {data.map((item, i) => (
            <div key={item.key} className="flex items-center gap-3 px-5 py-2.5">
              <div className="text-[11px] font-semibold text-grey w-4 flex-shrink-0">{i + 1}</div>
              <div className="flex-1 text-[12px] font-medium text-surface-dark truncate">
                {item.name}
              </div>
              <div className="text-[11px] text-grey whitespace-nowrap">
                {item.count} {item.count === 1 ? "check-out" : "check-outs"}
              </div>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

function WindowTab({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-0.5 rounded-[5px] text-[10px] font-semibold transition-colors",
        active ? "bg-white text-surface-dark shadow-card" : "text-grey hover:text-surface-dark"
      )}
    >
      {children}
    </button>
  );
}

// ── Projects ──────────────────────────────────────────────────────────────

// ── Active Cross Hires ────────────────────────────────────────────────────

function formatShortDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function ActiveCrossHiresWidget({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = trpc.crossHire["crossHire.list"].useQuery(
    { workspaceId, status: "active" },
    { refetchInterval: 60_000 }
  );

  const now = Date.now();
  const sorted = (data ?? []).slice().sort((a, b) => {
    const aEnd = a.endDate ? new Date(a.endDate).getTime() : Infinity;
    const bEnd = b.endDate ? new Date(b.endDate).getTime() : Infinity;
    return aEnd - bEnd;
  });

  return (
    <Widget
      title="Active Cross Hires"
      action={
        <Link href="/cross-hire" className="text-[11px] text-grey hover:text-brand-blue">View all</Link>
      }
    >
      {isLoading ? (
        <SkeletonRows count={5} />
      ) : sorted.length === 0 ? (
        <EmptyWidget>
          <Handshake className="h-5 w-5 text-grey mx-auto mb-2" />
          No active cross hires.
        </EmptyWidget>
      ) : (
        <div className="divide-y divide-grey-mid">
          {sorted.slice(0, 5).map((event) => {
            const total       = event.equipmentItems.length;
            const returned    = event.equipmentItems.filter((i) => i.returnedAt).length;
            const outstanding = total - returned;
            const endMs       = event.endDate ? new Date(event.endDate).getTime() : null;
            const isOverdue   = !!endMs && endMs < now;
            const daysOverdue = isOverdue && endMs ? Math.floor((now - endMs) / 86400000) : 0;

            return (
              <Link
                key={event.id}
                href={`/cross-hire/${event.id}`}
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-grey-light/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-surface-dark truncate">
                    {event.hireCustomer.productionName}
                  </div>
                  <div className="text-[11px] text-grey truncate">
                    {outstanding} of {total} on hire
                  </div>
                </div>
                {isOverdue ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-600 px-1.5 py-0.5 rounded whitespace-nowrap">
                    {daysOverdue}d overdue
                  </span>
                ) : (
                  <span className="text-[11px] text-grey whitespace-nowrap">
                    Due {formatShortDate(event.endDate)}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

function ProjectsWidget({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = trpc.project.list.useQuery({ workspaceId });

  const statusVariant: Record<string, BadgeProps["variant"]> = {
    active:   "available",
    wrapped:  "default",
    archived: "default",
  };

  return (
    <Widget
      title="Projects"
      action={
        <Link href="/projects" className="text-[11px] text-grey hover:text-brand-blue">View all</Link>
      }
    >
      {isLoading ? (
        <SkeletonRows count={4} />
      ) : !data || data.length === 0 ? (
        <EmptyWidget>
          <Film className="h-5 w-5 text-grey mx-auto mb-2" />
          No projects yet.
        </EmptyWidget>
      ) : (
        <div className="divide-y divide-grey-mid">
          {data.slice(0, 5).map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="flex items-center gap-3 px-5 py-2.5 hover:bg-grey-light/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-surface-dark truncate">{p.name}</div>
                {p.studio && (
                  <div className="text-[11px] text-grey truncate">{p.studio.name}</div>
                )}
              </div>
              <Badge variant={statusVariant[p.status] ?? "default"}>
                {p.status}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </Widget>
  );
}
