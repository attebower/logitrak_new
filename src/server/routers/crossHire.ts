import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";
import { Decimal } from "@prisma/client/runtime/library";

// ── Zod schemas ──────────────────────────────────────────────────────────────

const hireCustomerFields = z.object({
  productionName: z.string().min(1),
  vatNumber:      z.string().optional(),
  contactName:    z.string().optional(),
  contactEmail:   z.string().optional().transform(v => v === "" ? undefined : v).pipe(z.string().email().optional()),
  contactPhone:   z.string().optional(),
  addressLine1:   z.string().optional(),
  addressLine2:   z.string().optional(),
  city:           z.string().optional(),
  county:         z.string().optional(),
  postcode:       z.string().optional(),
  country:        z.string().optional(),
});

const equipmentItemInput = z.object({
  equipmentId:        z.string(),
  dailyRate:          z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid rate"),
  weeklyDiscount:     z.number().min(0).max(100).optional(),
  notes:              z.string().optional(),
  saveAsDefaultRate:  z.boolean().optional(),
});

// ── Router ───────────────────────────────────────────────────────────────────

export const crossHireRouter = router({
  // ── HireCustomer procedures ─────────────────────────────────────────────

  "hireCustomer.search": workspaceProcedure
    .input(z.object({ workspaceId: z.string(), query: z.string() }))
    .query(async ({ ctx, input }) => {
      const wid = ctx.workspaceId!;
      return ctx.prisma.hireCustomer.findMany({
        where: {
          workspaceId: wid,
          productionName: { contains: input.query, mode: "insensitive" },
        },
        orderBy: { productionName: "asc" },
        take: 10,
      });
    }),

  "hireCustomer.list": workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const wid = ctx.workspaceId!;
      return ctx.prisma.hireCustomer.findMany({
        where:   { workspaceId: wid },
        orderBy: { productionName: "asc" },
      });
    }),

  "hireCustomer.upsert": workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      id:          z.string().optional(),
      ...hireCustomerFields.shape,
    }))
    .mutation(async ({ ctx, input }) => {
      const wid = ctx.workspaceId!;
      const { id, workspaceId: _wid, ...fields } = input;

      const data = {
        ...fields,
        contactEmail: fields.contactEmail ?? null,
        workspaceId:  wid,
      };

      if (id) {
        // Verify ownership
        const existing = await ctx.prisma.hireCustomer.findUnique({ where: { id } });
        if (!existing || existing.workspaceId !== wid) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return ctx.prisma.hireCustomer.update({ where: { id }, data });
      }

      return ctx.prisma.hireCustomer.create({ data });
    }),

  // ── CrossHireEvent procedures ───────────────────────────────────────────

  "crossHire.create": workspaceProcedure
    .input(z.object({
      workspaceId:    z.string(),
      hireCustomerId: z.string(),
      equipmentItems: z.array(equipmentItemInput).min(1),
      termsOfHire:    z.string().min(1),
      termValue:      z.number().int().positive().optional(),
      termUnit:       z.enum(["days", "weeks", "months"]).optional(),
      totalDays:      z.number().int().positive(),
      startDate:      z.string(), // ISO date string
      endDate:        z.string().optional(),
      notes:          z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const wid    = ctx.workspaceId!;
      const userId = ctx.session.user.id;

      // Validate all equipment belongs to this workspace and is available
      const equipmentIds = input.equipmentItems.map((i) => i.equipmentId);
      const equipment = await ctx.prisma.equipment.findMany({
        where: { id: { in: equipmentIds }, workspaceId: wid },
        select: { id: true, status: true, name: true, serial: true, productId: true },
      });

      if (equipment.length !== equipmentIds.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "One or more equipment items not found" });
      }

      const unavailable = equipment.filter((e) => e.status !== "available");
      if (unavailable.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Equipment not available: ${unavailable.map((e) => e.serial).join(", ")}`,
        });
      }

      // Verify customer belongs to workspace
      const customer = await ctx.prisma.hireCustomer.findUnique({
        where: { id: input.hireCustomerId },
      });
      if (!customer || customer.workspaceId !== wid) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Hire customer not found" });
      }

      // Group items by productId for rate-default updates (only items with saveAsDefaultRate=true)
      const equipmentById = new Map(equipment.map((e) => [e.id, e]));

      // Always derive a concrete endDate. If the user picked one explicitly,
      // use it. Otherwise compute startDate + totalDays so downstream consumers
      // (PDF, detail page, drawer "due back" stat) always have a value.
      const startDateObj = new Date(input.startDate);
      const endDateObj = input.endDate
        ? new Date(input.endDate)
        : new Date(startDateObj.getTime() + input.totalDays * 86400000);

      // Create the event + items in a transaction
      const event = await ctx.prisma.$transaction(async (tx) => {
        // Atomically allocate the next invoice number for this workspace.
        // Sequence resets each calendar year. Format: {prefix}-{YYYY}-{0001}.
        const ws = await tx.workspace.findUnique({
          where:  { id: wid },
          select: { invoicePrefix: true, lastInvoiceSeqYear: true, lastInvoiceSeq: true },
        });
        if (!ws) throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
        const year       = startDateObj.getFullYear();
        const nextSeq    = (ws.lastInvoiceSeqYear === year ? ws.lastInvoiceSeq : 0) + 1;
        const invoiceNo  = `${ws.invoicePrefix}-${year}-${String(nextSeq).padStart(4, "0")}`;
        await tx.workspace.update({
          where: { id: wid },
          data:  { lastInvoiceSeqYear: year, lastInvoiceSeq: nextSeq },
        });

        const created = await tx.crossHireEvent.create({
          data: {
            workspaceId:    wid,
            hireCustomerId: input.hireCustomerId,
            termsOfHire:    input.termsOfHire,
            termValue:      input.termValue ?? null,
            termUnit:       input.termUnit  ?? null,
            totalDays:      input.totalDays,
            startDate:      startDateObj,
            endDate:        endDateObj,
            notes:          input.notes ?? null,
            invoiceNumber:  invoiceNo,
            createdById:    userId,
            equipmentItems: {
              create: input.equipmentItems.map((item) => ({
                equipmentId: item.equipmentId,
                dailyRate:   new Decimal(item.dailyRate),
                weeklyRate:  item.weeklyDiscount !== undefined ? new Decimal(item.weeklyDiscount) : null,
                notes:       item.notes ?? null,
              })),
            },
          },
          include: { equipmentItems: true, hireCustomer: true },
        });

        // Update all equipment to cross_hired
        await tx.equipment.updateMany({
          where: { id: { in: equipmentIds }, workspaceId: wid },
          data:  { status: "cross_hired" },
        });

        // Persist rates as defaults + history for items where the user opted in.
        // Multiple items may share the same productId; one history row per product
        // (the rates are identical because the form groups by product name).
        const productsHandled = new Set<string>();
        for (const item of input.equipmentItems) {
          if (!item.saveAsDefaultRate) continue;
          const eq = equipmentById.get(item.equipmentId);
          if (!eq?.productId || productsHandled.has(eq.productId)) continue;
          productsHandled.add(eq.productId);

          const dailyRate       = new Decimal(item.dailyRate);
          const weeklyDiscount  = item.weeklyDiscount !== undefined ? new Decimal(item.weeklyDiscount) : null;

          await tx.equipmentProduct.update({
            where: { id: eq.productId },
            data: {
              defaultDailyHireRate:  dailyRate,
              defaultWeeklyHireRate: weeklyDiscount,
            },
          });
          await tx.equipmentProductRateHistory.create({
            data: {
              productId:     eq.productId,
              dailyRate,
              weeklyRate:    weeklyDiscount,
              source:        "cross_hire",
              sourceEventId: created.id,
              recordedById:  userId,
            },
          });
        }

        // Fire activity events
        await tx.activityEvent.create({
          data: {
            workspaceId: wid,
            actorId:     userId,
            eventType:   "cross_hire_created",
            description: `Created cross hire for ${customer.productionName} (${equipment.length} item${equipment.length === 1 ? "" : "s"})`,
            entityType:  "cross_hire_event",
            entityId:    created.id,
          },
        });

        return created;
      });

      return event;
    }),

  "crossHire.list": workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      status:      z.enum(["active", "returned", "cancelled"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const wid = ctx.workspaceId!;
      const events = await ctx.prisma.crossHireEvent.findMany({
        where: {
          workspaceId: wid,
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          hireCustomer:  true,
          _count:        { select: { equipmentItems: true } },
          equipmentItems: { select: { dailyRate: true, returnedAt: true } },
        },
      });

      return events.map((e) => ({
        ...e,
        totalDailyRate: e.equipmentItems.reduce(
          (sum, item) => sum + Number(item.dailyRate),
          0
        ),
      }));
    }),

  "crossHire.getById": workspaceProcedure
    .input(z.object({ workspaceId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const wid = ctx.workspaceId!;
      const event = await ctx.prisma.crossHireEvent.findUnique({
        where: { id: input.id },
        include: {
          hireCustomer:  true,
          equipmentItems: {
            include: {
              equipment: {
                select: {
                  id:       true,
                  serial:   true,
                  name:     true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      if (!event || event.workspaceId !== wid) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return event;
    }),

  "crossHire.returnItems": workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      eventId:     z.string(),
      itemIds:     z.array(z.string()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const wid = ctx.workspaceId!;
      const now = new Date();

      const event = await ctx.prisma.crossHireEvent.findUnique({
        where:   { id: input.eventId },
        include: { equipmentItems: true },
      });

      if (!event || event.workspaceId !== wid) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (event.status !== "active") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Event is not active" });
      }

      // Verify all itemIds belong to this event
      const eventItemIds = new Set(event.equipmentItems.map((i) => i.id));
      const invalid = input.itemIds.filter((id) => !eventItemIds.has(id));
      if (invalid.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid item IDs" });
      }

      const returnedEquipmentIds = event.equipmentItems
        .filter((i) => input.itemIds.includes(i.id))
        .map((i) => i.equipmentId);

      await ctx.prisma.$transaction(async (tx) => {
        // Mark specified items returned
        await tx.crossHireItem.updateMany({
          where: { id: { in: input.itemIds }, crossHireEventId: input.eventId },
          data:  { returnedAt: now },
        });

        // Return equipment to available
        await tx.equipment.updateMany({
          where: { id: { in: returnedEquipmentIds }, workspaceId: wid },
          data:  { status: "available" },
        });

        // Check if ALL items are now returned
        const remainingUnreturned = event.equipmentItems.filter(
          (i) => !input.itemIds.includes(i.id) && !i.returnedAt
        );

        if (remainingUnreturned.length === 0) {
          await tx.crossHireEvent.update({
            where: { id: input.eventId },
            data:  { status: "returned", returnedAt: now },
          });
        }
      });

      return { success: true };
    }),

  "crossHire.returnAll": workspaceProcedure
    .input(z.object({ workspaceId: z.string(), eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const wid = ctx.workspaceId!;
      const now = new Date();

      const event = await ctx.prisma.crossHireEvent.findUnique({
        where:   { id: input.eventId },
        include: { equipmentItems: { where: { returnedAt: null } } },
      });

      if (!event || event.workspaceId !== wid) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (event.status !== "active") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Event is not active" });
      }

      const equipmentIds = event.equipmentItems.map((i) => i.equipmentId);

      await ctx.prisma.$transaction(async (tx) => {
        await tx.crossHireItem.updateMany({
          where: { crossHireEventId: input.eventId, returnedAt: null },
          data:  { returnedAt: now },
        });

        if (equipmentIds.length > 0) {
          await tx.equipment.updateMany({
            where: { id: { in: equipmentIds }, workspaceId: wid },
            data:  { status: "available" },
          });
        }

        await tx.crossHireEvent.update({
          where: { id: input.eventId },
          data:  { status: "returned", returnedAt: now },
        });

        await tx.activityEvent.create({
          data: {
            workspaceId: wid,
            actorId:     ctx.session.user.id,
            eventType:   "cross_hire_returned",
            description: `Returned all items for cross hire event`,
            entityType:  "cross_hire_event",
            entityId:    input.eventId,
          },
        });
      });

      return { success: true };
    }),

  // Cancelling permanently deletes the cross-hire event (CrossHireItem rows
  // cascade-delete via the schema), and any items still on hire are flipped
  // back to "available" so stock is consistent.
  "crossHire.cancel": workspaceProcedure
    .input(z.object({ workspaceId: z.string(), eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const wid = ctx.workspaceId!;

      const event = await ctx.prisma.crossHireEvent.findUnique({
        where:   { id: input.eventId },
        include: { equipmentItems: { where: { returnedAt: null } } },
      });

      if (!event || event.workspaceId !== wid) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (event.status !== "active") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Event is not active" });
      }

      const equipmentIds = event.equipmentItems.map((i) => i.equipmentId);

      await ctx.prisma.$transaction(async (tx) => {
        if (equipmentIds.length > 0) {
          await tx.equipment.updateMany({
            where: { id: { in: equipmentIds }, workspaceId: wid },
            data:  { status: "available" },
          });
        }
        await tx.crossHireEvent.delete({ where: { id: input.eventId } });
      });

      return { success: true, deleted: true };
    }),

  "crossHire.update": workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      eventId:     z.string(),
      termsOfHire: z.string().min(1).optional(),
      startDate:   z.string().optional(),
      endDate:     z.string().nullable().optional(),
      notes:       z.string().nullable().optional(),
      items:       z.array(z.object({
        id:              z.string(),
        dailyRate:       z.string().regex(/^\d+(\.\d{1,2})?$/),
        weeklyDiscount:  z.number().min(0).max(100).optional().nullable(),
        notes:           z.string().optional().nullable(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const wid = ctx.workspaceId!;

      const event = await ctx.prisma.crossHireEvent.findUnique({
        where: { id: input.eventId },
      });

      if (!event || event.workspaceId !== wid) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (event.status !== "active") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Can only edit active events" });
      }

      await ctx.prisma.$transaction(async (tx) => {
        await tx.crossHireEvent.update({
          where: { id: input.eventId },
          data: {
            ...(input.termsOfHire !== undefined ? { termsOfHire: input.termsOfHire } : {}),
            ...(input.startDate   !== undefined ? { startDate: new Date(input.startDate) } : {}),
            ...(input.endDate     !== undefined ? { endDate: input.endDate ? new Date(input.endDate) : null } : {}),
            ...(input.notes       !== undefined ? { notes: input.notes } : {}),
          },
        });

        if (input.items) {
          for (const item of input.items) {
            await tx.crossHireItem.update({
              where: { id: item.id },
              data: {
                dailyRate:   new Decimal(item.dailyRate),
                weeklyRate:  item.weeklyDiscount !== undefined && item.weeklyDiscount !== null ? new Decimal(item.weeklyDiscount) : null,
                notes:       item.notes ?? null,
              },
            });
          }
        }
      });

      return { success: true };
    }),
});
