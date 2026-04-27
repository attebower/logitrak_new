import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Decimal } from "@prisma/client/runtime/library";
import { router, workspaceProcedure } from "../trpc";
import { type WorkspaceRole } from "@prisma/client";
import { normaliseProductName, normaliseDescription, productSearchKey } from "@/lib/normalise";

const MANAGER_ROLES: WorkspaceRole[] = ["owner", "admin", "manager"];

function requireRole(userRole: WorkspaceRole | null, allowed: WorkspaceRole[]) {
  if (!userRole || !allowed.includes(userRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

const rateString = z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid rate");

export const productRouter = router({
  /** Search the workspace product catalog for autocomplete. */
  search: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      query:       z.string().max(120).default(""),
      limit:       z.number().min(1).max(50).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const key = productSearchKey(input.query);
      return ctx.prisma.equipmentProduct.findMany({
        where: {
          workspaceId: ctx.workspaceId!,
          ...(key
            ? { searchKey: { contains: key, mode: "insensitive" } }
            : {}),
        },
        include: { category: { select: { id: true, name: true, groupName: true } } },
        orderBy: { name: "asc" },
        take: input.limit,
      });
    }),

  /** Create a new product in the workspace catalog. */
  create: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      name:        z.string().min(1).max(200),
      categoryId:  z.string().optional(),
      description: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, MANAGER_ROLES);

      const name = normaliseProductName(input.name);
      const searchKey = productSearchKey(name);
      if (!name || !searchKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Product name is required" });
      }

      // Dedupe on searchKey
      const existing = await ctx.prisma.equipmentProduct.findFirst({
        where: { workspaceId: ctx.workspaceId!, searchKey },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `"${existing.name}" already exists in the catalog`,
        });
      }

      return ctx.prisma.equipmentProduct.create({
        data: {
          workspaceId: ctx.workspaceId!,
          name,
          searchKey,
          categoryId:  input.categoryId,
          description: input.description ? normaliseDescription(input.description) : null,
        },
      });
    }),

  /** Update an existing product in the catalog. */
  update: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      productId:   z.string(),
      name:        z.string().min(1).max(200).optional(),
      categoryId:  z.string().nullable().optional(),
      description: z.string().max(2000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, MANAGER_ROLES);

      const product = await ctx.prisma.equipmentProduct.findFirst({
        where: { id: input.productId, workspaceId: ctx.workspaceId! },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

      const data: Record<string, unknown> = {};
      if (input.name !== undefined) {
        data.name      = normaliseProductName(input.name);
        data.searchKey = productSearchKey(String(data.name));
      }
      if (input.categoryId !== undefined)  data.categoryId  = input.categoryId;
      if (input.description !== undefined) data.description = input.description ? normaliseDescription(input.description) : null;

      return ctx.prisma.equipmentProduct.update({
        where: { id: input.productId },
        data,
      });
    }),

  /** List products with their default hire rates (powers the Rental Rates submenu). */
  listRates: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const products = await ctx.prisma.equipmentProduct.findMany({
        where: { workspaceId: ctx.workspaceId! },
        include: {
          category: { select: { name: true } },
          _count:   { select: { equipment: true, rateHistory: true } },
        },
        orderBy: { name: "asc" },
      });

      return products.map((p) => ({
        id:                    p.id,
        name:                  p.name,
        categoryName:          p.category?.name ?? null,
        defaultDailyHireRate:  p.defaultDailyHireRate ? p.defaultDailyHireRate.toString() : null,
        defaultWeeklyHireRate: p.defaultWeeklyHireRate ? p.defaultWeeklyHireRate.toString() : null,
        equipmentCount:        p._count.equipment,
        rateHistoryCount:      p._count.rateHistory,
      }));
    }),

  /** Get rate change history for a single product. */
  rateHistory: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), productId: z.string() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.prisma.equipmentProduct.findFirst({
        where:  { id: input.productId, workspaceId: ctx.workspaceId! },
        select: { id: true },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.equipmentProductRateHistory.findMany({
        where:   { productId: input.productId },
        orderBy: { recordedAt: "desc" },
        take:    100,
      });
    }),

  /** Manually set the default rates for a product and append a history row. */
  setRates: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      productId:   z.string(),
      dailyRate:   rateString,
      weeklyRate:  rateString.optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, MANAGER_ROLES);

      const product = await ctx.prisma.equipmentProduct.findFirst({
        where: { id: input.productId, workspaceId: ctx.workspaceId! },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });

      const dailyRate  = new Decimal(input.dailyRate);
      const weeklyRate = input.weeklyRate ? new Decimal(input.weeklyRate) : null;

      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.equipmentProduct.update({
          where: { id: input.productId },
          data: {
            defaultDailyHireRate:  dailyRate,
            defaultWeeklyHireRate: weeklyRate,
          },
        });
        await tx.equipmentProductRateHistory.create({
          data: {
            productId:    input.productId,
            dailyRate,
            weeklyRate,
            source:       "manual",
            recordedById: ctx.session.user.id,
          },
        });
        return updated;
      });
    }),

  /** Clear the default rates on a product (does not delete history). */
  clearRates: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), productId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, MANAGER_ROLES);

      const product = await ctx.prisma.equipmentProduct.findFirst({
        where: { id: input.productId, workspaceId: ctx.workspaceId! },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.equipmentProduct.update({
        where: { id: input.productId },
        data: {
          defaultDailyHireRate:  null,
          defaultWeeklyHireRate: null,
        },
      });
    }),
});
