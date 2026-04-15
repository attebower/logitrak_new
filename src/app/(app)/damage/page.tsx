"use client";

import { useState } from "react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// TODO Sprint 2: replace table data with trpc.damage.list.useQuery()
const MOCK_DAMAGE = [
  { id: "1", asset: "Astera Titan Tube",    serial: "AT-002", reportedBy: "Emma W.",  date: "Today 09:31",  status: "damaged"     as const },
  { id: "2", asset: "Kinoflo Freestyle 21", serial: "KF-001", reportedBy: "Tom R.",   date: "Yesterday",    status: "repaired"    as const },
  { id: "3", asset: "Arri SkyPanel S30",    serial: "SP-003", reportedBy: "Sarah K.", date: "12 Apr",       status: "under-repair" as const },
  { id: "4", asset: "Dedolight DLED4",      serial: "DD-002", reportedBy: "James O.", date: "10 Apr",       status: "damaged"     as const },
  { id: "5", asset: "Litepanels Gemini",    serial: "LG-001", reportedBy: "Mike T.",  date: "8 Apr",        status: "repaired"    as const },
];

const EQUIPMENT_OPTIONS = [
  "Arri SkyPanel S60-C (SP-001)",
  "Arri SkyPanel S60-C (SP-002)",
  "Astera Titan Tube (AT-001)",
  "Astera Titan Tube (AT-002)",
  "Creamsource Vortex8 (CV-001)",
  "Dedolight DLH4 (DD-001)",
  "Kinoflo Freestyle 21 (KF-001)",
  "Litepanels Astra 6X (LA-001)",
];

type DamageStatus = "damaged" | "under-repair" | "repaired";

function statusLabel(status: DamageStatus) {
  if (status === "under-repair") return "Under Repair";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function DamagePage() {
  const [showForm, setShowForm]         = useState(false);
  const [equipSearch, setEquipSearch]   = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [description, setDescription]  = useState("");
  const [severity, setSeverity]         = useState("");

  const filteredEquip = equipSearch.trim()
    ? EQUIPMENT_OPTIONS.filter((e) =>
        e.toLowerCase().includes(equipSearch.toLowerCase())
      )
    : EQUIPMENT_OPTIONS;

  function handleSubmit() {
    // TODO Sprint 2: trpc.damage.report.useMutation()
    setShowForm(false);
    setEquipSearch("");
    setDescription("");
    setSeverity("");
  }

  return (
    <>
      <AppTopbar
        title="Damage Reports"
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ Report Damage"}
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-card border border-grey-mid shadow-card p-4 border-t-4 border-t-status-red">
            <p className="text-[11px] font-semibold uppercase text-grey mb-1">Active Damage</p>
            <p className="text-[28px] font-extrabold text-status-red leading-none">21</p>
          </div>
          <div className="bg-white rounded-card border border-grey-mid shadow-card p-4 border-t-4 border-t-status-amber">
            <p className="text-[11px] font-semibold uppercase text-grey mb-1">Under Repair</p>
            <p className="text-[28px] font-extrabold text-status-amber leading-none">4</p>
          </div>
          <div className="bg-white rounded-card border border-grey-mid shadow-card p-4 border-t-4 border-t-status-teal">
            <p className="text-[11px] font-semibold uppercase text-grey mb-1">Repaired This Month</p>
            <p className="text-[28px] font-extrabold text-status-teal leading-none">8</p>
          </div>
        </div>

        {/* Inline report form */}
        {showForm && (
          <div className="bg-white rounded-card border border-grey-mid shadow-card p-5 mb-6">
            <h2 className="text-[14px] font-bold text-surface-dark mb-4">New Damage Report</h2>
            <div className="space-y-4">
              {/* Equipment search */}
              <div className="relative">
                <label className="block text-[11px] font-semibold uppercase text-grey mb-1.5">Equipment</label>
                <input
                  type="text"
                  value={equipSearch}
                  onChange={(e) => { setEquipSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  placeholder="Search equipment…"
                  className="w-full rounded-btn border border-grey-mid bg-white px-3 py-2 text-[13px] text-surface-dark placeholder:text-grey focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
                {showDropdown && filteredEquip.length > 0 && (
                  <div className="absolute z-10 top-full left-0 w-full mt-0.5 bg-white border border-grey-mid rounded-btn shadow-card max-h-40 overflow-y-auto">
                    {filteredEquip.map((opt) => (
                      <button
                        key={opt}
                        className="w-full text-left px-3 py-2 text-[13px] text-surface-dark hover:bg-grey-light transition-colors"
                        onMouseDown={() => { setEquipSearch(opt); setShowDropdown(false); }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold uppercase text-grey mb-1.5">
                  Description <span className="text-status-red">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the damage…"
                  rows={3}
                  className="w-full rounded-btn border border-grey-mid bg-white px-3 py-2 text-[13px] text-surface-dark placeholder:text-grey focus:outline-none focus:ring-2 focus:ring-brand-blue/30 resize-none"
                />
              </div>

              {/* Severity */}
              <div>
                <label className="block text-[11px] font-semibold uppercase text-grey mb-1.5">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full rounded-btn border border-grey-mid bg-white px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                >
                  <option value="" disabled>Select severity…</option>
                  <option value="Minor">Minor</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Severe">Severe</option>
                </select>
              </div>

              <Button
                variant="primary"
                disabled={!description.trim()}
                onClick={handleSubmit}
              >
                Submit Report
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-card border border-grey-mid shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-grey-mid">
            <h2 className="text-[14px] font-semibold text-surface-dark">All Reports</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-grey-mid bg-grey-light">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-grey tracking-wide">Asset</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-grey tracking-wide">Serial</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-grey tracking-wide">Reported By</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-grey tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-grey tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-grey tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-mid">
              {MOCK_DAMAGE.map((item) => (
                <tr key={item.id} className="hover:bg-grey-light transition-colors">
                  <td className="px-4 py-3 text-[13px] font-medium text-surface-dark">{item.asset}</td>
                  <td className="px-4 py-3 text-[13px] text-grey font-mono">{item.serial}</td>
                  <td className="px-4 py-3 text-[13px] text-surface-dark">{item.reportedBy}</td>
                  <td className="px-4 py-3 text-[13px] text-grey">{item.date}</td>
                  <td className="px-4 py-3">
                    <Badge variant={item.status}>{statusLabel(item.status)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <Button variant="secondary" size="sm">View</Button>
                      {item.status !== "repaired" && (
                        <Button variant="secondary" size="sm">Mark Repaired</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
