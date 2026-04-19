import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";
import { type WorkspaceRole } from "@prisma/client";
import { getDepartmentCategories, DEPARTMENT_LABELS } from "@/lib/department-catalog";

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

  /**
   * Install the default category catalog for a department.
   * Safe to re-run: skips categories that already exist (by workspaceId + name).
   * If `department` is omitted, uses the workspace's current department field.
   */
  installDefaults: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      department:  z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const workspace = await ctx.prisma.workspace.findFirst({
        where: { id: ctx.workspaceId! },
        select: { department: true },
      });
      if (!workspace) throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });

      const dept = (input.department ?? workspace.department ?? "").toLowerCase();
      const defaults = getDepartmentCategories(dept);
      if (defaults.length === 0) {
        return {
          installed: 0,
          skipped:   0,
          department: dept || null,
          message:   dept
            ? `No default categories defined for ${DEPARTMENT_LABELS[dept as keyof typeof DEPARTMENT_LABELS] ?? dept}`
            : "No department set on this workspace",
        };
      }

      // Find existing category names to skip
      const existing = await ctx.prisma.equipmentCategory.findMany({
        where: {
          workspaceId: ctx.workspaceId!,
          name: { in: defaults.map((d) => d.name) },
        },
        select: { name: true },
      });
      const existingSet = new Set(existing.map((c) => c.name));

      const toCreate = defaults.filter((d) => !existingSet.has(d.name));

      if (toCreate.length > 0) {
        await ctx.prisma.equipmentCategory.createMany({
          data: toCreate.map((d) => ({
            workspaceId: ctx.workspaceId!,
            name:        d.name,
            groupName:   d.groupName,
          })),
        });
      }

      return {
        installed:  toCreate.length,
        skipped:    existingSet.size,
        department: dept,
      };
    }),
});
