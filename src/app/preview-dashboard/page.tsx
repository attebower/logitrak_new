/**
 * Preview: redesigned dashboard layout (v2 — with sidebar + charts).
 *
 * Top 5 stat cards stay identical to the current dashboard.
 * Everything below is redesigned into a denser, more visual command-centre
 * layout with charts (donut, area, gauge, bar, sparkline).
 *
 * Public route — uses mock data so it can be reviewed without signing in.
 * Shows the real AppSidebar so the full screen feels right.
 */

"use client";

import Link from "next/link";
import { AppSidebar } from "@/components/shared/AppSidebar";
import type { NavSection } from "@/components/shared/AppSidebar";
import { StatCard, StatGrid } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, CheckCircle2, ArrowLeftRight, AlertTriangle,
  ArrowRight, RotateCcw, Plus, List, Handshake,
  TrendingUp, Film, Clock, ChevronRight, Activity,
  FileText, Users, Settings, Clapperboard, Tag as TagIcon,
} from "lucide-react";

// ── Sidebar wiring (mirrors the real app/(app)/layout.tsx) ────────────────

const Tag = TagIcon;

const NAV_SECTIONS: NavSection[] = [
  { label: "Main", items: [
    { label: "Dashboard",  href: "/preview-dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Projects",   href: "/projects",          icon: <Clapperboard className="h-4 w-4" /> },
  ]},
  { label: "Track Kit", items: [
    { label: "Issue",      href: "/issue",             icon: <ArrowRight className="h-4 w-4" /> },
    { label: "Return",     href: "/return",            icon: <RotateCcw className="h-4 w-4" /> },
    { label: "Cross Hire", href: "/cross-hire",        icon: <Handshake className="h-4 w-4" /> },
  ]},
  { label: "Equipment", items: [
    { label: "Equipment Register", href: "/equipment",     icon: <List className="h-4 w-4" /> },
    { label: "Add Equipment",      href: "/equipment/new", icon: <Plus className="h-4 w-4" /> },
  ]},
  { label: "Labels", items: [
    { label: "Generate Labels", href: "/equipment/labels", icon: <Tag className="h-4 w-4" /> },
  ]},
  { label: "Monitor", items: [
    { label: "Reports", href: "/reports", icon: <FileText className="h-4 w-4" /> },
    { label: "Damage",  href: "/damage",  icon: <AlertTriangle className="h-4 w-4" /> },
  ]},
  { label: "Manage", items: [
    { label: "Team",      href: "/team",      icon: <Users className="h-4 w-4" /> },
    { label: "Settings",  href: "/settings",  icon: <Settings className="h-4 w-4" /> },
  ]},
];

// ── Mock data ─────────────────────────────────────────────────────────────

const ATTENTION_ITEMS = [
  { kind: "overdue",  title: "Stranger Things S5",   meta: "8 items · 3d overdue",   href: "#" },
  { kind: "damage",   title: "ARRI Alexa Mini #00041", meta: "Damage reported by Sam", href: "#" },
  { kind: "lowstock", title: "Sennheiser MKH 416",   meta: "1 of 6 available",       href: "#" },
  { kind: "overdue",  title: "Top Boy S4",           meta: "12 items · 1d overdue",  href: "#" },
  { kind: "damage",   title: "DJI Ronin 2 #00112",   meta: "Damage reported by Jess", href: "#" },
  { kind: "lowstock", title: "Aputure 600x Pro",     meta: "0 of 4 available",       href: "#" },
] as const;

const ACTIVE_HIRES = [
  { name: "BBC Earth IV",        items: 18, returned:  6, due: "12 May",  overdue: false },
  { name: "Apple TV — Severance", items: 32, returned: 18, due: "08 May",  overdue: false },
  { name: "Stranger Things S5",  items: 24, returned: 16, due: "24 Apr",  overdue: true,  daysOverdue: 3 },
  { name: "Top Boy S4",          items: 12, returned:  0, due: "26 Apr",  overdue: true,  daysOverdue: 1 },
] as const;

