/**
 * One-off cleanup: delete any Set rows that have no ProjectSet
 * referencing them AND no CheckEvent referencing them. These are
 * the stragglers left behind by set renames before we had the
 * orphan-cleanup logic in project.sets.update.
 *
 * Run:
 *   cd logitrak-app && set -a && source .env.local && set +a \
 *     && npx tsx scripts/cleanup-orphan-sets.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Grab every set and check refs. Small table, so this is fine.
  const sets = await prisma.set.findMany({
    select: {
      id: true,
      name: true,
      stageId: true,
      onLocationId: true,
      workspaceId: true,
      _count: {
        select: { projectSets: true, checkEvents: true },
      },
    },
  });

  const orphans = sets.filter((s) => s._count.projectSets === 0 && s._count.checkEvents === 0);
  console.log(`Found ${sets.length} sets total, ${orphans.length} orphaned.`);
  for (const o of orphans) {
    console.log(`  - ${o.id} "${o.name}" (stage=${o.stageId ?? "-"} onLoc=${o.onLocationId ?? "-"})`);
  }

  if (!orphans.length) {
    console.log("Nothing to delete.");
    return;
  }

  const ids = orphans.map((o) => o.id);
  const res = await prisma.set.deleteMany({ where: { id: { in: ids } } });
  console.log(`\nDeleted ${res.count} orphan sets.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
