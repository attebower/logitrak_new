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

  lowStock: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const wid = ctx.workspaceId!;

      // Get all non-retired equipment grouped by product
      const equipment = await ctx.prisma.equipment.findMany({
        where: { workspaceId: wid, status: { not: "retired" } },
        select: {
          productId: true,
          status: true,
          product: { select: { id: true, name: true } },
        },
      });

      // Group by productId
      const productMap = new Map<
        string,
        { name: string; total: number; available: number }
      >();

      for (const item of equipment) {
        if (!item.productId || !item.product) continue;
        const existing = productMap.get(item.productId);
        if (existing) {
          existing.total++;
          if (item.status === "available") existing.available++;
        } else {
          productMap.set(item.productId, {
            name: item.product.name,
            total: 1,
            available: item.status === "available" ? 1 : 0,
          });
        }
      }

      // Filter to products with >=2 units where available/total <= 20%
      const lowStock = Array.from(productMap.entries())
        .filter(([, v]) => v.total >= 2 && v.available / v.total <= 0.2)
        .map(([id, v]) => ({
          productId: id,
          name: v.name,
          total: v.total,
          available: v.available,
          percentAvailable: Math.round((v.available / v.total) * 100),
        }))
        .sort((a, b) => a.percentAvailable - b.percentAvailable);

      return lowStock;
    }),
});