const ACTIVITY = [
  { who: "Sam Pickering",  verb: "returned",         what: "ARRI Mini #00041",        when: "2m ago", color: "text-status-green" },
  { who: "Jess Owens",     verb: "reported damage",  what: "DJI Ronin 2 #00112",      when: "18m ago", color: "text-status-red" },
  { who: "Sam Pickering",  verb: "checked out",      what: "Sennheiser MKH 416",      when: "1h ago",  color: "text-brand-blue" },
  { who: "Tom Lin",        verb: "added",            what: "5 × DZOFilm Vespid kit",  when: "2h ago",  color: "text-brand-blue" },
  { who: "System",         verb: "marked repaired",  what: "Aputure 600x #003",       when: "3h ago",  color: "text-status-teal" },
  { who: "Jess Owens",     verb: "returned",         what: "Atomos Sumo 19",          when: "4h ago",  color: "text-status-green" },
] as const;

const MOST_USED = [
  { name: "Zoom F8n Pro",          count: 47 },
  { name: "Sennheiser MKH 416",    count: 38 },
  { name: "ARRI Alexa Mini",       count: 34 },
  { name: "Aputure 600x Pro",      count: 29 },
  { name: "DJI Ronin 2",           count: 21 },
] as const;

const TEAM = [
  { name: "Sam Pickering", email: "sam@mcc-es.co.uk",  role: "Owner",   initials: "SP" },
  { name: "Jess Owens",    email: "jess@mcc-es.co.uk", role: "Manager", initials: "JO" },
  { name: "Tom Lin",       email: "tom@mcc-es.co.uk",  role: "Crew",    initials: "TL" },
  { name: "Maya Chen",     email: "maya@mcc-es.co.uk", role: "Crew",    initials: "MC" },
] as const;

const PROJECTS = [
  { name: "Stranger Things S5",  studio: "Netflix",     status: "active" as const },
  { name: "Severance S2",        studio: "Apple TV+",   status: "active" as const },
  { name: "Top Boy S4",          studio: "Netflix",     status: "active" as const },
  { name: "BBC Earth IV",        studio: "BBC Studios", status: "wrapped" as const },
] as const;

// 14-day check-out / check-in series (mock)
const ACTIVITY_SERIES = {
  labels:    ["Apr 14","15","16","17","18","19","20","21","22","23","24","25","26","27"],
  checkOut:  [12, 18, 14, 22, 26, 19,  9,  7, 24, 31, 28, 22, 17, 23],
  checkIn:   [ 8, 14, 12, 17, 19, 16, 11,  6, 18, 22, 24, 19, 14, 18],
};

// Damage reports per week (mock)
const DAMAGE_BARS = [2, 1, 4, 3, 2, 5, 3, 1];

// Damage by category (mock)
const DAMAGE_BY_CATEGORY = [
  { label: "Lenses",   value: 6, color: "#EF4444" },
  { label: "Lighting", value: 4, color: "#F59E0B" },
  { label: "Cameras",  value: 3, color: "#8B5CF6" },
  { label: "Audio",    value: 2, color: "#3B82F6" },
  { label: "Grip",     value: 2, color: "#22C55E" },
];

// Crew leaderboard — checkouts this month (mock)
const CREW_LEADERBOARD = [
  { name: "Sam Pickering", initials: "SP", checkOut: 38, checkIn: 31, total: 69 },
  { name: "Jess Owens",    initials: "JO", checkOut: 24, checkIn: 22, total: 46 },
  { name: "Tom Lin",       initials: "TL", checkOut: 19, checkIn: 14, total: 33 },
  { name: "Maya Chen",     initials: "MC", checkOut: 11, checkIn:  9, total: 20 },
  { name: "Alex Reed",     initials: "AR", checkOut:  6, checkIn:  4, total: 10 },
] as const;

// Status breakdown for donut (matches the 5 stat cards)
const STATUS_BREAKDOWN = [
  { label: "Available",   value: 612, color: "#22C55E" },
  { label: "Checked Out", value: 189, color: "#3B82F6" },
  { label: "Cross Hired", value:  35, color: "#8B5CF6" },
  { label: "Damaged",     value:  11, color: "#EF4444" },
];

// ── Page ──────────────────────────────────────────────────────────────────

