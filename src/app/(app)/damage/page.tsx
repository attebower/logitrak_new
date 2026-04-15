"use client";

/**
 * Damage Reports page — Sprint 2
 * Uses Echo's DamageCard / DamageCardList components.
 *
 * TODO Sprint 2: replace mock data with trpc.damage.list.useQuery()
 * TODO Sprint 2: trpc.damage.report.useMutation() on form submit
 * TODO Sprint 2: trpc.damage.markRepaired.useMutation() on Log Repair
 */

import { useState } from "react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/StatCard";
import { DamageCardList } from "@/components/shared/DamageCard";
import type { DamageReport } from "@/components/shared/DamageCard";

// ── Mock data ──────────────────────────────────────────────────────────────

const MOCK_DAMAGE: DamageReport[] = [
  {
    id: "1",
    serial: "AT-002",
    type: "Astera Titan Tube",
    description: "Cracked diffuser panel. Unit still functional but diffuser needs replacement.",
    location: "Stage 7A — Throne Room",
    reportedBy: "Emma W.",
    reportedAt: "2026-04-15T09:31:00Z",
    status: "damaged",
  },
  {
    id: "2",
    serial: "KF-001",
    type: "Kinoflo Freestyle 21",
    description: "Ballast failure — unit not powering on.",
    location: "Lighting Store",
    reportedBy: "Tom R.",
    reportedAt: "2026-04-14T14:00:00Z",
    status: "repaired",
  },
  {
    id: "3",
    serial: "SP-003",
    type: "Arri SkyPanel S30",
    description: "Controller PCB fault. Shows error code E-07 on boot.",
    location: "Stage 3 — Castle Hall",
    reportedBy: "Sarah K.",
    reportedAt: "2026-04-12T11:15:00Z",
    status: "under-repair",
  },
  {
    id: "4",
    serial: "DD-002",
    type: "Dedolight DLED4",
    description: "Lens mount cracked. Light leaking from housing seam.",
    reportedBy: "James O.",
    reportedAt: "2026-04-10T09:00:00Z",
    status: "damaged",
  },
  {
    id: "5",
    serial: "LG-001",
    type: "Litepanels Gemini",
    description: "Fan seized. Unit running hot.",
    reportedBy: "Mike T.",
    reportedAt: "2026-04-08T16:00:00Z",
    status: "repaired",
  },
];

const SEVERITY_OPTIONS = ["Minor", "Moderate", "Severe"] as const;

// ── Component ──────────────────────────────────────────────────────────────

type FilterStatus = "all" | "damaged" | "under-repair" | "repaired";

export default function DamagePage() {
  const [showForm, setShowForm]     = useState(false);
  const [filter, setFilter]         = useState<FilterStatus>("all");
  const [formSerial, setFormSerial] = useState("");
  const [formDesc, setFormDesc]     = useState("");
  const [formSeverity, setFormSeverity] = useState<typeof SEVERITY_OPTIONS[number]>("Minor");

  const filtered = MOCK_DAMAGE.filter(
    (r) => filter === "all" || r.status === filter
  );

  const activeDamage   = MOCK_DAMAGE.filter((r) => r.status === "damaged").length;
  const underRepair    = MOCK_DAMAGE.filter((r) => r.status === "under-repair").length;
  const repairedThisMonth = MOCK_DAMAGE.filter((r) => r.status === "repaired").length;

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO Sprint 2: trpc.damage.report.useMutation()
    setShowForm(false);
    setFormSerial("");
    setFormDesc("");
  }

  return (
    <>
      <AppTopbar
        title="Damage Reports"
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "× Cancel" : "+ Report Damage"}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Mini stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard color="red"   icon="⚠" label="Active Damage"      value={activeDamage}      />
          <StatCard color="amber" icon="🔧" label="Under Repair"       value={underRepair}       />
          <StatCard color="teal"  icon="✓" label="Repaired This Month" value={repairedThisMonth} />
        </div>

        {/* Report damage form */}
        {showForm && (
          <form
            onSubmit={handleFormSubmit}
            className="bg-white rounded-card border border-grey-mid p-5 space-y-4"
          >
            <h2 className="text-[14px] font-semibold text-surface-dark">Report Damage</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-caption text-grey uppercase mb-1.5">Serial Number</label>
                <input
                  type="text"
                  required
                  value={formSerial}
                  onChange={(e) => setFormSerial(e.target.value.toUpperCase())}
                  placeholder="e.g. AT-002"
                  className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
                />
              </div>
              <div>
                <label className="block text-caption text-grey uppercase mb-1.5">Severity</label>
                <select
                  value={formSeverity}
                  onChange={(e) => setFormSeverity(e.target.value as typeof formSeverity)}
                  className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
                >
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-caption text-grey uppercase mb-1.5">Description</label>
              <textarea
                required
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Describe the damage in detail…"
                rows={3}
                className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue resize-none"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="primary" size="sm" type="submit">Submit Report</Button>
              <Button variant="secondary" size="sm" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1">
          {(["all", "damaged", "under-repair", "repaired"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "px-3 py-1.5 rounded-btn text-[11px] font-semibold transition-colors capitalize",
                filter === f
                  ? "bg-brand-blue text-white"
                  : "bg-grey-light text-grey hover:bg-grey-mid",
              ].join(" ")}
            >
              {f === "all" ? "All" : f === "under-repair" ? "Under Repair" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Damage cards */}
        <DamageCardList
          reports={filtered}
          onLogRepair={(id) => {
            // TODO Sprint 2: trpc.damage.markUnderRepair.useMutation()
            console.log("Log repair for", id);
          }}
          onView={(id) => {
            // TODO Sprint 2: open EquipmentDetailPanel for this item
            console.log("View equipment for damage", id);
          }}
        />
      </div>
    </>
  );
}
