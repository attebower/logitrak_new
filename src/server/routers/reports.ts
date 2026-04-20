import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";
import { EquipmentStatus, DamageStatus } from "@prisma/client";

export const reportsRouter = router({
  equipmentStatus: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        status: z.nativeEnum(EquipmentStatus).optional(),
        damageStatus: z.nativeEnum(DamageStatus).optional(),
        categoryId: z.string().optional(),
        studioId: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        workspaceId: ctx.workspaceId!,
        ...(input.status && { status: input.status }),
        ...(input.damageStatus && { damageStatus: input.damageStatus }),
        ...(input.categoryId && { categoryId: input.categoryId }),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.equipment.findMany({
          where,
          include: {
            category: { select: { name: true, groupName: true } },
            checkEvents: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                user: { select: { displayName: true } },
                studio: { select: { name: true } },
              },
            },
          },
          orderBy: { serial: "asc" },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.equipment.count({ where }),
      ]);

      return { items, total, limit: input.limit, offset: input.offset };
    }),

  checkedOut: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        studioId: z.string().optional(),
        stageId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const equipment = await ctx.prisma.equipment.findMany({
        where: {
          workspaceId: ctx.workspaceId!,
          status: "checked_out",
        },
        include: {
          category: { select: { name: true, groupName: true } },
          checkEvents: {
            where: { eventType: "check_out" },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              user: { select: { displayName: true } },
              studio: { select: { name: true } },
              stage: { select: { name: true } },
              set: { select: { name: true } },
            },
          },
        },
      });

      // Filter by location if provided, and sort by event.createdAt desc
      const filtered = equipment
        .filter((e) => {
          const evt = e.checkEvents[0];
          if (!evt) return true; // include items without a checkout event
          if (input.studioId && evt.studioId !== input.studioId) return false;
          if (input.stageId && evt.stageId !== input.stageId) return false;
          return true;
        })
        .sort((a, b) => {
          const aTime = a.checkEvents[0]?.createdAt.getTime() ?? 0;
          const bTime = b.checkEvents[0]?.createdAt.getTime() ?? 0;
          return bTime - aTime;
        });

      return filtered;
    }),

  damaged: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const equipment = await ctx.prisma.equipment.findMany({
        where: {
          workspaceId: ctx.workspaceId!,
          damageStatus: { in: ["damaged", "under_repair"] },
        },
        include: {
          category: { select: { name: true, groupName: true } },
          damageReports: {
            orderBy: { reportedAt: "desc" },
            take: 1,
            include: {
              reporter: { select: { displayName: true } },
            },
          },
        },
        orderBy: { serial: "asc" },
      });

      // Sort by most recent damage report
      return equipment.sort((a, b) => {
        const aTime = a.damageReports[0]?.reportedAt.getTime() ?? 0;
        const bTime = b.damageReports[0]?.reportedAt.getTime() ?? 0;
        return bTime - aTime;
      });
    }),

  byLocation: workspaceProcedure
    .input(
      z.object({
        workspaceId:  z.string(),
        studioId:     z.string().optional(),
        stageId:      z.string().optional(),
        setId:        z.string().optional(),
        onLocationId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!input.studioId && !input.stageId && !input.setId && !input.onLocationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "At least one location filter is required",
        });
      }

      const equipment = await ctx.prisma.equipment.findMany({
        where: { workspaceId: ctx.workspaceId! },
        include: {
          category: { select: { name: true, groupName: true } },
          checkEvents: {
            where: { eventType: "check_out" },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              studio:     { select: { name: true } },
              stage:      { select: { name: true } },
              set:        { select: { name: true } },
              onLocation: { select: { name: true } },
              user:       { select: { displayName: true } },
            },
          },
        },
        orderBy: { serial: "asc" },
      });

      return equipment.filter((e) => {
        const latest = e.checkEvents[0];
        if (!latest) return false;
        if (input.studioId     && latest.studioId     !== input.studioId)     return false;
        if (input.stageId      && latest.stageId      !== input.stageId)      return false;
        if (input.setId        && latest.setId        !== input.setId)        return false;
        if (input.onLocationId && latest.onLocationId !== input.onLocationId) return false;
        return true;
      });
    }),

  activityLog: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        actorId: z.string().optional(),
        eventType: z.string().optional(),
        entityType: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        workspaceId: ctx.workspaceId!,
        ...(input.actorId && { actorId: input.actorId }),
        ...(input.eventType && { eventType: input.eventType }),
        ...(input.entityType && { entityType: input.entityType }),
        ...((input.startDate || input.endDate) && {
          createdAt: {
            ...(input.startDate && { gte: new Date(input.startDate) }),
            ...(input.endDate && { lte: new Date(input.endDate) }),
          },
        }),
      };

      const items = await ctx.prisma.activityEvent.findMany({
        where,
        include: {
          actor: { select: { displayName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop();
        nextCursor = next!.id;
      }

      return { items, nextCursor };
    }),

  wrapSummary: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        productionName: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const wid = ctx.workspaceId!;

      const [
        totalEquipment,
        checkedOutBase,
        damaged,
        underRepair,
        repaired,
        retiredCount,
        recentActivity,
      ] = await ctx.prisma.$transaction([
        ctx.prisma.equipment.count({
          where: { workspaceId: wid, status: { not: "retired" } },
        }),
        ctx.prisma.equipment.count({
          where: { workspaceId: wid, status: "checked_out" },
        }),
        ctx.prisma.equipment.count({
          where: { workspaceId: wid, damageStatus: { not: "normal" } },
        }),
        ctx.prisma.equipment.count({
          where: { workspaceId: wid, damageStatus: "under_repair" },
        }),
        ctx.prisma.equipment.count({
          where: { workspaceId: wid, damageStatus: "repaired" },
        }),
        ctx.prisma.equipment.count({
          where: { workspaceId: wid, status: "retired" },
        }),
        ctx.prisma.activityEvent.findMany({
          where: { workspaceId: wid },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { actor: { select: { displayName: true, email: true } } },
        }),
      ]);

      // If productionName provided, override checkedOut count with production-scoped count
      let checkedOut = checkedOutBase;
      if (input.productionName) {
        const productionCheckouts = await ctx.prisma.checkEvent.findMany({
          where: {
            workspaceId: wid,
            eventType: "check_out",
            productionName: input.productionName,
          },
          select: { equipmentId: true },
          distinct: ["equipmentId"],
        });
        // Intersect with currently checked-out equipment
        const checkedOutEquipment = await ctx.prisma.equipment.findMany({
          where: { workspaceId: wid, status: "checked_out" },
          select: { id: true },
        });
        const checkedOutSet = new Set(checkedOutEquipment.map((e) => e.id));
        checkedOut = productionCheckouts.filter((c) =>
          checkedOutSet.has(c.equipmentId)
        ).length;
      }

      const returned = totalEquipment - checkedOut;

      return {
        totalEquipment,
        checkedOut,
        returned,
        damaged,
        underRepair,
        repaired,
        retiredCount,
        recentActivity,
      };
    }),
});
