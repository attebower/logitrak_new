"use client";

import { useState } from "react";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// TODO Sprint 2: replace with trpc.equipment.list.useQuery()
const MOCK_EQUIPMENT = [
  { id: "1", name: "Arri SkyPanel S60-C",  serial: "SP-001", category: "Fixtures",     status: "available"   as const, location: "Lighting Store",      updated: "2h ago" },
  { id: "2", name: "Arri SkyPanel S60-C",  serial: "SP-002", category: "Fixtures",     status: "checked-out" as const, location: "Stage 3 — On Set",   updated: "45m ago" },
  { id: "3", name: "Astera Titan Tube",    serial: "AT-001", category: "LED",          status: "available"   as const, location: "Lighting Store",      updated: "1d ago" },
  { id: "4", name: "Astera Titan Tube",    serial: "AT-002", category: "LED",          status: "damaged"     as const, location: "Repairs Bench",       updated: "3h ago" },
  { id: "5", name: "Creamsource Vortex8",  serial: "CV-001", category: "Fixtures",     status: "checked-out" as const, location: "Stage 1 — On Set",   updated: "2h ago" },
  { id: "6", name: "Dedolight DLH4",       serial: "DD-001", category: "Tungsten",     status: "available"   as const, location: "Lighting Store",      updated: "5d ago" },
  { id: "7", name: "Kinoflo Freestyle 21", serial: "KF-001", category: "Fluorescent",  status: "repaired"    as const, location: "Lighting Store",      updated: "1h ago" },
  { id: "8", name: "Litepanels Astra 6X",  serial: "LA-001", category: "LED",          status: "available"   as const, location: "Lighting Store",      updated: "3d ago" },
];

type FilterTab = "all" | "available" | "checked-out" | "damaged" | "repaired";

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: "All",          value: "all" },
  { label: "Available",    value: "available" },
  { label: "Checked Out",  value: "checked-out" },
  { label: "Damaged",      value: "damaged" },
  { label: "Repaired",     value: "repaired" },
];

export default function EquipmentPage() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const filtered = MOCK_EQUIPMENT.filter((item) => {
    const matchesSearch =
      search.trim() === "" ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.serial.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());

    const matchesFilter =
      activeFilter === "all" || item.status === activeFilter;

    return matchesSearch && matchesFilter;
  });

  return (
    <>
      <AppTopbar
        title="Equipment Registry"
        actions={
          <>
            <Button variant="secondary" size="sm">Import CSV</Button>
            <Button variant="primary" size="sm">+ Add Equipment</Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, serial, or category…"
            className="w-full max-w-sm rounded-btn border border-grey-mid bg-white px-3 py-2 text-[13px] text-surface-dark placeholder:text-grey focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          />
        </div>

        {/* Filter tabs */}
        <div className="mb-4 flex gap-1.5 flex-wrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={[
                "rounded-btn px-3 py-1.5 text-[12px] font-semibold transition-colors",
                activeFilter === tab.value
                  ? "bg-brand-blue text-white"
                  : "bg-white border border-grey-mid text-grey hover:text-surface-dark hover:border-surface-dark3",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-card border border-grey-mid shadow-card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-grey">
              <div className="text-4xl mb-3">≡</div>
              <p className="text-[14px] font-medium text-surface-dark mb-1">No equipment found</p>
              <p className="text-[12px]">Try adjusting your search or filter.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-grey-mid bg-grey-light">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-grey tracking-wide">Asset Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-grey tracking-wide">Serial</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-grey tracking-wide">Category</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-grey tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-grey tracking-wide">Location</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-grey tracking-wide">Last Updated</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-grey tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-mid">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-grey-light transition-colors">
                    <td className="px-4 py-3 text-[13px] font-medium text-surface-dark">{item.name}</td>
                    <td className="px-4 py-3 text-[13px] text-grey font-mono">{item.serial}</td>
                    <td className="px-4 py-3">
                      <Badge variant="category">{item.category}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={item.status}>
                        {item.status === "checked-out" ? "Checked Out"
                          : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-grey">{item.location}</td>
                    <td className="px-4 py-3 text-[13px] text-grey">{item.updated}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <Button variant="secondary" size="sm">View</Button>
                        <Button variant="secondary" size="sm">Edit</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