export default function PreviewDashboardPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        sections={NAV_SECTIONS}
        user={{ initials: "MM", name: "matt@mcc-es.co.uk", role: "Owner" }}
        deptLabel="MCC Equipment"
      />

      <main className="flex-1 overflow-hidden flex flex-col bg-grey-light">
        {/* Mock topbar */}
        <div className="h-14 border-b border-grey-mid bg-white px-6 flex items-center gap-3 flex-shrink-0">
          <h1 className="text-[15px] font-semibold text-surface-dark">Dashboard</h1>
          <span className="text-grey-mid">·</span>
          <span className="text-[12px] text-grey">MCC Equipment</span>
          <span className="ml-auto text-[11px] font-semibold text-brand-blue uppercase tracking-wider bg-brand-blue/10 px-2 py-0.5 rounded">
            Preview · v2 with charts
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ── Stat cards (UNCHANGED) ─────────────────────────────── */}
          <StatGrid>
            <StatCard color="blue"   icon={<LayoutDashboard className="h-5 w-5" />} label="Total Assets" value={847} />
            <StatCard color="green"  icon={<CheckCircle2    className="h-5 w-5" />} label="Available"    value={612} />
            <StatCard color="blue"   icon={<ArrowLeftRight  className="h-5 w-5" />} label="Checked Out"  value={189} />
            <StatCard color="red"    icon={<AlertTriangle   className="h-5 w-5" />} label="Damaged"      value={11}  changeColor="red" />
            <StatCard color="violet" icon={<Handshake       className="h-5 w-5" />} label="Cross Hired"  value={35}  />
          </StatGrid>

          {/* ── Row: AT-A-GLANCE charts ────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <StatusBreakdownPanel className="lg:col-span-4" />
            <ActivityChartPanel    className="lg:col-span-5" />
            <UtilizationPanel      className="lg:col-span-3" />
          </div>

          {/* ── 4 × 2 widget grid (8 widgets) ─────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-fr">
            <AttentionPanel />
            <ActiveHiresPanel />
            <ActivityTimelinePanel />
            <MostUsedPanel />
            <DamagePanel />
            <CrewLeaderboardPanel />
            <TeamPanel />
            <ProjectsPanel />
          </div>

          {/* ── Notes ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-card border border-grey-mid px-5 py-4 text-[12px] text-grey">
            <strong className="text-surface-dark">Design notes:</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><strong>New chart row:</strong> Status donut, 14-day activity area chart, utilisation gauge — gives an at-a-glance feel directly under the stat cards.</li>
              <li><strong>4 × 2 widget grid below:</strong> equal-sized panels — Attention, Active Hires, Activity, Most Used, Damage Trend, Team, Projects (one slot empty for now).</li>
              <li><strong>Visual extras:</strong> progress bars on cross hires, mini bar chart for damage trend, horizontal bars for Most Used.</li>
              <li>Charts are pure inline SVG — no chart library, so no extra dependencies.</li>
              <li>All data here is mocked. Tell me which sections to keep / drop / restyle.</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Shared shells ─────────────────────────────────────────────────────────

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
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//   CHARTS — pure inline SVG, no dependencies
// ════════════════════════════════════════════════════════════════════════════

// ── Donut chart ───────────────────────────────────────────────────────────

function DonutChart({ data, size = 140, thickness = 22 }: {
  data: { label: string; value: number; color: string }[];
  size?: number; thickness?: number;
}) {
  const total  = data.reduce((s, d) => s + d.value, 0);
  const r      = (size - thickness) / 2;
  const cx     = size / 2;
  const cy     = size / 2;
  const circ   = 2 * Math.PI * r;

  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F4F5F8" strokeWidth={thickness} />
      {data.map((d, i) => {
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
            strokeLinecap="butt"
          />
        );
      })}
    </svg>
  );
}

function StatusBreakdownPanel({ className }: { className?: string }) {
  const total = STATUS_BREAKDOWN.reduce((s, d) => s + d.value, 0);
  return (
    <Panel className={className} title="Status Breakdown">
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <DonutChart data={STATUS_BREAKDOWN} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-grey">Total</span>
            <span className="text-[22px] font-bold text-surface-dark leading-none mt-0.5">{total}</span>
          </div>
        </div>
        <ul className="flex-1 space-y-1.5 min-w-0">
          {STATUS_BREAKDOWN.map((d) => {
            const pct = Math.round((d.value / total) * 100);
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
    </Panel>
  );
}

// ── Area / Line chart ─────────────────────────────────────────────────────

function AreaLineChart({ series, labels, height = 160 }: {
  series: { name: string; values: number[]; color: string }[];
  labels: string[]; height?: number;
}) {
  const w = 600;
  const h = height;
  const padX = 12;
  const padTop = 10;
  const padBottom = 22;
  const max = Math.max(...series.flatMap((s) => s.values));
  const n   = labels.length;

  const xFor = (i: number) => padX + (i / (n - 1)) * (w - padX * 2);
  const yFor = (v: number) => padTop + (1 - v / max) * (h - padTop - padBottom);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {/* Gridlines */}
      {[0.25, 0.5, 0.75, 1].map((p, i) => (
        <line
          key={i}
          x1={padX} x2={w - padX}
          y1={padTop + p * (h - padTop - padBottom)}
          y2={padTop + p * (h - padTop - padBottom)}
          stroke="#E5E7EB" strokeWidth={1} strokeDasharray="3 3"
        />
      ))}

      {/* X-axis labels */}
      {labels.map((l, i) =>
        i % 2 === 0 ? (
          <text key={i} x={xFor(i)} y={h - 6} fontSize={9} fill="#6B7280" textAnchor="middle">{l}</text>
        ) : null
      )}

      {/* Series */}
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

