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

  /** 14-day check-out / check-in series for the activity chart. */
  activitySeries: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const wid = ctx.workspaceId!;
      const days = 14;
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const since = new Date(startOfToday.getTime() - (days - 1) * 86400000);

      const events = await ctx.prisma.checkEvent.findMany({
        where: {
          workspaceId: wid,
          eventType:   { in: ["check_out", "check_in"] },
          createdAt:   { gte: since },
        },
        select: { eventType: true, createdAt: true },
      });

      // Bucket per day
      const labels:   string[] = [];
      const checkOut: number[] = [];
      const checkIn:  number[] = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(since.getTime() + i * 86400000);
        labels.push(d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }));
        checkOut.push(0);
        checkIn.push(0);
      }
      for (const ev of events) {
        const idx = Math.floor((ev.createdAt.getTime() - since.getTime()) / 86400000);
        if (idx < 0 || idx >= days) continue;
        if (ev.eventType === "check_out") checkOut[idx]++;
        else if (ev.eventType === "check_in") checkIn[idx]++;
      }

      return { labels, checkOut, checkIn };
    }),

  /** Currently-open damage by equipment category + 8-week weekly trend of damage reports. */
  damageBreakdown: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const wid = ctx.workspaceId!;

      // By-category breakdown (currently damaged equipment)
      const damaged = await ctx.prisma.equipment.findMany({
        where: {
          workspaceId:  wid,
          status:       { not: "retired" },
          damageStatus: { not: "normal" },
        },
        select: { category: { select: { id: true, name: true } } },
      });

      const catMap = new Map<string, { label: string; value: number }>();
      let uncategorised = 0;
      for (const e of damaged) {
        if (!e.category) { uncategorised++; continue; }
        const k = e.category.id;
        const cur = catMap.get(k);
        if (cur) cur.value++;
        else catMap.set(k, { label: e.category.name, value: 1 });
      }
      const byCategory = Array.from(catMap.values()).sort((a, b) => b.value - a.value);
      if (uncategorised > 0) byCategory.push({ label: "Uncategorised", value: uncategorised });

      // 8-week weekly trend (count of damage reports per week, oldest first)
      const weeks = 8;
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      // Anchor to the start of the current week (Monday). JS getDay(): Sun=0..Sat=6; treat Mon as 0.
      const dow = (startOfToday.getDay() + 6) % 7;
      const startOfThisWeek = new Date(startOfToday.getTime() - dow * 86400000);
      const since = new Date(startOfThisWeek.getTime() - (weeks - 1) * 7 * 86400000);

      const reports = await ctx.prisma.damageReport.findMany({
        where: { workspaceId: wid, reportedAt: { gte: since } },
        select: { reportedAt: true },
      });

      const weeklyTrend: number[] = Array.from({ length: weeks }, () => 0);
      for (const r of reports) {
        const idx = Math.floor((r.reportedAt.getTime() - since.getTime()) / (7 * 86400000));
        if (idx >= 0 && idx < weeks) weeklyTrend[idx]++;
      }

      return { byCategory, weeklyTrend };
    }),

  /** Top crew by 30-day check-out + check-in activity. */
  crewLeaderboard: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      limit:       z.number().min(1).max(20).default(5),
    }))
    .query(async ({ ctx, input }) => {
      const wid = ctx.workspaceId!;
      const since = new Date(Date.now() - 30 * 86400000);

      const events = await ctx.prisma.checkEvent.findMany({
        where: {
          workspaceId: wid,
          eventType:   { in: ["check_out", "check_in"] },
          createdAt:   { gte: since },
        },
        select: {
          eventType: true,
          user:      { select: { id: true, displayName: true, email: true } },
        },
      });

      const map = new Map<string, {
        userId:    string;
        name:      string | null;
        email:     string;
        checkOut:  number;
        checkIn:   number;
      }>();

      for (const ev of events) {
        if (!ev.user) continue;
        const key = ev.user.id;
        const cur = map.get(key) ?? {
          userId:   ev.user.id,
          name:     ev.user.displayName,
          email:    ev.user.email,
          checkOut: 0,
          checkIn:  0,
        };
        if (ev.eventType === "check_out") cur.checkOut++;
        else if (ev.eventType === "check_in") cur.checkIn++;
        map.set(key, cur);
      }

      return Array.from(map.values())
        .map((c) => ({ ...c, total: c.checkOut + c.checkIn }))
        .sort((a, b) => b.total - a.total)
        .slice(0, input.limit);
    }),

  /** Combined "Needs Attention" feed: overdue cross hires + recent damage + low stock. */
  attention: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const wid = ctx.workspaceId!;
      const now = Date.now();

      const [overdueHires, recentDamage, equipment] = await ctx.prisma.$transaction([
        ctx.prisma.crossHireEvent.findMany({
          where: {
            workspaceId: wid,
            status:      "active",
            endDate:     { lt: new Date() },
          },
          select: {
            id: true, endDate: true,
            hireCustomer: { select: { productionName: true } },
            equipmentItems: { select: { id: true, returnedAt: true } },
          },
          orderBy: { endDate: "asc" },
          take: 5,
        }),
        ctx.prisma.damageReport.findMany({
          where: { workspaceId: wid },
          orderBy: { reportedAt: "desc" },
          take: 5,
          select: {
            id: true, reportedAt: true,
            equipment: { select: { name: true, serial: true } },
            reporter:  { select: { displayName: true, email: true } },
          },
        }),
        ctx.prisma.equipment.findMany({
          where: { workspaceId: wid, status: { not: "retired" } },
          select: {
            productId: true,
            status:    true,
            product:   { select: { id: true, name: true } },
          },
        }),
      ]);

      // Build low stock client-side (mirrors lowStock endpoint logic, top 3 only)
      const productMap = new Map<string, { name: string; total: number; available: number }>();
      for (const item of equipment) {
        if (!item.productId || !item.product) continue;
        const cur = productMap.get(item.productId);
        if (cur) {
          cur.total++;
          if (item.status === "available") cur.available++;
        } else {
          productMap.set(item.productId, {
            name:      item.product.name,
            total:     1,
            available: item.status === "available" ? 1 : 0,
          });
        }
      }
      const lowStock = Array.from(productMap.values())
        .filter((v) => v.available <= 2 || v.available / v.total < 0.4)
        .sort((a, b) => a.available - b.available)
        .slice(0, 3);

      type AttentionItem = {
        kind: "overdue" | "damage" | "lowstock";
        title: string;
        meta: string;
        href: string;
      };
      const items: AttentionItem[] = [];

      for (const h of overdueHires) {
        const total = h.equipmentItems.length;
        const outstanding = h.equipmentItems.filter((i) => !i.returnedAt).length;
        const days = h.endDate ? Math.floor((now - h.endDate.getTime()) / 86400000) : 0;
        items.push({
          kind:  "overdue",
          title: h.hireCustomer.productionName,
          meta:  `${outstanding} of ${total} on hire · ${days}d overdue`,
          href:  `/cross-hire/${h.id}`,
        });
      }
      for (const d of recentDamage) {
        const reporter = d.reporter.displayName ?? d.reporter.email;
        items.push({
          kind:  "damage",
          title: `${d.equipment.name} #${d.equipment.serial}`,
          meta:  `Reported by ${reporter}`,
          href:  `/damage`,
        });
      }
      for (const ls of lowStock) {
        items.push({
          kind:  "lowstock",
          title: ls.name,
          meta:  `${ls.available} of ${ls.total} available`,
          href:  `/equipment`,
        });
      }

      return items;
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
