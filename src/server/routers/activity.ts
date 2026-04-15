import { z } from "zod";
import { router, workspaceProcedure } from "../trpc";

export const activityRouter = router({
  list: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const events = await ctx.prisma.activityEvent.findMany({
        where: { workspaceId: ctx.workspaceId! },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: {
          actor: { select: { id: true, displayName: true, email: true } },
        },
      });

      // For equipment events, fetch the equipment name
      const equipmentIds = events
        .filter((e) => e.entityType === "equipment")
        .map((e) => e.entityId);

      const equipmentMap = new Map<string, string>();
      if (equipmentIds.length > 0) {
        const equipment = await ctx.prisma.equipment.findMany({
          where: { id: { in: equipmentIds } },
          select: { id: true, name: true },
        });
        for (const eq of equipment) {
          equipmentMap.set(eq.id, eq.name);
        }
      }

      return events.map((e) => ({
        ...e,
        equipmentName:
          e.entityType === "equipment"
            ? (equipmentMap.get(e.entityId) ?? null)
            : null,
      }));
    }),
});
