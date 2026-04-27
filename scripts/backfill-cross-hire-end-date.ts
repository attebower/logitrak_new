/**
 * One-off: backfill CrossHireEvent.endDate for rows where it was never set
 * (older entries created via the duration field instead of an explicit date).
 * Computes endDate = startDate + totalDays days.
 *
 * Run with:
 *   set -a; source .env.local; set +a; npx tsx scripts/backfill-cross-hire-end-date.ts
 */

import { prisma } from "../src/lib/prisma";

async function main() {
  const orphans = await prisma.crossHireEvent.findMany({
    where: { endDate: null, totalDays: { gt: 0 } },
    select: { id: true, startDate: true, totalDays: true, hireCustomer: { select: { productionName: true } } },
  });

  if (orphans.length === 0) {
    console.log("No events with missing endDate. Nothing to do.");
    return;
  }

  console.log(`Found ${orphans.length} event(s) with missing endDate:`);
  for (const ev of orphans) {
    const end = new Date(ev.startDate.getTime() + (ev.totalDays ?? 0) * 86400000);
    console.log(`  - ${ev.id} (${ev.hireCustomer.productionName}) start=${ev.startDate.toISOString().slice(0,10)} +${ev.totalDays}d → ${end.toISOString().slice(0,10)}`);
  }

  for (const ev of orphans) {
    const end = new Date(ev.startDate.getTime() + (ev.totalDays ?? 0) * 86400000);
    await prisma.crossHireEvent.update({
      where: { id: ev.id },
      data:  { endDate: end },
    });
  }

  console.log(`Done. Updated ${orphans.length} event(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
