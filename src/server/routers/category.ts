import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";
import { type WorkspaceRole } from "@prisma/client";

const ADMIN_ROLES: WorkspaceRole[] = ["owner", "admin"];

function requireRole(userRole: WorkspaceRole | null, allowed: WorkspaceRole[]) {
  if (!userRole || !allowed.includes(userRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

export const categoryRouter = router({
  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      return ctx.prisma.equipmentCategory.findMany({
        where: { workspaceId: ctx.workspaceId! },
        orderBy: [{ groupName: "asc" }, { name: "asc" }],
      });
    }),

  create: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().min(1).max(100),
        groupName: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const existing = await ctx.prisma.equipmentCategory.findUnique({
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
          message: `Category "${input.name}" already exists in this workspace`,
        });
      }

      return ctx.prisma.equipmentCategory.create({
        data: {
          workspaceId: ctx.workspaceId!,
          name: input.name,
          groupName: input.groupName,
        },
      });
    }),
});
