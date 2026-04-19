import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";
import { type WorkspaceRole } from "@prisma/client";

const OPERATOR_ROLES: WorkspaceRole[] = ["owner", "admin", "manager", "operator"];
const MANAGER_ROLES: WorkspaceRole[] = ["owner", "admin", "manager"];

function requireRole(userRole: WorkspaceRole | null, allowed: WorkspaceRole[]) {
  if (!userRole || !allowed.includes(userRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

export const checkEventRouter = router({
  checkOut: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        equipmentIds: z.array(z.string()).min(1).max(50),
        productionName: z.string().optional(),
        studioId: z.string().optional(),
        stageId: z.string().optional(),
        onLocationId: z.string().optional(),
        setId: z.string().optional(),
        positionType: z
          .enum([
            "on_set",
            "rigged_to_outside_of_set",
            "inside_prop_make",
            "in_prop_dressing",
          ])
          .optional(),
        positionDescription: z.string().optional(),
        exactLocationDescription: z.string().optional(),
        forceCheckOut: z.boolean().optional(), // BUG-009: manager+ override for already-checked-out items
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, OPERATOR_ROLES);

      const isManager = MANAGER_ROLES.includes(ctx.userRole!);

      // Check for duplicate ids in batch
      const unique = new Set(input.equipmentIds);
      if (unique.size !== input.equipmentIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Duplicate equipment IDs in batch",
        });
      }

      // Fetch all equipment items
      const items = await ctx.prisma.equipment.findMany({
        where: { id: { in: input.equipmentIds }, workspaceId: ctx.workspaceId! },
        select: { id: true, serial: true, status: true, damageStatus: true },
      });

      // Verify all belong to workspace
      if (items.length !== input.equipmentIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or more equipment items not found in this workspace",
        });
      }

      // Validate each item
      for (const item of items) {
        if (item.status === "retired") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Equipment ${item.serial} is retired and cannot be checked out`,
          });
        }
        if (item.status === "checked_out") {
          // BUG-009: manager+ can force check-out; operators cannot
          if (!isManager || !input.forceCheckOut) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `Equipment ${item.serial} is already checked out — managers can use forceCheckOut to override`,
            });
          }
        }
        if (item.damageStatus === "damaged" || item.damageStatus === "under_repair") {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Equipment ${item.serial} cannot be checked out due to damage status`,
          });
        }
      }

      const userId = ctx.session.user.id;
      const locationLabel =
        input.productionName ?? input.studioId ?? "unknown location";

      const events = await ctx.prisma.$transaction(async (tx) => {
        const createdEvents = [];

        for (const item of items) {
          const event = await tx.checkEvent.create({
            data: {
              workspaceId: ctx.workspaceId!,
              equipmentId: item.id,
              userId,
              eventType: "check_out",
              productionName: input.productionName,
              studioId: input.studioId,
              stageId: input.stageId,
              onLocationId: input.onLocationId,
              setId: input.setId,
              positionType: input.positionType,
              positionDescription: input.positionDescription,
              exactLocationDescription: input.exactLocationDescription,
            },
          });
          createdEvents.push(event);

          // BUG-010: include workspaceId in update where clause (atomic ownership check)
          await tx.equipment.updateMany({
            where: { id: item.id, workspaceId: ctx.workspaceId! },
            data: { status: "checked_out" },
          });

          const isForced = input.forceCheckOut && item.status === "checked_out";
          await tx.activityEvent.create({
            data: {
              workspaceId: ctx.workspaceId!,
              actorId: userId,
              eventType: isForced ? "force_check_out" : "check_out",
              description: isForced
                ? `Force checked out to ${locationLabel} (was already checked out)`
                : `Checked out to ${locationLabel}`,
              entityType: "equipment",
              entityId: item.id,
            },
          });
        }

        return createdEvents;
      });

      return { checkedOut: events.length, events };
    }),

  checkIn: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        equipmentIds: z.array(z.string()).min(1).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, OPERATOR_ROLES);

      const unique = new Set(input.equipmentIds);
      if (unique.size !== input.equipmentIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Duplicate equipment IDs in batch",
        });
      }

      const items = await ctx.prisma.equipment.findMany({
        where: { id: { in: input.equipmentIds }, workspaceId: ctx.workspaceId! },
        select: { id: true, serial: true, status: true, damageStatus: true },
      });

      if (items.length !== input.equipmentIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or more equipment items not found in this workspace",
        });
      }

      const isManager = MANAGER_ROLES.includes(ctx.userRole!);

      for (const item of items) {
        if (item.status === "retired") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Equipment ${item.serial} is retired`,
          });
        }
        if (item.status === "available" && !isManager) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Equipment ${item.serial} is already available — only managers can force check-in`,
          });
        }
      }

      const userId = ctx.session.user.id;

      await ctx.prisma.$transaction(async (tx) => {
        for (const item of items) {
          await tx.checkEvent.create({
            data: {
              workspaceId: ctx.workspaceId!,
              equipmentId: item.id,
              userId,
              eventType: "check_in",
            },
          });

          // BUG-010: include workspaceId in update where clause (atomic ownership check)
          // If item has an active damage status, keep it as-is (status stays available
          // but damageStatus remains damaged/under_repair — do not silently clear damage).
          // Only set status: available; damage must be resolved via the repair flow.
          await tx.equipment.updateMany({
            where: { id: item.id, workspaceId: ctx.workspaceId! },
            data: { status: "available" },
          });

          await tx.activityEvent.create({
            data: {
              workspaceId: ctx.workspaceId!,
              actorId: userId,
              eventType: "check_in",
              description: item.damageStatus && item.damageStatus !== "repaired"
                ? `Checked in (damage status: ${item.damageStatus})`
                : "Checked in",
              entityType: "equipment",
              entityId: item.id,
            },
          });
        }
      });

      return { checkedIn: items.length };
    }),

  listByEquipment: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        equipmentId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const events = await ctx.prisma.checkEvent.findMany({
        where: {
          equipmentId: input.equipmentId,
          workspaceId: ctx.workspaceId!,
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        include: {
          user: { select: { id: true, displayName: true, email: true } },
          studio: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true } },
          set: { select: { id: true, name: true } },
        },
      });

      let nextCursor: string | undefined;
      if (events.length > input.limit) {
        const nextItem = events.pop();
        nextCursor = nextItem?.id;
      }

      return { events, nextCursor };
    }),
});
