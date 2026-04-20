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
  /** Suggest the next free 5-digit serial for this workspace. */
  nextSerial: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      // Highest existing numeric serial
      const max = await ctx.prisma.equipment.findFirst({
        where: { workspaceId: ctx.workspaceId! },
        orderBy: { serial: "desc" },
        select: { serial: true },
      });
      const n = max ? parseInt(max.serial, 10) : 0;
      const next = Math.max(1, n + 1);
      if (next > 99999) throw new TRPCError({ code: "BAD_REQUEST", message: "Serial pool exhausted" });
      return {
        last:  max?.serial ?? null,
        next:  String(next).padStart(5, "0"),
      };
    }),

  /** Check whether a specific 5-digit serial is free. */
  checkSerial: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), serial: z.string().regex(/^\d{5}$/) }))
    .query(async ({ ctx, input }) => {
      const existing = await ctx.prisma.equipment.findUnique({
        where: { workspaceId_serial: { workspaceId: ctx.workspaceId!, serial: input.serial } },
        select: { id: true, name: true },
      });
      return { available: !existing, existing: existing ?? null };
    }),

  /** Create a batch of equipment for a single product/name. */
  createBatch: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      productId:   z.string().optional(),
      name:        z.string().min(1),
      categoryId:  z.string().optional(),
      serials:     z.array(z.string().regex(/^\d{5}$/)).min(1).max(500),
      notes:       z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      // Check none of the serials are already taken
      const conflicts = await ctx.prisma.equipment.findMany({
        where: {
          workspaceId: ctx.workspaceId!,
          serial: { in: input.serials },
        },
        select: { serial: true },
      });
      if (conflicts.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Serials already in use: ${conflicts.map((c) => c.serial).join(", ")}`,
        });
      }

      // Dedupe in the batch itself
      const unique = new Set(input.serials);
      if (unique.size !== input.serials.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Duplicate serials in batch" });
      }

      const userId = ctx.session.user.id;

      return ctx.prisma.$transaction(async (tx) => {
        const created = [];
        for (const serial of input.serials) {
          const eq = await tx.equipment.create({
            data: {
              workspaceId: ctx.workspaceId!,
              serial,
              name:       input.name,
              categoryId: input.categoryId,
              productId:  input.productId,
              notes:      input.notes,
            },
          });
          created.push(eq);
          await tx.activityEvent.create({
            data: {
              workspaceId: ctx.workspaceId!,
              actorId:     userId,
              eventType:   "equipment_created",
              description: `Created ${serial} (${input.name})`,
              entityType:  "equipment",
              entityId:    eq.id,
            },
          });
        }
        return { created: created.length, items: created };
      });
    }),

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
          include: { category: true, product: true },
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

  getDetail: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), equipmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const equipment = await ctx.prisma.equipment.findFirst({
        where: { id: input.equipmentId, workspaceId: ctx.workspaceId! },
        include: {
          category: true,
          checkEvents: {
            orderBy: { createdAt: "desc" },
            include: { user: true, studio: true, stage: true, set: true, onLocation: true },
          },
          damageReports: {
            orderBy: { reportedAt: "desc" },
            include: {
              reporter: true,
              repairLogs: {
                orderBy: { repairedAt: "desc" },
                include: { repairer: true },
              },
            },
          },
        },
      });
      if (!equipment) throw new TRPCError({ code: "NOT_FOUND", message: "Equipment not found" });
      return equipment;
    }),

  create: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        serial: z.string().regex(/^\d{5}$/, "Serial must be exactly 5 digits"),
        name: z.string().min(1),
        categoryId: z.string().optional(),
        parentId: z.string().optional(),
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

      // BUG-017: verify parentId belongs to the same workspace before allowing assignment
      if (input.parentId) {
        const parent = await ctx.prisma.equipment.findFirst({
          where: { id: input.parentId, workspaceId: ctx.workspaceId! },
          select: { id: true },
        });
        if (!parent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Parent equipment not found in this workspace",
          });
        }
      }

      return ctx.prisma.$transaction(async (tx) => {
        const equipment = await tx.equipment.create({
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
        // BUG-011: write ActivityEvent on create
        await tx.activityEvent.create({
          data: {
            workspaceId: ctx.workspaceId!,
            actorId: ctx.session!.user.id,
            eventType: "equipment_created",
            description: `Equipment ${input.serial} “${input.name}” added`,
            entityType: "equipment",
            entityId: equipment.id,
          },
        });
        return equipment;
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

  // ─── Sprint 3 prep ───────────────────────────────────────────────────────────

  update: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        equipmentId: z.string(),
        name: z.string().min(1).optional(),
        categoryId: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        assetValue: z.number().positive().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const { equipmentId, workspaceId: _, ...fields } = input;

      // Build update payload — only include fields that were explicitly passed
      const data: Record<string, unknown> = {};
      if (fields.name !== undefined) data.name = fields.name;
      if (fields.categoryId !== undefined) data.categoryId = fields.categoryId;
      if (fields.notes !== undefined) data.notes = fields.notes;
      if (fields.assetValue !== undefined) data.assetValue = fields.assetValue;

      if (Object.keys(data).length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No fields provided to update" });
      }

      return ctx.prisma.$transaction(async (tx) => {
        const result = await tx.equipment.updateMany({
          where: { id: equipmentId, workspaceId: ctx.workspaceId! },
          data,
        });

        if (result.count === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Equipment not found" });
        }

        const updated = await tx.equipment.findUnique({
          where: { id: equipmentId },
          include: { category: true },
        });

        await tx.activityEvent.create({
          data: {
            workspaceId: ctx.workspaceId!,
            actorId: ctx.session!.user.id,
            eventType: "equipment_updated",
            description: `Equipment ${updated!.serial} "${updated!.name}" updated`,
            entityType: "equipment",
            entityId: equipmentId,
          },
        });

        return updated;
      });
    }),

  importCsv: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        csv: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const lines = input.csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "CSV must have a header row and at least one data row" });
      }

      // Skip header row
      const dataLines = lines.slice(1);

      const errors: Array<{ row: number; serial: string; error: string }> = [];
      const validRows: Array<{ serial: string; name: string; categoryName?: string; notes?: string }> = [];
      const seenSerials = new Set<string>();

      for (let i = 0; i < dataLines.length; i++) {
        const rowNumber = i + 2; // 1-indexed, accounting for header
        const line = dataLines[i];
        const cols = line.split(",").map((c) => c.trim());
        const [serial, name, category, notes] = cols;

        if (!serial) {
          errors.push({ row: rowNumber, serial: serial ?? "", error: "Serial is required" });
          continue;
        }
        if (!/^\d{5}$/.test(serial)) {
          errors.push({ row: rowNumber, serial, error: "Serial must be exactly 5 digits" });
          continue;
        }
        if (!name || name.length === 0) {
          errors.push({ row: rowNumber, serial, error: "Name is required" });
          continue;
        }
        if (seenSerials.has(serial)) {
          errors.push({ row: rowNumber, serial, error: "Duplicate serial within CSV" });
          continue;
        }

        seenSerials.add(serial);
        validRows.push({
          serial,
          name,
          categoryName: category && category.length > 0 ? category : undefined,
          notes: notes && notes.length > 0 ? notes : undefined,
        });
      }

      if (validRows.length === 0) {
        return { imported: 0, errors };
      }

      // Check for serials already existing in the workspace
      const existingSerials = await ctx.prisma.equipment.findMany({
        where: { workspaceId: ctx.workspaceId!, serial: { in: validRows.map((r) => r.serial) } },
        select: { serial: true },
      });
      const existingSerialSet = new Set(existingSerials.map((e) => e.serial));

      const importableRows = validRows.filter((row) => {
        if (existingSerialSet.has(row.serial)) {
          // Find the original row number for this serial
          const rowIndex = dataLines.findIndex((l) => l.split(",")[0]?.trim() === row.serial);
          errors.push({ row: rowIndex + 2, serial: row.serial, error: "Serial already exists in this workspace" });
          return false;
        }
        return true;
      });

      if (importableRows.length === 0) {
        return { imported: 0, errors };
      }

      // Resolve/create categories
      const categoryNames = Array.from(new Set(importableRows.map((r) => r.categoryName).filter((n): n is string => !!n)));
      const categoryMap = new Map<string, string>();

      for (const catName of categoryNames) {
        const existing = await ctx.prisma.equipmentCategory.findUnique({
          where: { workspaceId_name: { workspaceId: ctx.workspaceId!, name: catName } },
          select: { id: true },
        });
        if (existing) {
          categoryMap.set(catName, existing.id);
        } else {
          const created = await ctx.prisma.equipmentCategory.create({
            data: { workspaceId: ctx.workspaceId!, name: catName, groupName: catName },
            select: { id: true },
          });
          categoryMap.set(catName, created.id);
        }
      }

      await ctx.prisma.$transaction(async (tx) => {
        await tx.equipment.createMany({
          data: importableRows.map((row) => ({
            workspaceId: ctx.workspaceId!,
            serial: row.serial,
            name: row.name,
            categoryId: row.categoryName ? categoryMap.get(row.categoryName) : undefined,
            notes: row.notes,
          })),
        });

        await tx.activityEvent.create({
          data: {
            workspaceId: ctx.workspaceId!,
            actorId: ctx.session!.user.id,
            eventType: "csv_import",
            description: `Imported ${importableRows.length} equipment items via CSV`,
            entityType: "equipment",
            entityId: ctx.workspaceId!,
          },
        });
      });

      return { imported: importableRows.length, errors };
    }),

  retire: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        equipmentId: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const equipment = await ctx.prisma.equipment.findFirst({
        where: { id: input.equipmentId, workspaceId: ctx.workspaceId! },
        select: { id: true, serial: true, name: true, status: true },
      });

      if (!equipment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Equipment not found" });
      }

      if (equipment.status === "retired") {
        throw new TRPCError({ code: "CONFLICT", message: "Equipment is already retired" });
      }

      if (equipment.status === "checked_out") {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Equipment ${equipment.serial} is currently checked out — check it in before retiring`,
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.equipment.updateMany({
          where: { id: input.equipmentId, workspaceId: ctx.workspaceId! },
          data: { status: "retired" },
        });

        await tx.activityEvent.create({
          data: {
            workspaceId: ctx.workspaceId!,
            actorId: ctx.session!.user.id,
            eventType: "equipment_retired",
            description: input.reason
              ? `Equipment ${equipment.serial} "${equipment.name}" retired: ${input.reason}`
              : `Equipment ${equipment.serial} "${equipment.name}" retired`,
            entityType: "equipment",
            entityId: input.equipmentId,
          },
        });

        return { retired: true, equipmentId: input.equipmentId };
      });
    }),
});
