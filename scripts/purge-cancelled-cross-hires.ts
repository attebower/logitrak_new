/**
 * One-off: purge any existing cross-hire events with status=cancelled.
 *
 * After the schema/UX change where cancelling a cross hire deletes it
 * outright, lingering cancelled rows from the old behaviour should be
 * removed so the list is consistent.
 *
 * Run with:
 *   set -a; source .env.local; set +a; npx tsx scripts/purge-cancelled-cross-hires.ts
 */

import { prisma } from "../src/lib/prisma";

async function main() {
  const rows = await prisma.crossHireEvent.findMany({
    where:   { status: "cancelled" },
    include: { hireCustomer: { select: { productionName: true } }, _count: { select: { equipmentItems: true } } },
  });

  if (rows.length === 0) {
    console.log("No cancelled cross-hire events. Nothing to do.");
    return;
  }

  console.log(`Found ${rows.length} cancelled event(s):`);
  for (const r of rows) {
    console.log(`  - ${r.id} (${r.hireCustomer.productionName}) · ${r._count.equipmentItems} item(s)`);
  }

  await prisma.crossHireEvent.deleteMany({ where: { status: "cancelled" } });
  console.log(`Deleted ${rows.length} cancelled event(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