function ActivityChartPanel({ className }: { className?: string }) {
  const totalOut = ACTIVITY_SERIES.checkOut.reduce((s, n) => s + n, 0);
  const totalIn  = ACTIVITY_SERIES.checkIn.reduce((s, n) => s + n, 0);
  return (
    <Panel
      className={className}
      title="Activity — last 14 days"
      action={
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-grey">
            <span className="h-2 w-2 rounded-full" style={{ background: "#3B82F6" }} />
            Out <strong className="text-surface-dark">{totalOut}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-grey">
            <span className="h-2 w-2 rounded-full" style={{ background: "#22C55E" }} />
            In <strong className="text-surface-dark">{totalIn}</strong>
          </span>
        </div>
      }
    >
      <div className="px-3 py-3">
        <AreaLineChart
          labels={ACTIVITY_SERIES.labels}
          series={[
            { name: "Checked out", values: [...ACTIVITY_SERIES.checkOut], color: "#3B82F6" },
            { name: "Returned",    values: [...ACTIVITY_SERIES.checkIn],  color: "#22C55E" },
          ]}
        />
      </div>
    </Panel>
  );
}

// ── Utilisation gauge ─────────────────────────────────────────────────────

function GaugeChart({ pct, size = 140 }: { pct: number; size?: number }) {
  // Half-circle gauge from -90° to +90°
  const r = (size - 18) / 2;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const circ = Math.PI * r; // half-circumference
  const filled = (pct / 100) * circ;

  return (
    <svg width={size} height={size / 1.6} viewBox={`0 0 ${size} ${size / 1.6}`}>
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#F4F5F8" strokeWidth={14} strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#3B82F6" strokeWidth={14} strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
      />
    </svg>
  );
}

