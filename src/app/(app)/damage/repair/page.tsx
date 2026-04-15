"use client";

/**
 * Repair Log page — Sprint 2
 * Uses Echo's RepairLogCard / RepairLogList components.
 *
 * TODO Sprint 2: replace mock data with trpc.damage.repairLog.useQuery()
 */

import Link from "next/link";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { RepairLogList } from "@/components/shared/RepairLogCard";
import type { RepairLog } from "@/components/shared/RepairLogCard";

const MOCK_REPAIRS: RepairLog[] = [
  {
    id: "1",
    damageReportId: "2",
    serial: "KF-001",
    type: "Kinoflo Freestyle 21",
    workDone: "Replaced ballast unit. Full test performed — unit operational.",
    repairedBy: "Tom R.",
    returnedTo: "Lighting Store",
    repairedAt: "2026-04-14T14:20:00Z",
  },
  {
    id: "2",
    damageReportId: "5",
    serial: "LG-001",
    type: "Litepanels Gemini",
    workDone: "Seized fan replaced. Thermal paste reapplied. Unit running within normal temp range.",
    repairedBy: "Tom R.",
    returnedTo: "Lighting Store",
    repairedAt: "2026-04-08T16:45:00Z",
  },
  {
    id: "3",
    damageReportId: "6",
    serial: "SP-001",
    type: "Arri SkyPanel S60-C",
    workDone: "Controller firmware reflashed via Arri service tool. Error codes cleared.",
    repairedBy: "Tom R.",
    returnedTo: "Lighting Store",
    repairedAt: "2026-04-05T09:00:00Z",
  },
];

export default function RepairLogPage() {
  return (
    <>
      <AppTopbar
        title="Repair Log"
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link href="/damage">← Back to Damage</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <RepairLogList
          logs={MOCK_REPAIRS}
          onView={(serial) => {
            // TODO Sprint 2: open EquipmentDetailPanel
            console.log("View equipment", serial);
          }}
        />
      </div>
    </>
  );
}
