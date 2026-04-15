import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";
import { EquipmentStatus, DamageStatus, WorkspaceRole } from "@prisma/client";

const ADMIN_ROLES: WorkspaceRole[] = ["owner", "admin"];
const WRITE_ROLES: WorkspaceRole[] = ["owner", "admin", "manager", "operator"];

function requireRole(userRole: WorkspaceRole | null, allowed: WorkspaceRole[]) {
  if (!userRole || !allowed.includes(userRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

export const equipmentRouter = router({
  list: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        status: z.nativeEnum(EquipmentStatus).optional(),
        damageStatus: z.nativeEnum(DamageStatus).optional(),
        categoryId: z.string().optional(),
        search: z.string().optional(),
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
        ...(input.search && {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { serial: { contains: input.search, mode: "insensitive" as const } },
          ],
        }),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.equipment.findMany({
          where,
          include: { category: true },
          orderBy: { serial: "asc" },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.equipment.count({ where }),
      ]);

      return { items, total, limit: input.limit, offset: input.offset };
    }),

  get: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), equipmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const equipment = await ctx.prisma.equipment.findFirst({
        where: {
          id: input.equipmentId,
          workspaceId: ctx.workspaceId!,
        },
        include: {
          category: true,
          checkEvents: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { user: true, studio: true, stage: true, set: true },
          },
          damageReports: {
            orderBy: { reportedAt: "desc" },
            include: { reporter: true },
          },
        },
      });

      if (!equipment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Equipment not found" });
      }

      return equipment;
    }),

  create: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        serial: z.string().regex(/^\d{5}$/, "Serial must be exactly 5 digits"),
        name: z.string().min(1),
        categoryId: z.string().optional(),
        notes: z.string().optional(),
        assetValue: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const existing = await ctx.prisma.equipment.findUnique({
        where: {
          workspaceId_serial: {
            workspaceId: ctx.workspaceId!,
            serial: input.serial,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Serial ${input.serial} is already in use in this workspace`,
        });
      }

      return ctx.prisma.equipment.create({
        data: {
          workspaceId: ctx.workspaceId!,
          serial: input.serial,
          name: input.name,
          categoryId: input.categoryId,
          notes: input.notes,
          assetValue: input.assetValue,
        },
        include: { category: true },
      });
    }),

  updateStatus: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        equipmentId: z.string(),
        status: z.nativeEnum(EquipmentStatus),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, WRITE_ROLES);

      // BUG-012: use updateMany with workspaceId in the where clause so ownership
      // is enforced atomically at the DB level (avoids TOCTOU race condition)
      const result = await ctx.prisma.equipment.updateMany({
        where: { id: input.equipmentId, workspaceId: ctx.workspaceId! },
        data: { status: input.status },
      });

      if (result.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Equipment not found" });
      }

      return ctx.prisma.equipment.findUnique({ where: { id: input.equipmentId } });
    }),
});
