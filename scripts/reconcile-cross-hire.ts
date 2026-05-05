/**
 * One-off: find any CrossHireItem where the linked equipment is no longer
 * `cross_hired` but the CrossHireItem.returnedAt is still null — i.e. items
 * that were checked in via /return before the auto-reconcile fix landed.
 *
 * For each orphan, mark CrossHireItem.returnedAt = now. Then if all items in
 * its event are returned, flip the event to status=returned.
 *
 * Run with: npx tsx scripts/reconcile-cross-hire.ts
 */

import { prisma } from "../src/lib/prisma";

async function main() {
  const orphans = await prisma.crossHireItem.findMany({
    where: {
      returnedAt: null,
      crossHireEvent: { status: "active" },
      equipment: { status: { not: "cross_hired" } },
    },
    include: {
      equipment:      { select: { serial: true, name: true, status: true } },
      crossHireEvent: { select: { id: true, hireCustomer: { select: { productionName: true } } } },
    },
  });

  if (orphans.length === 0) {
    console.log("No orphan cross-hire items. Nothing to do.");
    return;
  }

  console.log(`Found ${orphans.length} orphan CrossHireItem(s):`);
  for (const o of orphans) {
    console.log(
      `  - ${o.equipment.serial} (${o.equipment.name}) status=${o.equipment.status} ` +
      `· event=${o.crossHireEvent.id} (${o.crossHireEvent.hireCustomer.productionName})`
    );
  }

  const now = new Date();
  const eventIds = new Set(orphans.map((o) => o.crossHireEventId));

  await prisma.$transaction(async (tx) => {
    await tx.crossHireItem.updateMany({
      where: { id: { in: orphans.map((o) => o.id) } },
      data:  { returnedAt: now },
    });

    const eventIdList: string[] = [];
    eventIds.forEach((id) => eventIdList.push(id));
    for (const eventId of eventIdList) {
      const remaining = await tx.crossHireItem.count({
        where: { crossHireEventId: eventId, returnedAt: null },
      });
      if (remaining === 0) {
        await tx.crossHireEvent.update({
          where: { id: eventId },
          data:  { status: "returned", returnedAt: now },
        });
        console.log(`  · Event ${eventId} fully returned → status=returned`);
      }
    }
  });

  console.log(`Done. Marked ${orphans.length} item(s) returned.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
