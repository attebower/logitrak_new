import { z } from "zod";
import { router, workspaceProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

const DESIGN_SCHEMA = z.enum(["minimal", "standard", "full"]);
const METHOD_SCHEMA = z.enum(["stickermule", "brother_ql", "custom_csv"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Highest serial across active (non-cancelled) label batches and registered equipment. */
async function getHighWaterMark(
  tx: Parameters<Parameters<typeof import("@prisma/client").PrismaClient.prototype.$transaction>[0]>[0],
  workspaceId: string,
): Promise<number> {
  const [lastActive, lastEquipment] = await Promise.all([
    tx.labelBatch.findFirst({
      where:   { workspaceId, status: { not: "cancelled" } },
      orderBy: { serialEnd: "desc" },
      select:  { serialEnd: true },
    }),
    tx.equipment.findFirst({
      where:   { workspaceId },
      orderBy: { serial: "desc" },
      select:  { serial: true },
    }),
  ]);
  const equipSerial = lastEquipment ? parseInt(lastEquipment.serial, 10) : 0;
  return Math.max(lastActive?.serialEnd ?? 0, isNaN(equipSerial) ? 0 : equipSerial);
}

export const labelsRouter = router({
  /**
   * Workspace label state — next serial, org name, saved preferences.
   */
  state: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const wid = ctx.workspaceId!;

      const [ws, lastActive, lastEquipment] = await Promise.all([
        ctx.prisma.workspace.findUnique({
          where:  { id: wid },
          select: { id: true, name: true, slug: true, lastLabelDesign: true, lastLabelSize: true },
        }),
        ctx.prisma.labelBatch.findFirst({
          where:   { workspaceId: wid, status: { not: "cancelled" } },
          orderBy: { serialEnd: "desc" },
          select:  { serialEnd: true },
        }),
        ctx.prisma.equipment.findFirst({
          where:   { workspaceId: wid },
          orderBy: { serial: "desc" },
          select:  { serial: true },
        }),
      ]);

      if (!ws) throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });

      const equipSerial = lastEquipment ? parseInt(lastEquipment.serial, 10) : 0;
      const lastSerial  = Math.max(lastActive?.serialEnd ?? 0, isNaN(equipSerial) ? 0 : equipSerial);

      return {
        orgName:         ws.name,
        workspaceSlug:   ws.slug,
        nextSerial:      lastSerial + 1,
        lastLabelDesign: ws.lastLabelDesign,
        lastLabelSize:   ws.lastLabelSize,
      };
    }),

  /**
   * Active label batches for the right panel — pending/partial/complete, never cancelled.
   * Each batch includes how many of its serials have been registered as equipment.
   */
  activeBatches: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const wid = ctx.workspaceId!;

      const batches = await ctx.prisma.labelBatch.findMany({
        where:   { workspaceId: wid, status: { not: "cancelled" } },
        orderBy: { createdAt: "desc" },
        take:    20,
        select:  { id: true, serialStart: true, serialEnd: true, quantity: true, status: true, printerType: true, createdAt: true },
      });

      // Count how many serials in each batch have equipment registered
      const enriched = await Promise.all(
        batches.map(async (batch) => {
          const entered = await ctx.prisma.equipment.count({
            where: {
              workspaceId: wid,
              serial: {
                gte: batch.serialStart.toString().padStart(5, "0"),
                lte: batch.serialEnd.toString().padStart(5, "0"),
              },
            },
          });
          const derivedStatus = entered === 0
            ? "pending"
            : entered >= batch.quantity
              ? "complete"
              : "partial";
          return { ...batch, entered, derivedStatus };
        }),
      );

      return enriched;
    }),

  /**
   * Reserve a block of serials. Status starts as "pending".
   * Optionally accepts a custom serialStart to support pre-made labels.
   */
  reserveBatch: workspaceProcedure
    .input(z.object({
      workspaceId:        z.string(),
      quantity:           z.number().min(1).max(500),
      design:             DESIGN_SCHEMA,
      labelSize:          z.string(),
      method:             METHOD_SCHEMA,
      customSerialStart:  z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const wid = ctx.workspaceId!;

      return ctx.prisma.$transaction(async (tx) => {
        let serialStart: number;

        if (input.customSerialStart) {
          // Validate the custom range doesn't overlap existing active batches or equipment
          const conflict = await tx.labelBatch.findFirst({
            where: {
              workspaceId: wid,
              status:      { not: "cancelled" },
              serialStart: { lte: input.customSerialStart + input.quantity - 1 },
              serialEnd:   { gte: input.customSerialStart },
            },
          });
          const equipConflict = await tx.equipment.findFirst({
            where: {
              workspaceId: wid,
              serial: {
                gte: input.customSerialStart.toString().padStart(5, "0"),
                lte: (input.customSerialStart + input.quantity - 1).toString().padStart(5, "0"),
              },
            },
          });
          if (conflict || equipConflict) {
            throw new TRPCError({ code: "CONFLICT", message: "That serial range overlaps existing labels or equipment." });
          }
          serialStart = input.customSerialStart;
        } else {
          const hwm = await getHighWaterMark(tx, wid);
          serialStart = hwm + 1;
        }

        const serialEnd = serialStart + input.quantity - 1;

        await tx.workspace.update({
          where: { id: wid },
          data:  { lastLabelDesign: input.design, lastLabelSize: input.labelSize },
        });

        const ws = await tx.workspace.findUnique({ where: { id: wid }, select: { name: true } });
        if (!ws) throw new TRPCError({ code: "NOT_FOUND" });

        const batch = await tx.labelBatch.create({
          data: {
            workspaceId: wid,
            serialStart,
            serialEnd,
            quantity:    input.quantity,
            design:      input.design,
            codeType:    "qr",
            labelType:   "blank",
            printerType: input.method,
            labelSize:   input.labelSize,
            status:      "pending",
            createdById: ctx.session?.user?.id ?? null,
          },
        });

        return { ...batch, orgName: ws.name, serialStart, serialEnd };
      });
    }),

  /**
   * Cancel a pending batch — only allowed if no equipment in that range exists.
   */
  cancelBatch: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), batchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const wid = ctx.workspaceId!;

      const batch = await ctx.prisma.labelBatch.findUnique({
        where:  { id: input.batchId },
        select: { id: true, workspaceId: true, serialStart: true, serialEnd: true, quantity: true, status: true },
      });

      if (!batch || batch.workspaceId !== wid) throw new TRPCError({ code: "NOT_FOUND" });
      if (batch.status === "cancelled")         throw new TRPCError({ code: "BAD_REQUEST", message: "Already cancelled." });

      const entered = await ctx.prisma.equipment.count({
        where: {
          workspaceId: wid,
          serial: {
            gte: batch.serialStart.toString().padStart(5, "0"),
            lte: batch.serialEnd.toString().padStart(5, "0"),
          },
        },
      });

      await ctx.prisma.labelBatch.update({
        where: { id: input.batchId },
        data:  { status: "cancelled" },
      });

      return { success: true, entered, freed: batch.quantity - entered };
    }),

  /**
   * Cancel all pending batches that have zero equipment registered.
   * Used to clear out test/stale data in one go.
   */
  clearEmptyBatches: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .mutation(async ({ ctx }) => {
      const wid = ctx.workspaceId!;

      const pending = await ctx.prisma.labelBatch.findMany({
        where:  { workspaceId: wid, status: { not: "cancelled" } },
        select: { id: true, serialStart: true, serialEnd: true },
      });

      const toCancel: string[] = [];
      for (const batch of pending) {
        const entered = await ctx.prisma.equipment.count({
          where: {
            workspaceId: wid,
            serial: {
              gte: batch.serialStart.toString().padStart(5, "0"),
              lte: batch.serialEnd.toString().padStart(5, "0"),
            },
          },
        });
        if (entered === 0) toCancel.push(batch.id);
      }

      if (toCancel.length > 0) {
        await ctx.prisma.labelBatch.updateMany({
          where: { id: { in: toCancel } },
          data:  { status: "cancelled" },
        });
      }

      return { cancelled: toCancel.length };
    }),

  /**
   * StickerMule order stub — opens checkout URL.
   */
  orderStickerMule: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      batchId:     z.string(),
      sizeId:      z.string(),
      quantity:    z.number().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const batch = await ctx.prisma.labelBatch.findUnique({
        where: { id: input.batchId },
      });

      if (!batch || batch.workspaceId !== ctx.workspaceId) throw new TRPCError({ code: "NOT_FOUND" });

      const checkoutUrl = `https://www.stickermule.com/products/custom-stickers?ref=logitrak&batch=${input.batchId}`;

      await ctx.prisma.labelBatch.update({
        where: { id: input.batchId },
        data:  { stickerMuleOrderUrl: checkoutUrl },
      });

      return { checkoutUrl };
    }),
});
