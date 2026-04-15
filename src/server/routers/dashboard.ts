import { z } from "zod";
import { router, workspaceProcedure } from "../trpc";

export const dashboardRouter = router({
  stats: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const wid = ctx.workspaceId!;

      const [totalEquipment, available, checkedOut, damaged, recentActivity] =
        await ctx.prisma.$transaction([
          ctx.prisma.equipment.count({
            where: { workspaceId: wid, status: { not: "retired" } },
          }),
          ctx.prisma.equipment.count({
            where: { workspaceId: wid, status: "available" },
          }),
          ctx.prisma.equipment.count({
            where: { workspaceId: wid, status: "checked_out" },
          }),
          ctx.prisma.equipment.count({
            where: {
              workspaceId: wid,
              status: { not: "retired" },
              damageStatus: { not: "normal" },
            },
          }),
          ctx.prisma.activityEvent.findMany({
            where: { workspaceId: wid },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
              actor: { select: { displayName: true, email: true } },
            },
          }),
        ]);

      return {
        totalEquipment,
        available,
        checkedOut,
        damaged,
        recentActivity,
      };
    }),
});
