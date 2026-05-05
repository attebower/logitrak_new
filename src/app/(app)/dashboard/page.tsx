"use client";

/**
 * Dashboard — wired to live tRPC data.
 *
 * Layout:
 *   1. Five stat cards (top row)
 *   2. At-a-glance charts row — Status donut, 14-day activity chart, utilisation gauge
 *   3. Eight-widget 4×2 grid — Attention, Active Cross Hires, Activity Timeline,
 *      Most Used, Damage, Crew Leaderboard, Team, Projects
 */

import Link from "next/link";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { StatCard, StatGrid } from "@/components/shared/StatCard";
import { SkeletonRows } from "@/components/shared/SkeletonRows";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import type { BadgeProps } from "@/components/ui/badge";
import {
  LayoutDashboard, CheckCircle2, ArrowLeftRight, AlertTriangle,
  Handshake, TrendingUp, Film, Clock, ChevronRight, Activity,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────

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

function initials(name: string | null | undefined, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function formatShortDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// ── Page ──────────────────────────────────────────────────────────────────

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
        {/* Stat cards */}
        <StatGrid>
          <StatCard color="blue"   icon={<LayoutDashboard className="h-5 w-5" />} label="Total Assets" value={statsLoading ? "—" : (stats?.totalEquipment ?? 0)} />
          <StatCard color="green"  icon={<CheckCircle2    className="h-5 w-5" />} label="Available"    value={statsLoading ? "—" : (stats?.available     ?? 0)} />
          <StatCard color="blue"   icon={<ArrowLeftRight  className="h-5 w-5" />} label="Checked Out"  value={statsLoading ? "—" : (stats?.checkedOut    ?? 0)} />
          <StatCard color="red"    icon={<AlertTriangle   className="h-5 w-5" />} label="Damaged"      value={statsLoading ? "—" : (stats?.damaged       ?? 0)} changeColor="red" />
          <StatCard color="violet" icon={<Handshake       className="h-5 w-5" />} label="Cross Hired"  value={statsLoading ? "—" : (stats?.crossHired    ?? 0)} />
        </StatGrid>

        {/* At-a-glance charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <StatusBreakdownPanel className="lg:col-span-4" stats={stats} loading={statsLoading} />
          <ActivityChartPanel    className="lg:col-span-5" workspaceId={workspaceId} />
          <UtilizationPanel      className="lg:col-span-3" stats={stats} loading={statsLoading} />
        </div>

        {/* 4 × 2 widget grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-fr">
          <AttentionPanel        workspaceId={workspaceId} />
          <ActiveHiresPanel      workspaceId={workspaceId} />
          <ActivityTimelinePanel workspaceId={workspaceId} />
          <MostUsedPanel         workspaceId={workspaceId} />
          <DamagePanel           workspaceId={workspaceId} />
          <CrewLeaderboardPanel  workspaceId={workspaceId} />
          <TeamPanel             workspaceId={workspaceId} />
          <ProjectsPanel         workspaceId={workspaceId} />
        </div>
      </div>
    </>
  );
}

// ── Shells ────────────────────────────────────────────────────────────────

function Panel({
  title, action, children, className,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-white rounded-card border border-grey-mid shadow-card overflow-hidden flex flex-col", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-grey-mid px-5 py-3">
          <h2 className="text-[13px] font-semibold text-surface-dark">{title}</h2>
          {action}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-8 text-center text-[12px] text-grey">{children}</div>;
}

/**
 * Renders sample/dummy content with a small banner explaining that the
 * widget is showing a preview. Used when live data is empty so users can
 * see what each widget will look like before real data populates.
 */
function SamplePreview({ message, children }: { message: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-1.5 bg-brand-blue/[0.06] border-b border-brand-blue/15 text-[11px] text-brand-blue flex items-center gap-1.5 flex-shrink-0">
        <span className="font-semibold uppercase tracking-wider text-[10px]">Preview</span>
        <span className="text-grey">·</span>
        <span className="truncate">{message}</span>
      </div>
      <div className="opacity-60 pointer-events-none select-none flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// SkeletonRows now lives in src/components/shared/SkeletonRows.tsx

// ── Sample data (used when a widget has no live data yet) ────────────────

const SAMPLE_ATTENTION = [
  { kind: "overdue"  as const, title: "Stranger Things S5",      meta: "8 of 24 on hire · 3d overdue", href: "#" },
  { kind: "damage"   as const, title: "ARRI Alexa Mini #00041",  meta: "Reported by Sam",              href: "#" },
  { kind: "lowstock" as const, title: "Sennheiser MKH 416",      meta: "1 of 6 available",             href: "#" },
];
const SAMPLE_HIRES = [
  { id: "s1", name: "BBC Earth IV",       items: 18, returned:  6, due: "12 May", overdue: false, daysOverdue: 0 },
  { id: "s2", name: "Severance S2",       items: 32, returned: 18, due: "08 May", overdue: false, daysOverdue: 0 },
  { id: "s3", name: "Stranger Things S5", items: 24, returned: 16, due: "24 Apr", overdue: true,  daysOverdue: 3 },
];
const SAMPLE_ACTIVITY = [
  { who: "Sam Pickering", verbType: "check_in",      what: "ARRI Mini #00041",       when: "2m ago"  },
  { who: "Jess Owens",    verbType: "damage_report", what: "DJI Ronin 2 #00112",     when: "18m ago" },
  { who: "Sam Pickering", verbType: "check_out",     what: "Sennheiser MKH 416",     when: "1h ago"  },
  { who: "Tom Lin",       verbType: "equipment_add", what: "5× DZOFilm Vespid kit",  when: "2h ago"  },
];
const SAMPLE_MOST_USED = [
  { name: "Zoom F8n Pro",       count: 47 },
  { name: "Sennheiser MKH 416", count: 38 },
  { name: "ARRI Alexa Mini",    count: 34 },
  { name: "Aputure 600x Pro",   count: 29 },
];
const SAMPLE_DAMAGE_CATS = [
  { label: "Lenses",   value: 6 },
  { label: "Lighting", value: 4 },
  { label: "Cameras",  value: 3 },
  { label: "Audio",    value: 2 },
];
const SAMPLE_DAMAGE_TREND = [2, 1, 4, 3, 2, 5, 3, 1];
const SAMPLE_CREW = [
  { userId: "s1", name: "Sam Pickering", email: "sam@example.com",  checkOut: 38, checkIn: 31, total: 69 },
  { userId: "s2", name: "Jess Owens",    email: "jess@example.com", checkOut: 24, checkIn: 22, total: 46 },
  { userId: "s3", name: "Tom Lin",       email: "tom@example.com",  checkOut: 19, checkIn: 14, total: 33 },
  { userId: "s4", name: "Maya Chen",     email: "maya@example.com", checkOut: 11, checkIn:  9, total: 20 },
];
const SAMPLE_PROJECTS = [
  { id: "s1", name: "Stranger Things S5", studio: "Netflix",    status: "active"  as const },
  { id: "s2", name: "Severance S2",       studio: "Apple TV+",  status: "active"  as const },
  { id: "s3", name: "Top Boy S4",         studio: "Netflix",    status: "active"  as const },
  { id: "s4", name: "BBC Earth IV",       studio: "BBC Studios", status: "wrapped" as const },
];

// ════════════════════════════════════════════════════════════════════════════
//   CHARTS — pure inline SVG
// ════════════════════════════════════════════════════════════════════════════

function DonutChart({ data, size = 140, thickness = 22 }: {
  data: { label: string; value: number; color: string }[];
  size?: number; thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r     = (size - thickness) / 2;
  const cx    = size / 2;
  const cy    = size / 2;
  const circ  = 2 * Math.PI * r;

  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F4F5F8" strokeWidth={thickness} />
      {total > 0 && data.map((d, i) => {
        const len = (d.value / total) * circ;
        const dasharray = `${len} ${circ - len}`;
        const dashoffset = -offset;
        offset += len;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={d.color}
            strokeWidth={thickness}
            strokeDasharray={dasharray}
            strokeDashoffset={dashoffset}
          />
        );
      })}
    </svg>
  );
}

function StatusBreakdownPanel({ className, stats, loading }: {
  className?: string;
  stats: { available: number; checkedOut: number; crossHired: number; damaged: number } | undefined;
  loading: boolean;
}) {
  const liveData = [
    { label: "Available",   value: stats?.available  ?? 0, color: "#22C55E" },
    { label: "Checked Out", value: stats?.checkedOut ?? 0, color: "#3B82F6" },
    { label: "Cross Hired", value: stats?.crossHired ?? 0, color: "#8B5CF6" },
    { label: "Damaged",     value: stats?.damaged    ?? 0, color: "#EF4444" },
  ];
  const liveTotal = liveData.reduce((s, d) => s + d.value, 0);

  // Sample data when no equipment has been added yet
  const sampleData = [
    { label: "Available",   value: 612, color: "#22C55E" },
    { label: "Checked Out", value: 189, color: "#3B82F6" },
    { label: "Cross Hired", value:  35, color: "#8B5CF6" },
    { label: "Damaged",     value:  11, color: "#EF4444" },
  ];

  const isPreview = !loading && liveTotal === 0;
  const data  = isPreview ? sampleData : liveData;
  const total = data.reduce((s, d) => s + d.value, 0);

  const body = (
    <div className="px-5 py-4 flex items-center gap-4">
      <div className="relative flex-shrink-0">
        <DonutChart data={data} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-grey">Total</span>
          <span className="text-[22px] font-bold text-surface-dark leading-none mt-0.5">{total}</span>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5 min-w-0">
        {data.map((d) => {
          const pct = total === 0 ? 0 : Math.round((d.value / total) * 100);
          return (
            <li key={d.label} className="flex items-center gap-2 text-[12px]">
              <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
              <span className="text-surface-dark truncate flex-1">{d.label}</span>
              <span className="font-semibold text-surface-dark">{d.value}</span>
              <span className="text-grey w-9 text-right">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <Panel className={className} title="Status Breakdown">
      {loading ? (
        <SkeletonRows count={4} />
      ) : isPreview ? (
        <SamplePreview message="Add equipment to see your real status breakdown.">{body}</SamplePreview>
      ) : (
        body
      )}
    </Panel>
  );
}

function AreaLineChart({ series, labels, height = 160 }: {
  series: { name: string; values: number[]; color: string }[];
  labels: string[]; height?: number;
}) {
  const w = 600;
  const h = height;
  const padX = 12;
  const padTop = 10;
  const padBottom = 22;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const n   = labels.length;
  if (n < 2) return null;

  const xFor = (i: number) => padX + (i / (n - 1)) * (w - padX * 2);
  const yFor = (v: number) => padTop + (1 - v / max) * (h - padTop - padBottom);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {[0.25, 0.5, 0.75, 1].map((p, i) => (
        <line
          key={i}
          x1={padX} x2={w - padX}
          y1={padTop + p * (h - padTop - padBottom)}
          y2={padTop + p * (h - padTop - padBottom)}
          stroke="#E5E7EB" strokeWidth={1} strokeDasharray="3 3"
        />
      ))}
      {labels.map((l, i) =>
        i % 2 === 0 ? (
          <text key={i} x={xFor(i)} y={h - 6} fontSize={9} fill="#6B7280" textAnchor="middle">{l}</text>
        ) : null
      )}
      {series.map((s, idx) => {
        const linePts = s.values.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");
        const fillPath = `M ${xFor(0)} ${h - padBottom} L ${s.values.map((v, i) => `${xFor(i)} ${yFor(v)}`).join(" L ")} L ${xFor(n - 1)} ${h - padBottom} Z`;
        return (
          <g key={idx}>
            <path d={fillPath} fill={s.color} fillOpacity={0.12} />
            <polyline points={linePts} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => (
              <circle key={i} cx={xFor(i)} cy={yFor(v)} r={2.5} fill={s.color} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function ActivityChartPanel({ className, workspaceId }: { className?: string; workspaceId: string }) {
  const { data, isLoading } = trpc.dashboard.activitySeries.useQuery(
    { workspaceId },
    { refetchInterval: 60_000 }
  );

  const totalOut = data?.checkOut.reduce((s, n) => s + n, 0) ?? 0;
  const totalIn  = data?.checkIn.reduce((s, n) => s + n, 0) ?? 0;
  const isPreview = !isLoading && data != null && totalOut + totalIn === 0;

  // 14-day sample series
  const sampleLabels = data?.labels ?? Array.from({ length: 14 }, (_, i) => `${i + 1}`);
  const sampleOut    = [12, 18, 14, 22, 26, 19,  9,  7, 24, 31, 28, 22, 17, 23];
  const sampleIn     = [ 8, 14, 12, 17, 19, 16, 11,  6, 18, 22, 24, 19, 14, 18];

  const chart = (labels: string[], out: number[], inn: number[]) => (
    <div className="px-3 py-3">
      <AreaLineChart
        labels={labels}
        series={[
          { name: "Checked out", values: out, color: "#3B82F6" },
          { name: "Returned",    values: inn, color: "#22C55E" },
        ]}
      />
    </div>
  );

  return (
    <Panel
      className={className}
      title="Activity — last 14 days"
      action={
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-grey">
            <span className="h-2 w-2 rounded-full" style={{ background: "#3B82F6" }} />
            Out <strong className="text-surface-dark">{isPreview ? sampleOut.reduce((s,n)=>s+n,0) : totalOut}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-grey">
            <span className="h-2 w-2 rounded-full" style={{ background: "#22C55E" }} />
            In <strong className="text-surface-dark">{isPreview ? sampleIn.reduce((s,n)=>s+n,0) : totalIn}</strong>
          </span>
        </div>
      }
    >
      {isLoading || !data ? (
        <div className="px-5 py-8 text-center text-[12px] text-grey">Loading…</div>
      ) : isPreview ? (
        <SamplePreview message="Daily check-out and return activity will appear here.">
          {chart(sampleLabels, sampleOut, sampleIn)}
        </SamplePreview>
      ) : (
        chart(data.labels, data.checkOut, data.checkIn)
      )}
    </Panel>
  );
}

function GaugeChart({ pct, size = 140 }: { pct: number; size?: number }) {
  const r = (size - 18) / 2;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const circ = Math.PI * r;
  const filled = (pct / 100) * circ;
  return (
    <svg width={size} height={size / 1.6} viewBox={`0 0 ${size} ${size / 1.6}`}>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#F4F5F8" strokeWidth={14} strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#3B82F6" strokeWidth={14} strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
      />
    </svg>
  );
}

function UtilizationPanel({ className, stats, loading }: {
  className?: string;
  stats: { totalEquipment: number; available: number; checkedOut: number; crossHired: number; damaged: number } | undefined;
  loading: boolean;
}) {
  const liveInUse  = (stats?.checkedOut ?? 0) + (stats?.crossHired ?? 0);
  const liveActive = (stats?.totalEquipment ?? 0) - (stats?.damaged ?? 0);
  const livePct    = liveActive > 0 ? Math.round((liveInUse / liveActive) * 100) : 0;

  const isPreview = !loading && liveActive === 0;
  const inUse  = isPreview ? 224 : liveInUse;
  const active = isPreview ? 836 : liveActive;
  const pct    = isPreview ? 27  : livePct;

  const body = (
    <div className="px-5 py-4 flex flex-col items-center justify-center">
      <div className="relative">
        <GaugeChart pct={pct} />
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-[28px] font-bold text-surface-dark leading-none">{pct}%</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-grey mt-1">In use</span>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-grey text-center">
        {inUse} of {active} active assets currently out
      </div>
    </div>
  );

  return (
    <Panel className={className} title="Utilisation">
      {loading ? (
        <div className="px-5 py-8 text-center text-[12px] text-grey">Loading…</div>
      ) : isPreview ? (
        <SamplePreview message="Add equipment to track utilisation.">{body}</SamplePreview>
      ) : (
        body
      )}
    </Panel>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//   ATTENTION
// ════════════════════════════════════════════════════════════════════════════

const ATTN_STYLES: Record<string, { dot: string; pill: string; label: string }> = {
  overdue:  { dot: "bg-status-red",   pill: "bg-red-50    text-status-red border-red-100",     label: "Overdue"   },
  damage:   { dot: "bg-status-red",   pill: "bg-red-50    text-status-red border-red-100",     label: "Damage"    },
  lowstock: { dot: "bg-status-amber", pill: "bg-amber-50  text-amber-700 border-amber-100",    label: "Low stock" },
};

function AttentionPanel({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = trpc.dashboard.attention.useQuery(
    { workspaceId },
    { refetchInterval: 60_000 }
  );

  const isPreview = !isLoading && data != null && data.length === 0;
  const items     = isPreview ? SAMPLE_ATTENTION : (data ?? []);

  const list = (
    <div className="divide-y divide-grey-mid">
      {items.map((item, i) => {
        const s = ATTN_STYLES[item.kind];
        return (
          <Link
            key={i}
            href={item.href}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand-blue/[0.04] transition-colors group"
          >
            <span className={cn("h-2 w-2 rounded-full flex-shrink-0", s.dot)} />
            <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap", s.pill)}>
              {s.label}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-surface-dark truncate">{item.title}</div>
              <div className="text-[11px] text-grey truncate">{item.meta}</div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-grey-mid group-hover:text-brand-blue flex-shrink-0" />
          </Link>
        );
      })}
    </div>
  );

  return (
    <Panel
      title="Needs Attention"
      action={
        data && data.length > 0 ? (
          <span className="text-[11px] font-semibold text-status-red bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
            {data.length} {data.length === 1 ? "item" : "items"}
          </span>
        ) : null
      }
    >
      {isLoading ? (
        <SkeletonRows count={5} />
      ) : isPreview ? (
        <SamplePreview message="Overdue hires, damage and low stock will surface here.">{list}</SamplePreview>
      ) : (
        list
      )}
    </Panel>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//   ACTIVE CROSS HIRES
// ════════════════════════════════════════════════════════════════════════════

function ActiveHiresPanel({ workspaceId }: { workspaceId: string }) {
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

  const isPreview = !isLoading && sorted.length === 0;

  // Render a row from either live or sample data
  type Row = { id: string; name: string; total: number; returned: number; due: string; isOverdue: boolean; daysOverdue: number };
  const rows: Row[] = isPreview
    ? SAMPLE_HIRES.map((s) => ({
        id: s.id, name: s.name, total: s.items, returned: s.returned, due: s.due, isOverdue: s.overdue, daysOverdue: s.daysOverdue,
      }))
    : sorted.slice(0, 5).map((event) => {
        const total    = event.equipmentItems.length;
        const returned = event.equipmentItems.filter((i) => i.returnedAt).length;
        const endMs    = event.endDate ? new Date(event.endDate).getTime() : null;
        const isOver   = !!endMs && endMs < now;
        return {
          id:          event.id,
          name:        event.hireCustomer.productionName,
          total, returned,
          due:         formatShortDate(event.endDate),
          isOverdue:   isOver,
          daysOverdue: isOver && endMs ? Math.floor((now - endMs) / 86400000) : 0,
        };
      });

  const list = (
    <div className="divide-y divide-grey-mid">
      {rows.map((r) => {
        const pct = r.total === 0 ? 0 : Math.round((r.returned / r.total) * 100);
        return (
          <Link
            key={r.id}
            href={isPreview ? "#" : `/cross-hire/${r.id}`}
            className="block px-4 py-3 hover:bg-brand-blue/[0.04] transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-surface-dark truncate">{r.name}</div>
                <div className="text-[11px] text-grey">{r.returned} of {r.total} returned · {pct}%</div>
              </div>
              {r.isOverdue ? (
                <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-600 px-1.5 py-0.5 rounded whitespace-nowrap">
                  {r.daysOverdue}d overdue
                </span>
              ) : (
                <span className="text-[11px] text-grey whitespace-nowrap flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Due {r.due}
                </span>
              )}
            </div>
            <div className="h-1.5 w-full rounded-full bg-grey-light overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  r.isOverdue ? "bg-status-red" : pct === 100 ? "bg-status-green" : "bg-violet-500"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );

  return (
    <Panel
      title="Active Cross Hires"
      action={
        <Link href="/cross-hire" className="text-[11px] text-grey hover:text-brand-blue flex items-center gap-1">
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      }
    >
      {isLoading ? (
        <SkeletonRows count={4} />
      ) : isPreview ? (
        <SamplePreview message="Cross hires will appear here once you create them.">{list}</SamplePreview>
      ) : (
        list
      )}
    </Panel>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//   ACTIVITY TIMELINE
// ════════════════════════════════════════════════════════════════════════════

function ActivityTimelinePanel({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = trpc.activity.list.useQuery(
    { workspaceId, limit: 6 },
    { refetchInterval: 30_000 }
  );

  const isPreview = !isLoading && data != null && data.length === 0;

  type Row = { key: string; who: string; eventType: string; what: string | null; when: string };
  const rows: Row[] = isPreview
    ? SAMPLE_ACTIVITY.map((a, i) => ({ key: `s${i}`, who: a.who, eventType: a.verbType, what: a.what, when: a.when }))
    : (data ?? []).map((a) => ({
        key:       a.id,
        who:       a.actor?.displayName ?? a.actor?.email ?? "System",
        eventType: a.eventType,
        what:      a.equipmentName ?? null,
        when:      relativeTime(a.createdAt),
      }));

  const timeline = (
    <div className="px-4 py-2">
      <ol className="relative">
        {rows.map((a, i) => (
          <li key={a.key} className="flex gap-3 py-1.5">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="h-7 w-7 rounded-full bg-brand-blue/10 flex items-center justify-center text-[10px] font-semibold text-brand-blue">
                {initials(a.who, a.who)}
              </div>
              {i < rows.length - 1 && <div className="flex-1 w-px bg-grey-mid mt-1" />}
            </div>
            <div className="flex-1 min-w-0 pb-1.5">
              <div className="text-[12px] text-surface-dark leading-snug">
                <span className="font-semibold">{a.who}</span>{" "}
                <span className={cn("font-medium", eventVerbColor(a.eventType))}>
                  {eventActionLabel(a.eventType)}
                </span>
                {a.what && <> <span>{a.what}</span></>}
              </div>
              <div className="text-[10px] text-grey mt-0.5">{a.when}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <Panel
      title="Recent Activity"
      action={<Activity className="h-4 w-4 text-grey" />}
    >
      {isLoading ? (
        <SkeletonRows count={5} />
      ) : isPreview ? (
        <SamplePreview message="Check-outs, returns and damage reports will stream in here.">{timeline}</SamplePreview>
      ) : (
        timeline
      )}
    </Panel>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//   MOST USED
// ════════════════════════════════════════════════════════════════════════════

function MostUsedPanel({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = trpc.dashboard.mostUsed.useQuery(
    { workspaceId, window: "30d", limit: 5 },
    { refetchInterval: 60_000 }
  );

  const isPreview = !isLoading && data != null && data.length === 0;
  const items = isPreview
    ? SAMPLE_MOST_USED.map((s) => ({ key: s.name, name: s.name, count: s.count }))
    : (data ?? []);
  const max = Math.max(1, ...items.map((m) => m.count));

  const list = (
    <div className="px-4 py-3 space-y-2.5">
      {items.map((item) => {
        const pct = Math.round((item.count / max) * 100);
        return (
          <div key={item.key}>
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="font-medium text-surface-dark truncate">{item.name}</span>
              <span className="text-grey ml-2 flex-shrink-0">{item.count}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-grey-light overflow-hidden">
              <div className="h-full bg-brand-blue rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <Panel title="Most Used — 30d" action={<TrendingUp className="h-4 w-4 text-grey" />}>
      {isLoading ? (
        <SkeletonRows count={5} />
      ) : isPreview ? (
        <SamplePreview message="Top items will rank by checkout count.">{list}</SamplePreview>
      ) : (
        list
      )}
    </Panel>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//   DAMAGE — combined trend + by-category breakdown
// ════════════════════════════════════════════════════════════════════════════

const DAMAGE_PALETTE = ["#EF4444", "#F59E0B", "#8B5CF6", "#3B82F6", "#22C55E", "#EC4899", "#14B8A6"];

function Sparkline({ values, color = "#EF4444", width = 80, height = 24 }: {
  values: number[]; color?: string; width?: number; height?: number;
}) {
  if (values.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const n = values.length;
  const xFor = (i: number) => (i / (n - 1)) * width;
  const yFor = (v: number) => height - ((v - min) / range) * (height - 2) - 1;
  const pts = values.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");
  const fillPath = `M 0 ${height} L ${values.map((v, i) => `${xFor(i)} ${yFor(v)}`).join(" L ")} L ${width} ${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <path d={fillPath} fill={color} fillOpacity={0.12} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xFor(n - 1)} cy={yFor(values[n - 1])} r={2} fill={color} />
    </svg>
  );
}

function DamagePanel({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = trpc.dashboard.damageBreakdown.useQuery(
    { workspaceId },
    { refetchInterval: 60_000 }
  );

  if (isLoading || !data) {
    return (
      <Panel title="Damage">
        <SkeletonRows count={4} />
      </Panel>
    );
  }

  const liveTotal = data.byCategory.reduce((s, d) => s + d.value, 0);
  const live8     = data.weeklyTrend.reduce((s, n) => s + n, 0);
  const isPreview = liveTotal === 0 && live8 === 0;

  const cats  = isPreview ? SAMPLE_DAMAGE_CATS : data.byCategory;
  const trend = isPreview ? SAMPLE_DAMAGE_TREND : data.weeklyTrend;

  const totalOpen = cats.reduce((s, d) => s + d.value, 0);
  const last8     = trend.reduce((s, n) => s + n, 0);
  const lastWk    = trend[trend.length - 1] ?? 0;
  const prevWk    = trend[trend.length - 2] ?? 0;
  const delta     = lastWk - prevWk;

  const coloured = cats.map((d, i) => ({ ...d, color: DAMAGE_PALETTE[i % DAMAGE_PALETTE.length] }));

  const body = (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-grey">Currently open</div>
          <div className="text-[24px] font-bold text-surface-dark leading-none mt-0.5">{totalOpen}</div>
        </div>
        <div className="flex flex-col items-end">
          <Sparkline values={trend} />
          <div className="text-[10px] text-grey mt-0.5">{last8} reports · 8wk</div>
        </div>
      </div>

      {totalOpen > 0 && (
        <>
          <div className="flex h-2 w-full rounded-full overflow-hidden bg-grey-light">
            {coloured.map((d) => (
              <div
                key={d.label}
                style={{ width: `${(d.value / totalOpen) * 100}%`, background: d.color }}
                title={`${d.label}: ${d.value}`}
              />
            ))}
          </div>
          <ul className="space-y-1">
            {coloured.map((d) => (
              <li key={d.label} className="flex items-center gap-2 text-[11px]">
                <span className="h-2 w-2 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                <span className="text-surface-dark truncate flex-1">{d.label}</span>
                <span className="font-semibold text-surface-dark">{d.value}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );

  return (
    <Panel
      title="Damage"
      action={
        <span className={cn(
          "text-[11px] font-semibold px-1.5 py-0.5 rounded",
          delta > 0 ? "text-status-red bg-red-50" : delta < 0 ? "text-status-green bg-green-50" : "text-grey bg-grey-light"
        )}>
          {delta > 0 ? `↑ +${delta}` : delta < 0 ? `↓ ${delta}` : `±0`} vs last wk
        </span>
      }
    >
      {isPreview ? (
        <SamplePreview message="Damage trends and categories will populate here.">{body}</SamplePreview>
      ) : (
        body
      )}
    </Panel>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//   CREW LEADERBOARD
// ════════════════════════════════════════════════════════════════════════════

function CrewLeaderboardPanel({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = trpc.dashboard.crewLeaderboard.useQuery(
    { workspaceId, limit: 5 },
    { refetchInterval: 60_000 }
  );

  const isPreview = !isLoading && data != null && data.length === 0;
  const crew = isPreview ? SAMPLE_CREW : (data ?? []);
  const max = Math.max(1, ...crew.map((c) => c.total));
  const totalActions = crew.reduce((s, c) => s + c.total, 0);

  const list = (
    <div className="px-4 py-3 space-y-2">
      {crew.map((c, i) => {
        const rankColor =
          i === 0 ? "bg-amber-100 text-amber-700 border-amber-200" :
          i === 1 ? "bg-grey-light text-surface-dark border-grey-mid" :
          i === 2 ? "bg-orange-50 text-orange-700 border-orange-100" :
                    "bg-white text-grey border-grey-mid";
        return (
          <div key={c.userId} className="flex items-center gap-2.5">
            <div className={cn(
              "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0",
              rankColor
            )}>
              {i + 1}
            </div>
            <div className="h-7 w-7 rounded-full bg-brand-blue/10 flex items-center justify-center text-[10px] font-semibold text-brand-blue flex-shrink-0">
              {initials(c.name, c.email)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span className="font-medium text-surface-dark truncate">{c.name ?? c.email}</span>
                <span className="text-grey ml-2 flex-shrink-0 font-semibold">{c.total}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-grey-light overflow-hidden flex">
                <div className="h-full bg-brand-blue" style={{ width: `${(c.checkOut / max) * 100}%` }} title={`${c.checkOut} check-outs`} />
                <div className="h-full bg-status-green" style={{ width: `${(c.checkIn / max) * 100}%` }} title={`${c.checkIn} returns`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <Panel
      title="Crew Leaderboard"
      action={
        <span className="text-[11px] text-grey">
          <strong className="text-surface-dark">{totalActions}</strong> actions · 30d
        </span>
      }
    >
      {isLoading ? (
        <SkeletonRows count={5} />
      ) : isPreview ? (
        <SamplePreview message="Crew check-out / return activity ranks here.">{list}</SamplePreview>
      ) : (
        list
      )}
    </Panel>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//   TEAM
// ════════════════════════════════════════════════════════════════════════════

function TeamPanel({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = trpc.team.list.useQuery({ workspaceId });

  return (
    <Panel
      title="Team"
      action={<Link href="/team" className="text-[11px] text-grey hover:text-brand-blue">Manage</Link>}
    >
      {isLoading ? (
        <SkeletonRows count={4} />
      ) : !data || data.length === 0 ? (
        <EmptyState>No members yet.</EmptyState>
      ) : (
        <div className="divide-y divide-grey-mid">
          {data.slice(0, 5).map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 px-4 py-2">
              <div className="h-7 w-7 rounded-full bg-brand-blue/10 flex items-center justify-center text-[10px] font-semibold text-brand-blue flex-shrink-0">
                {initials(m.user.displayName, m.user.email)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-surface-dark truncate">
                  {m.user.displayName ?? m.user.email}
                </div>
                {m.user.displayName && (
                  <div className="text-[10px] text-grey truncate">{m.user.email}</div>
                )}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-grey">
                {m.role.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//   PROJECTS
// ════════════════════════════════════════════════════════════════════════════

function ProjectsPanel({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = trpc.project.list.useQuery({ workspaceId });

  const statusVariant: Record<string, BadgeProps["variant"]> = {
    active:   "available",
    wrapped:  "default",
    archived: "default",
  };

  const isPreview = !isLoading && data != null && data.length === 0;

  type Row = { id: string; name: string; studio: string | null; status: string };
  const rows: Row[] = isPreview
    ? SAMPLE_PROJECTS.map((p) => ({ id: p.id, name: p.name, studio: p.studio, status: p.status }))
    : (data ?? []).slice(0, 5).map((p) => ({
        id: p.id, name: p.name, studio: p.studio?.name ?? null, status: p.status,
      }));

  const list = (
    <div className="divide-y divide-grey-mid">
      {rows.map((p) => (
        <Link
          key={p.id}
          href={isPreview ? "#" : `/projects/${p.id}`}
          className="flex items-center gap-2.5 px-4 py-2 hover:bg-brand-blue/[0.04] transition-colors"
        >
          <div className="h-7 w-7 rounded-[6px] bg-grey-light flex items-center justify-center flex-shrink-0">
            <Film className="h-3.5 w-3.5 text-grey" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-surface-dark truncate">{p.name}</div>
            {p.studio && (
              <div className="text-[10px] text-grey truncate">{p.studio}</div>
            )}
          </div>
          <Badge variant={statusVariant[p.status] ?? "default"}>{p.status}</Badge>
        </Link>
      ))}
    </div>
  );

  return (
    <Panel
      title="Projects"
      action={<Link href="/projects" className="text-[11px] text-grey hover:text-brand-blue">View all</Link>}
    >
      {isLoading ? (
        <SkeletonRows count={4} />
      ) : isPreview ? (
        <SamplePreview message="Productions and shows you create will list here.">{list}</SamplePreview>
      ) : (
        list
      )}
    </Panel>
  );
}
