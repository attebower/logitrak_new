"use client";

import { useState } from "react";
import Link from "next/link";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Badge } from "@/components/ui/badge";

// TODO Sprint 2: trpc.damage.repairLog.useQuery()
const MOCK_REPAIRS = [
  { id: "1", asset: "Kinoflo Freestyle 21", serial: "KF-001", from: "damaged",      to: "repaired",    date: "Yesterday 14:20", tech: "Tom R.",   notes: "Replaced ballast. Tested OK." },
  { id: "2", asset: "Arri SkyPanel S30",    serial: "SP-003", from: "damaged",      to: "under_repair", date: "12 Apr 10:00",    tech: "Mike T.",  notes: "Awaiting replacement PCB." },
  { id: "3", asset: "Litepanels Gemini",    serial: "LG-001", from: "damaged",      to: "repaired",    date: "8 Apr 16:45",     tech: "Tom R.",   notes: "Fan replaced. Unit operational." },
  { id: "4", asset: "Dedolight DLED4",      serial: "DD-002", from: "normal",       to: "damaged",     date: "10 Apr 11:15",    tech: "System",   notes: "Damage reported by James O." },
  { id: "5", asset: "Astera Titan Tube",    serial: "AT-002", from: "normal",       to: "damaged",     date: "Today 09:31",     tech: "System",   notes: "Damage reported by Emma W." },
  { id: "6", asset: "Arri SkyPanel S60-C",  serial: "SP-001", from: "under_repair", to: "repaired",    date: "5 Apr 09:00",     tech: "Tom R.",   notes: "Controller firmware reflashed." },
];

type FilterTab = "all" | "in-progress" | "completed";

// Damage status enum values: normal | damaged | under_repair | repaired
function statusBadgeVariant(s: string): "damaged" | "under-repair" | "repaired" | "default" {
  if (s === "damaged")      return "damaged";
  if (s === "under_repair") return "under-repair";
  if (s === "repaired")     return "repaired";
  return "default";
}

function statusLabel(s: string) {
  if (s === "under_repair") return "Under Repair";
  if (s === "normal")       return "Normal";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isInProgress(entry: typeof MOCK_REPAIRS[number]) {
  return entry.to === "under_repair" || (entry.to === "damaged" && entry.from !== "under_repair");
}

function isCompleted(entry: typeof MOCK_REPAIRS[number]) {
  return entry.to === "repaired";
}

export default function RepairLogPage() {
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered = MOCK_REPAIRS.filter((entry) => {
    if (filter === "in-progress") return isInProgress(entry);
    if (filter === "completed")   return isCompleted(entry);
    return true;
  });

  const FILTER_TABS: { label: string; value: FilterTab }[] = [
    { label: "All",         value: "all" },
    { label: "In Progress", value: "in-progress" },
    { label: "Completed",   value: "completed" },
  ];

  return (
    <>
      <AppTopbar
        title="Repair Log"
        actions={
          <Link
            href="/damage"
            className="text-[13px] text-grey hover:text-surface-dark transition-colors flex items-center gap-1"
          >
            ← Back to Damage Reports
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {/* Filter tabs */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={[
                "rounded-btn px-3 py-1.5 text-[12px] font-semibold transition-colors",
                filter === tab.value
                  ? "bg-brand-blue text-white"
                  : "bg-white border border-grey-mid text-grey hover:text-surface-dark hover:border-surface-dark3",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-grey-mid" />

          <div className="space-y-4">
            {filtered.map((entry) => (
              <div key={entry.id} className="relative flex gap-4 pl-12">
                {/* Timeline dot */}
                <div className={[
                  "absolute left-[11px] top-4 w-4 h-4 rounded-full border-2 border-white",
                  entry.to === "repaired"    ? "bg-status-teal" :
                  entry.to === "under_repair" ? "bg-status-amber" :
                  entry.to === "damaged"     ? "bg-status-red" :
                                               "bg-grey",
                ].join(" ")} />

                {/* Card */}
                <div className="flex-1 bg-white rounded-card border border-grey-mid shadow-card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[13px] font-semibold text-surface-dark">{entry.asset}</p>
                      <p className="text-[11px] text-grey font-mono">{entry.serial}</p>
                    </div>
                    <p className="text-[11px] text-grey">{entry.date}</p>
                  </div>

                  {/* Status transition */}
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={statusBadgeVariant(entry.from)}>{statusLabel(entry.from)}</Badge>
                    <span className="text-[13px] text-grey">→</span>
                    <Badge variant={statusBadgeVariant(entry.to)}>{statusLabel(entry.to)}</Badge>
                  </div>

                  <p className="text-[12px] text-grey">{entry.notes}</p>
                  <p className="text-[11px] text-grey mt-1.5">
                    <span className="font-medium text-surface-dark">{entry.tech}</span>
                  </p>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-grey pl-12">
                <p className="text-[14px] font-medium text-surface-dark mb-1">No entries found</p>
                <p className="text-[12px]">Try a different filter.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
