import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { router, workspaceProcedure } from "../trpc";
import { type WorkspaceRole } from "@prisma/client";

const OPERATOR_ROLES: WorkspaceRole[] = ["owner", "admin", "manager", "operator"];
const MANAGER_ROLES: WorkspaceRole[] = ["owner", "admin", "manager"];

function requireRole(userRole: WorkspaceRole | null, allowed: WorkspaceRole[]) {
  if (!userRole || !allowed.includes(userRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

const damageReportRouter = router({
  create: workspaceProcedure
    .input(
      z.object({
        workspaceId:    z.string(),
        equipmentId:    z.string(),
        description:    z.string().min(1),
        damageLocation: z.string().optional(), // where on set
        itemLocation:   z.string().optional(), // location on the physical item
        reportedAt:     z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, OPERATOR_ROLES);

      const equipment = await ctx.prisma.equipment.findFirst({
        where: { id: input.equipmentId, workspaceId: ctx.workspaceId! },
        select: { id: true, status: true },
      });

      if (!equipment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Equipment not found" });
      }
      if (equipment.status === "retired") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot report damage on retired equipment",
        });
      }

      const userId = ctx.session.user.id;
      const shortDesc = input.description.slice(0, 50);
      const wasCheckedOut = equipment.status === "checked_out";

      return ctx.prisma.$transaction(async (tx) => {
        const report = await tx.damageReport.create({
          data: {
            workspaceId:    ctx.workspaceId!,
            equipmentId:    input.equipmentId,
            reporterId:     userId,
            description:    input.description,
            damageLocation: input.damageLocation,
            itemLocation:   input.itemLocation,
            reportedAt:     input.reportedAt ?? new Date(),
          },
        });

        // If item was checked out, force a check-in before entering damage workflow.
        // An item cannot be both checked_out and damaged — it must be returned first.
        if (wasCheckedOut) {
          await tx.checkEvent.create({
            data: {
              workspaceId: ctx.workspaceId!,
              equipmentId: input.equipmentId,
              userId,
              eventType: "check_in",
            },
          });
        }

        // Set damageStatus to damaged; also clear checked_out status if it was out
        await tx.equipment.updateMany({
          where: { id: input.equipmentId, workspaceId: ctx.workspaceId! },
          data: {
            damageStatus: "damaged",
            ...(wasCheckedOut && { status: "available" }),
          },
        });

        if (wasCheckedOut) {
          await tx.activityEvent.create({
            data: {
              workspaceId: ctx.workspaceId!,
              actorId: userId,
              eventType: "check_in",
              description: `Auto checked-in on damage report`,
              entityType: "equipment",
              entityId: input.equipmentId,
            },
          });
        }

        await tx.activityEvent.create({
          data: {
            workspaceId: ctx.workspaceId!,
            actorId: userId,
            eventType: "damage_reported",
            description: `Damage reported: ${shortDesc}`,
            entityType: "equipment",
            entityId: input.equipmentId,
          },
        });

        return report;
      });
    }),

  listByEquipment: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        equipmentId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const equipment = await ctx.prisma.equipment.findFirst({
        where: { id: input.equipmentId, workspaceId: ctx.workspaceId! },
        select: { id: true },
      });

      if (!equipment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Equipment not found" });
      }

      return ctx.prisma.damageReport.findMany({
        where: { equipmentId: input.equipmentId, workspaceId: ctx.workspaceId! },
        orderBy: { reportedAt: "desc" },
        include: {
          reporter: { select: { id: true, displayName: true, email: true } },
          repairLogs: {
            orderBy: { repairedAt: "desc" },
            include: {
              repairer: { select: { id: true, displayName: true, email: true } },
            },
          },
        },
      });
    }),

  listActive: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      return ctx.prisma.damageReport.findMany({
        where: {
          workspaceId: ctx.workspaceId!,
          equipment: { damageStatus: { in: ["damaged", "under_repair"] } },
        },
        orderBy: { reportedAt: "desc" },
        include: {
          equipment: {
            select: {
              id: true,
              serial: true,
              name: true,
              status: true,
              damageStatus: true,
              category: { select: { name: true, groupName: true } },
            },
          },
          reporter: { select: { id: true, displayName: true, email: true } },
          repairLogs: {
            orderBy: { repairedAt: "desc" },
            take: 1,
            include: {
              repairer: { select: { id: true, displayName: true, email: true } },
            },
          },
        },
      });
    }),

  listAll: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        // true = repaired only, false = active only, omit = all
        resolved: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const damageStatusFilter: Prisma.EquipmentWhereInput =
        input.resolved === true
          ? { damageStatus: { in: ["repaired"] } }
          : input.resolved === false
          ? { damageStatus: { in: ["damaged", "under_repair"] } }
          : {};

      return ctx.prisma.damageReport.findMany({
        where: {
          workspaceId: ctx.workspaceId!,
          equipment: damageStatusFilter,
        },
        orderBy: { reportedAt: "desc" },
        include: {
          equipment: {
            select: {
              id: true,
              serial: true,
              name: true,
              status: true,
              damageStatus: true,
              category: { select: { name: true, groupName: true } },
            },
          },
          reporter: { select: { id: true, displayName: true, email: true } },
          repairLogs: {
            orderBy: { repairedAt: "desc" },
            include: {
              repairer: { select: { id: true, displayName: true, email: true } },
            },
          },
        },
      });
    }),
});

const repairLogRouter = router({
  create: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        equipmentId: z.string(),
        damageReportId: z.string().optional(),
        repairedByName: z.string().min(1),
        repairLocation: z.string().optional(),
        description: z.string().min(1),
        repairedAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, MANAGER_ROLES);

      const equipment = await ctx.prisma.equipment.findFirst({
        where: { id: input.equipmentId, workspaceId: ctx.workspaceId! },
        select: { id: true, status: true },
      });

      if (!equipment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Equipment not found" });
      }

      const userId = ctx.session.user.id;

      return ctx.prisma.$transaction(async (tx) => {
        const log = await tx.repairLog.create({
          data: {
            workspaceId: ctx.workspaceId!,
            equipmentId: input.equipmentId,
            damageReportId: input.damageReportId,
            repairerId: userId,
            repairedByName: input.repairedByName,
            repairLocation: input.repairLocation,
            description: input.description,
            repairedAt: input.repairedAt ?? new Date(),
          },
        });

        // BUG-010: include workspaceId atomically
        await tx.equipment.updateMany({
          where: { id: input.equipmentId, workspaceId: ctx.workspaceId! },
          data: {
            damageStatus: "repaired",
            ...(equipment.status !== "checked_out" && { status: "available" }),
          },
        });

        await tx.activityEvent.create({
          data: {
            workspaceId: ctx.workspaceId!,
            actorId: userId,
            eventType: "repair_logged",
            description: `Repair logged by ${input.repairedByName}`,
            entityType: "equipment",
            entityId: input.equipmentId,
          },
        });

        return log;
      });
    }),
});

export const damageRouter = router({
  report: damageReportRouter,
  repairLog: repairLogRouter,
});
