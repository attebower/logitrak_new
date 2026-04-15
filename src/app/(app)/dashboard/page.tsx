import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { StatCard, StatGrid } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";

// TODO: wire to trpc.dashboard.stats.useQuery({ workspaceId }) once workspace context is available
const MOCK_STATS = [
  { color: "blue"  as const, icon: "⊞", label: "Total Assets",  value: 847, change: "↑ 12 this week",    changeColor: "green" as const },
  { color: "green" as const, icon: "✓", label: "Available",     value: 412, change: "48.6% of total",     changeColor: "grey"  as const },
  { color: "amber" as const, icon: "⇄", label: "Checked Out",   value: 414, change: "Across 6 locations", changeColor: "grey"  as const },
  { color: "red"   as const, icon: "⚠", label: "Damaged",       value: 21,  change: "3 reported today",   changeColor: "red"   as const },
];

const QUICK_ACTIONS = [
  { label: "Check Out Equipment", icon: "⇄", desc: "Sign out items to crew" },
  { label: "Check In Equipment",  icon: "↩", desc: "Return items to stock" },
  { label: "Report Damage",       icon: "⚠", desc: "Log a damaged item" },
  { label: "Add Equipment",       icon: "+", desc: "Register new assets" },
  { label: "Scan QR Code",        icon: "⬛", desc: "Scan an asset label" },
  { label: "Export Report",       icon: "📋", desc: "Download CSV summary" },
];

const ACTIVITY_FEED = [
  { time: "2m ago",  user: "Sarah K.",  action: "checked out",        item: "Arri SkyPanel S60-C x2",     status: "checked-out" as const },
  { time: "14m ago", user: "Tom R.",    action: "returned",           item: "Dedolight DLH4 Tungsten x1", status: "available"   as const },
  { time: "31m ago", user: "Emma W.",   action: "reported damage on", item: "Astera Titan Tube x1",       status: "damaged"     as const },
  { time: "1h ago",  user: "James O.",  action: "checked out",        item: "Creamsource Vortex8 x1",     status: "checked-out" as const },
  { time: "2h ago",  user: "System",    action: "marked repaired",    item: "Kinoflo Freestyle 21 x1",    status: "repaired"    as const },
];

export default function DashboardPage() {
  return (
    <>
      <AppTopbar
        title="Dashboard"
        context="🎬 Series 4 Production"
        actions={
          <>
            <Button variant="secondary" size="sm">Export</Button>
            <Button variant="primary" size="sm">+ Add Equipment</Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <StatGrid>
          {MOCK_STATS.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </StatGrid>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-card border border-grey-mid shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-grey-mid">
                <h2 className="text-[14px] font-semibold text-surface-dark">Recent Activity</h2>
              </div>
              <div className="divide-y divide-grey-mid">
                {ACTIVITY_FEED.map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <div className="text-[11px] text-grey w-12 flex-shrink-0">{entry.time}</div>
                    <div className="flex-1 text-[13px] text-surface-dark">
                      <span className="font-medium">{entry.user}</span>{" "}
                      <span className="text-grey">{entry.action}</span>{" "}
                      <span>{entry.item}</span>
                    </div>
                    <Badge variant={entry.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white rounded-card border border-grey-mid shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-grey-mid">
                <h2 className="text-[14px] font-semibold text-surface-dark">Quick Actions</h2>
              </div>
              <div className="grid grid-cols-2 gap-px bg-grey-mid">
                {QUICK_ACTIONS.map((action) => (
                  <button key={action.label} className="bg-white hover:bg-grey-light transition-colors p-4 text-left group">
                    <div className="text-2xl mb-1.5">{action.icon}</div>
                    <div className="text-[12px] font-semibold text-surface-dark group-hover:text-brand-blue transition-colors">{action.label}</div>
                    <div className="text-[11px] text-grey mt-0.5">{action.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
