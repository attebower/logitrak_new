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

export const locationRouter = router({
  studio: router({
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

        return ctx.prisma.studio.create({
          data: {
            workspaceId: ctx.workspaceId!,
            name: input.name,
            displayId: input.displayId,
          },
        });
      }),
  }),

  stage: router({
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

        return ctx.prisma.stage.create({
          data: {
            workspaceId: ctx.workspaceId!,
            studioId: input.studioId,
            name: input.name,
          },
        });
      }),
  }),

  set: router({
    list: workspaceProcedure
      .input(z.object({ workspaceId: z.string(), stageId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.prisma.set.findMany({
          where: {
            stageId: input.stageId,
            stage: { studio: { workspaceId: ctx.workspaceId! } },
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

        return ctx.prisma.set.create({
          data: {
            workspaceId: ctx.workspaceId!,
            stageId: input.stageId,
            name: input.name,
            description: input.description,
          },
        });
      }),
  }),
});
