import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";
import { type WorkspaceRole } from "@prisma/client";

const ADMIN_ROLES: WorkspaceRole[] = ["owner", "admin"];
const MANAGER_ROLES: WorkspaceRole[] = ["owner", "admin", "manager"];

function requireRole(userRole: WorkspaceRole | null, allowed: WorkspaceRole[]) {
  if (!userRole || !allowed.includes(userRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

const studioRouter = router({
  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      return ctx.prisma.studio.findMany({
        where: { workspaceId: ctx.workspaceId! },
        orderBy: { name: "asc" },
        include: { _count: { select: { stages: true } } },
      });
    }),

  create: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().min(1).max(100),
        displayId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const existing = await ctx.prisma.studio.findUnique({
        where: {
          workspaceId_name: {
            workspaceId: ctx.workspaceId!,
            name: input.name,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Studio "${input.name}" already exists in this workspace`,
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        const studio = await tx.studio.create({
          data: { workspaceId: ctx.workspaceId!, name: input.name, displayId: input.displayId },
        });
        // BUG-011
        await tx.activityEvent.create({
          data: { workspaceId: ctx.workspaceId!, actorId: ctx.session!.user.id, eventType: "studio_created", description: `Studio "${input.name}" created`, entityType: "studio", entityId: studio.id },
        });
        return studio;
      });
    }),

  update: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        studioId: z.string(),
        name: z.string().min(1).max(100).optional(),
        displayId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.displayId !== undefined) data.displayId = input.displayId;

      if (Object.keys(data).length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No fields provided to update" });
      }

      const result = await ctx.prisma.studio.updateMany({
        where: { id: input.studioId, workspaceId: ctx.workspaceId! },
        data,
      });

      if (result.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Studio not found" });
      }

      return ctx.prisma.studio.findUnique({ where: { id: input.studioId } });
    }),

  delete: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        studioId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      // Check no active equipment is checked out to this studio
      const activeCheckout = await ctx.prisma.checkEvent.findFirst({
        where: {
          workspaceId: ctx.workspaceId!,
          studioId: input.studioId,
          eventType: "check_out",
          equipment: { status: "checked_out" },
        },
      });

      if (activeCheckout) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Cannot delete studio with active equipment checked out to it",
        });
      }

      const result = await ctx.prisma.studio.deleteMany({
        where: { id: input.studioId, workspaceId: ctx.workspaceId! },
      });

      if (result.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Studio not found" });
      }

      return { deleted: true, studioId: input.studioId };
    }),
});

const stageRouter = router({
  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), studioId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.stage.findMany({
        where: {
          studioId: input.studioId,
          studio: { workspaceId: ctx.workspaceId! },
        },
        orderBy: { name: "asc" },
        include: { _count: { select: { sets: true } } },
      });
    }),

  create: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        studioId: z.string(),
        name: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      // Verify studio belongs to workspace
      const studio = await ctx.prisma.studio.findFirst({
        where: { id: input.studioId, workspaceId: ctx.workspaceId! },
      });
      if (!studio) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Studio not found" });
      }

      const existing = await ctx.prisma.stage.findUnique({
        where: { studioId_name: { studioId: input.studioId, name: input.name } },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Stage "${input.name}" already exists in this studio`,
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        const stage = await tx.stage.create({
          data: { workspaceId: ctx.workspaceId!, studioId: input.studioId, name: input.name },
        });
        // BUG-011
        await tx.activityEvent.create({
          data: { workspaceId: ctx.workspaceId!, actorId: ctx.session!.user.id, eventType: "stage_created", description: `Stage "${input.name}" created`, entityType: "stage", entityId: stage.id },
        });
        return stage;
      });
    }),

  update: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        stageId: z.string(),
        name: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const result = await ctx.prisma.stage.updateMany({
        where: { id: input.stageId, studio: { workspaceId: ctx.workspaceId! } },
        data: { name: input.name },
      });

      if (result.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Stage not found" });
      }

      return ctx.prisma.stage.findUnique({ where: { id: input.stageId } });
    }),

  delete: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        stageId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      // Check no active equipment is checked out to this stage
      const activeCheckout = await ctx.prisma.checkEvent.findFirst({
        where: {
          workspaceId: ctx.workspaceId!,
          stageId: input.stageId,
          eventType: "check_out",
          equipment: { status: "checked_out" },
        },
      });

      if (activeCheckout) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Cannot delete stage with active equipment checked out to it",
        });
      }

      const result = await ctx.prisma.stage.deleteMany({
        where: { id: input.stageId, studio: { workspaceId: ctx.workspaceId! } },
      });

      if (result.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Stage not found" });
      }

      return { deleted: true, stageId: input.stageId };
    }),
});

