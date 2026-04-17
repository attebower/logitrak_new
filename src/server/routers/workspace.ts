import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, workspaceProcedure } from "../trpc";
import { IndustryType, WorkspaceRole } from "@prisma/client";

const ADMIN_ROLES: WorkspaceRole[] = ["owner", "admin"];

function requireRole(userRole: WorkspaceRole | null, allowed: WorkspaceRole[]) {
  if (!userRole || !allowed.includes(userRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

export const workspaceRouter = router({
  get: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.workspaceId! },
        include: {
          _count: {
            select: {
              members: { where: { isActive: true } },
              equipment: true,
            },
          },
        },
      });

      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
      }

      return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        industryType: workspace.industryType,
        subscriptionTier: workspace.subscriptionTier,
        subscriptionStatus: workspace.subscriptionStatus,
        trialEndsAt: workspace.trialEndsAt,
        maxUsers: workspace.maxUsers,
        maxAssets: workspace.maxAssets,
        memberCount: workspace._count.members,
        equipmentCount: workspace._count.equipment,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2),
        industryType: z.nativeEnum(IndustryType),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // BUG-015: wrap in try/catch and handle P2002 (unique constraint violation)
      // atomically — avoids the findUnique + create race condition
      try {
        const workspace = await ctx.prisma.workspace.create({
          data: {
            name: input.name,
            slug,
            industryType: input.industryType,
            members: {
              create: {
                userId: ctx.session.user.id,
                role: "owner",
                joinedAt: new Date(),
                isActive: true,
              },
            },
          },
        });
        return workspace;
      } catch (err: unknown) {
        if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Workspace name already taken — please choose a different name",
          });
        }
        throw err;
      }
    }),

  update: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().min(2).optional(),
        industryType: z.nativeEnum(IndustryType).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const data: { name?: string; slug?: string; industryType?: IndustryType } = {};
      if (input.name !== undefined) {
        data.name = input.name;
        data.slug = input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      }
      if (input.industryType !== undefined) {
        data.industryType = input.industryType;
      }

      if (Object.keys(data).length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No fields to update" });
      }

      try {
        return await ctx.prisma.workspace.update({
          where: { id: ctx.workspaceId! },
          data,
          select: { id: true, name: true, slug: true, industryType: true },
        });
      } catch (err: unknown) {
        if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "Workspace name already taken" });
        }
        throw err;
      }
    }),

  listMyWorkspaces: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.prisma.workspaceUser.findMany({
      where: {
        userId: ctx.session.user.id,
        isActive: true,
      },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                members: { where: { isActive: true } },
                equipment: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" }, // BUG-016: joinedAt is nullable; createdAt is always set
    });

    return memberships.map((m) => ({
      role: m.role,
      joinedAt: m.joinedAt,
      workspace: {
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        industryType: m.workspace.industryType,
        subscriptionTier: m.workspace.subscriptionTier,
        subscriptionStatus: m.workspace.subscriptionStatus,
        memberCount: m.workspace._count.members,
        equipmentCount: m.workspace._count.equipment,
      },
    }));
  }),
});
