import { z } from "zod";
import { router, workspaceProcedure } from "../trpc";

export const dashboardRouter = router({
  stats: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const wid = ctx.workspaceId!;

      const [totalEquipment, available, checkedOut, damaged, crossHired, recentActivity] =
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
          ctx.prisma.equipment.count({
            where: { workspaceId: wid, status: "cross_hired" },
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
        crossHired,
        recentActivity,
      };
    }),

  mostUsed: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      window: z.enum(["30d", "all"]).default("30d"),
      limit: z.number().min(1).max(20).default(5),
    }))
    .query(async ({ ctx, input }) => {
      const wid = ctx.workspaceId!;
      const since = input.window === "30d"
        ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        : undefined;

      const events = await ctx.prisma.checkEvent.findMany({
        where: {
          workspaceId: wid,
          eventType: "check_out",
          ...(since && { createdAt: { gte: since } }),
        },
        select: {
          equipment: {
            select: {
              name: true,
              product: { select: { id: true, name: true } },
            },
          },
        },
      });

      const counts = new Map<string, { key: string; name: string; count: number }>();
      for (const ev of events) {
        if (!ev.equipment) continue;
        const name = ev.equipment.product?.name ?? ev.equipment.name;
        const key  = ev.equipment.product?.id ?? `name:${ev.equipment.name}`;
        const existing = counts.get(key);
        if (existing) existing.count++;
        else counts.set(key, { key, name, count: 1 });
      }

      return Array.from(counts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, input.limit);
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

      // Low stock heuristic:
      //   flag if 2 or fewer units are available, OR
      //   fewer than 40% of total units are available.
      const lowStock = Array.from(productMap.entries())
        .filter(([, v]) => v.available <= 2 || v.available / v.total < 0.4)
        .map(([id, v]) => ({
          productId: id,
          name: v.name,
          total: v.total,
          available: v.available,
          percentAvailable: Math.round((v.available / v.total) * 100),
        }))
        .sort((a, b) => a.available - b.available || a.percentAvailable - b.percentAvailable);

      return lowStock;
    }),
});