const setRouter = router({
  list: workspaceProcedure
    .input(z.object({
      workspaceId:  z.string(),
      stageId:      z.string().optional(),
      onLocationId: z.string().optional(),
    }).refine((v) => !!v.stageId !== !!v.onLocationId, {
      message: "Provide exactly one of stageId or onLocationId",
    }))
    .query(async ({ ctx, input }) => {
      if (input.stageId) {
        return ctx.prisma.set.findMany({
          where: {
            stageId: input.stageId,
            stage: { studio: { workspaceId: ctx.workspaceId! } },
          },
          orderBy: { name: "asc" },
        });
      }
      return ctx.prisma.set.findMany({
        where: {
          onLocationId: input.onLocationId!,
          onLocation: { workspaceId: ctx.workspaceId! },
        },
        orderBy: { name: "asc" },
      });
    }),

  create: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        stageId: z.string(),
        name: z.string().min(1).max(100),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, MANAGER_ROLES);

      // Verify stage belongs to workspace
      const stage = await ctx.prisma.stage.findFirst({
        where: {
          id: input.stageId,
          studio: { workspaceId: ctx.workspaceId! },
        },
      });
      if (!stage) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Stage not found" });
      }

      const existing = await ctx.prisma.set.findUnique({
        where: { stageId_name: { stageId: input.stageId, name: input.name } },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Set "${input.name}" already exists in this stage`,
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        const set = await tx.set.create({
          data: { workspaceId: ctx.workspaceId!, stageId: input.stageId, name: input.name, description: input.description },
        });
        // BUG-011
        await tx.activityEvent.create({
          data: { workspaceId: ctx.workspaceId!, actorId: ctx.session!.user.id, eventType: "set_created", description: `Set "${input.name}" created`, entityType: "set", entityId: set.id },
        });
        return set;
      });
    }),

  update: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        setId: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, MANAGER_ROLES);

      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.description !== undefined) data.description = input.description;

      if (Object.keys(data).length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No fields provided to update" });
      }

      const result = await ctx.prisma.set.updateMany({
        where: { id: input.setId, stage: { studio: { workspaceId: ctx.workspaceId! } } },
        data,
      });

      if (result.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Set not found" });
      }

      return ctx.prisma.set.findUnique({ where: { id: input.setId } });
    }),

  delete: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        setId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, MANAGER_ROLES);

      // Check no active equipment is checked out to this set
      const activeCheckout = await ctx.prisma.checkEvent.findFirst({
        where: {
          workspaceId: ctx.workspaceId!,
          setId: input.setId,
          eventType: "check_out",
          equipment: { status: "checked_out" },
        },
      });

      if (activeCheckout) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Cannot delete set with active equipment checked out to it",
        });
      }

      const result = await ctx.prisma.set.deleteMany({
        where: { id: input.setId, stage: { studio: { workspaceId: ctx.workspaceId! } } },
      });

      if (result.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Set not found" });
      }

      return { deleted: true, setId: input.setId };
    }),
});

export const locationRouter = router({
  studio: studioRouter,
  stage: stageRouter,
  set: setRouter,
});