function UtilizationPanel({ className }: { className?: string }) {
  // 189 checked out + 35 cross hired = 224 in use
  // 224 / (847 - 11 damaged) = ~ 26.8% — not great as a "utilisation" demo
  // Use a punchier mock for visual impact.
  const pct = 64;
  return (
    <Panel className={className} title="Utilisation">
      <div className="px-5 py-4 flex flex-col items-center justify-center">
        <div className="relative">
          <GaugeChart pct={pct} />
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <span className="text-[28px] font-bold text-surface-dark leading-none">{pct}%</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-grey mt-1">In use</span>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-grey text-center">
          224 of 836 active assets currently out
        </div>
      </div>
    </Panel>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//   ROW — Attention + Quick Actions
// ════════════════════════════════════════════════════════════════════════════

const ATTN_STYLES: Record<string, { dot: string; pill: string; label: string }> = {
  overdue:  { dot: "bg-status-red",   pill: "bg-red-50    text-status-red border-red-100",     label: "Overdue"   },
  damage:   { dot: "bg-status-red",   pill: "bg-red-50    text-status-red border-red-100",     label: "Damage"    },
  lowstock: { dot: "bg-status-amber", pill: "bg-amber-50  text-amber-700 border-amber-100",    label: "Low stock" },
};

function AttentionPanel({ className }: { className?: string }) {
  return (
    <Panel
      className={className}
      title="Needs Attention"
      action={
        <span className="text-[11px] font-semibold text-status-red bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
          {ATTENTION_ITEMS.length} items
        </span>
      }
    >
      <div className="divide-y divide-grey-mid">
        {ATTENTION_ITEMS.map((item, i) => {
          const s = ATTN_STYLES[item.kind];
          return (
            <Link
              key={i}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-grey-light/50 transition-colors group"
            >
              <span className={cn("h-2 w-2 rounded-full flex-shrink-0", s.dot)} />
              <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap", s.pill)}>
                {s.label}
              </span>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-[12px] font-medium text-surface-dark truncate">{item.title}</span>
                <span className="text-grey-mid">·</span>
                <span className="text-[11px] text-grey truncate">{item.meta}</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-grey-mid group-hover:text-brand-blue flex-shrink-0" />
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//   ROW — Active Cross Hires + Activity Timeline
// ════════════════════════════════════════════════════════════════════════════

function ActiveHiresPanel({ className }: { className?: string }) {
  return (
    <Panel
      className={className}
      title="Active Cross Hires"
      action={
        <Link href="/cross-hire" className="text-[11px] text-grey hover:text-brand-blue flex items-center gap-1">
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      }
    >
      <div className="divide-y divide-grey-mid">
        {ACTIVE_HIRES.map((h, i) => {
          const pct = Math.round((h.returned / h.items) * 100);
          return (
            <div key={i} className="px-4 py-3 hover:bg-grey-light/40 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-surface-dark truncate">{h.name}</div>
                  <div className="text-[11px] text-grey">
                    {h.returned} of {h.items} returned · {pct}%
                  </div>
                </div>
                {h.overdue ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-600 px-1.5 py-0.5 rounded whitespace-nowrap">
                    {h.daysOverdue}d overdue
                  </span>
                ) : (
                  <span className="text-[11px] text-grey whitespace-nowrap flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Due {h.due}
                  </span>
                )}
              </div>
              <div className="h-1.5 w-full rounded-full bg-grey-light overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    h.overdue ? "bg-status-red" : pct === 100 ? "bg-status-green" : "bg-violet-500"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function ActivityTimelinePanel({ className }: { className?: string }) {
  return (
    <Panel
      className={className}
      title="Recent Activity"
      action={<Activity className="h-4 w-4 text-grey" />}
    >
      <div className="px-4 py-2">
        <ol className="relative">
          {ACTIVITY.map((a, i) => (
            <li key={i} className="flex gap-3 py-1.5">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="h-7 w-7 rounded-full bg-brand-blue/10 flex items-center justify-center text-[10px] font-semibold text-brand-blue">
                  {a.who.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                {i < ACTIVITY.length - 1 && <div className="flex-1 w-px bg-grey-mid mt-1" />}
              </div>
              <div className="flex-1 min-w-0 pb-1.5">
                <div className="text-[12px] text-surface-dark leading-snug">
                  <span className="font-semibold">{a.who}</span>{" "}
                  <span className={cn("font-medium", a.color)}>{a.verb}</span>{" "}
                  <span className="text-surface-dark">{a.what}</span>
                </div>
                <div className="text-[10px] text-grey mt-0.5">{a.when}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//   ROW — Most Used (bars) + Damage Trend (mini bars) + Team
// ════════════════════════════════════════════════════════════════════════════

function MostUsedPanel() {
  const max = Math.max(...MOST_USED.map((m) => m.count));
  return (
    <Panel title="Most Used" action={<TrendingUp className="h-4 w-4 text-grey" />}>
      <div className="px-4 py-3 space-y-2.5">
        {MOST_USED.map((item, i) => {
          const pct = Math.round((item.count / max) * 100);
          return (
            <div key={i}>
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
    </Panel>
  );
}

// ── Sparkline (used in DamagePanel header) ────────────────────────────────

function Sparkline({ values, color = "#EF4444", width = 80, height = 24 }: {
  values: number[]; color?: string; width?: number; height?: number;
}) {
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

// ── Damage panel — combines category breakdown + 8-week trend ────────────

function DamagePanel() {
  const totalOpen = DAMAGE_BY_CATEGORY.reduce((s, d) => s + d.value, 0);
  const last8     = DAMAGE_BARS.reduce((s, n) => s + n, 0);
  const lastWk    = DAMAGE_BARS[DAMAGE_BARS.length - 1];
  const prevWk    = DAMAGE_BARS[DAMAGE_BARS.length - 2];
  const delta     = lastWk - prevWk;

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
      <div className="px-4 py-3 space-y-3">
        {/* Headline: open count + 8-week sparkline */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-grey">Currently open</div>
            <div className="text-[24px] font-bold text-surface-dark leading-none mt-0.5">{totalOpen}</div>
          </div>
          <div className="flex flex-col items-end">
            <Sparkline values={[...DAMAGE_BARS]} />
            <div className="text-[10px] text-grey mt-0.5">{last8} reports · 8wk</div>
          </div>
        </div>

        {/* Stacked bar — by category */}
        <div className="flex h-2 w-full rounded-full overflow-hidden bg-grey-light">
          {DAMAGE_BY_CATEGORY.map((d) => (
            <div
              key={d.label}
              style={{ width: `${(d.value / totalOpen) * 100}%`, background: d.color }}
              title={`${d.label}: ${d.value}`}
            />
          ))}
        </div>

        {/* Breakdown list */}
        <ul className="space-y-1">
          {DAMAGE_BY_CATEGORY.map((d) => (
            <li key={d.label} className="flex items-center gap-2 text-[11px]">
              <span className="h-2 w-2 rounded-sm flex-shrink-0" style={{ background: d.color }} />
              <span className="text-surface-dark truncate flex-1">{d.label}</span>
              <span className="font-semibold text-surface-dark">{d.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

// ── Crew Leaderboard ──────────────────────────────────────────────────────

function CrewLeaderboardPanel() {
  const max = Math.max(...CREW_LEADERBOARD.map((c) => c.total));
  const totalActions = CREW_LEADERBOARD.reduce((s, c) => s + c.total, 0);
  return (
    <Panel
      title="Crew Leaderboard"
      action={
        <span className="text-[11px] text-grey">
          <strong className="text-surface-dark">{totalActions}</strong> actions · 30d
        </span>
      }
    >
      <div className="px-4 py-3 space-y-2">
        {CREW_LEADERBOARD.map((c, i) => {
          const rankColor =
            i === 0 ? "bg-amber-100 text-amber-700 border-amber-200" :
            i === 1 ? "bg-grey-light text-surface-dark border-grey-mid" :
            i === 2 ? "bg-orange-50 text-orange-700 border-orange-100" :
                      "bg-white text-grey border-grey-mid";
          return (
            <div key={c.name} className="flex items-center gap-2.5">
              {/* Rank badge */}
              <div className={cn(
                "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0",
                rankColor
              )}>
                {i + 1}
              </div>
              {/* Avatar */}
              <div className="h-7 w-7 rounded-full bg-brand-blue/10 flex items-center justify-center text-[10px] font-semibold text-brand-blue flex-shrink-0">
                {c.initials}
              </div>
              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="font-medium text-surface-dark truncate">{c.name}</span>
                  <span className="text-grey ml-2 flex-shrink-0 font-semibold">{c.total}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-grey-light overflow-hidden flex">
                  <div
                    className="h-full bg-brand-blue"
                    style={{ width: `${(c.checkOut / max) * 100}%` }}
                    title={`${c.checkOut} check-outs`}
                  />
                  <div
                    className="h-full bg-status-green"
                    style={{ width: `${(c.checkIn / max) * 100}%` }}
                    title={`${c.checkIn} returns`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function TeamPanel() {
  return (
    <Panel
      title="Team"
      action={<Link href="/team" className="text-[11px] text-grey hover:text-brand-blue">Manage</Link>}
    >
      <div className="divide-y divide-grey-mid">
        {TEAM.map((m, i) => (
          <div key={i} className="flex items-center gap-2.5 px-4 py-2">
            <div className="h-7 w-7 rounded-full bg-brand-blue/10 flex items-center justify-center text-[10px] font-semibold text-brand-blue flex-shrink-0">
              {m.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-surface-dark truncate">{m.name}</div>
              <div className="text-[10px] text-grey truncate">{m.email}</div>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-grey">{m.role}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ProjectsPanel() {
  return (
    <Panel
      title="Projects"
      action={<Link href="/projects" className="text-[11px] text-grey hover:text-brand-blue">View all</Link>}
    >
      <div className="divide-y divide-grey-mid">
        {PROJECTS.map((p, i) => (
          <div key={i} className="px-4 py-2 flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-[6px] bg-grey-light flex items-center justify-center flex-shrink-0">
              <Film className="h-3.5 w-3.5 text-grey" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-surface-dark truncate">{p.name}</div>
              <div className="text-[10px] text-grey truncate">{p.studio}</div>
            </div>
            <Badge variant={p.status === "active" ? "available" : "default"}>{p.status}</Badge>
          </div>
        ))}
      </div>
    </Panel>
  );
}
