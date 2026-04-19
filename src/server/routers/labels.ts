import { z } from "zod";
import { router, workspaceProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

const DESIGN_SCHEMA = z.enum([
  "standard",
  "compact",
  "barcode_focus",
  "full_detail",
  "high_visibility",
]);

const PRINTER_SCHEMA = z.enum([
  "brother_ql",
  "brother_pt",
  "dymo_labelwriter",
  "zebra_zd",
  "zebra_zt",
  "zebra_zq",
  "rollo",
  "niimbot",
  "generic_pdf",
]);

export const labelsRouter = router({
  /**
   * Get workspace label state: last serial, saved printer preferences, company name.
   * This is the initial payload the Generate Labels page needs.
   */
  state: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const ws = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.workspaceId! },
        select: {
          id: true,
          name: true,
          lastSerialNumber: true,
          lastPrinterType: true,
          lastLabelSize: true,
          lastLabelDesign: true,
          printerIp: true,
        },
      });

      if (!ws) throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });

      return {
        workspaceName: ws.name,
        lastSerialNumber: ws.lastSerialNumber,
        nextSerial: ws.lastSerialNumber + 1,
        lastPrinterType: ws.lastPrinterType,
        lastLabelSize: ws.lastLabelSize,
        lastLabelDesign: ws.lastLabelDesign,
        printerIp: ws.printerIp,
      };
    }),

  /**
   * Reserve a block of serials (transaction-safe) and record the batch.
   * After this returns, the serials are burned — non-reversible.
   */
  reserveBatch: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        quantity: z.number().min(1).max(200),
        design: DESIGN_SCHEMA,
        codeType: z.enum(["qr", "barcode"]),
        labelType: z.enum(["blank", "assigned"]).default("blank"),
        printerType: PRINTER_SCHEMA,
        labelSize: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const wid = ctx.workspaceId!;

      const batch = await ctx.prisma.$transaction(async (tx) => {
        // Atomic increment of lastSerialNumber
        const ws = await tx.workspace.update({
          where: { id: wid },
          data: {
            lastSerialNumber: { increment: input.quantity },
            lastPrinterType: input.printerType,
            lastLabelSize: input.labelSize,
            lastLabelDesign: input.design,
          },
          select: { lastSerialNumber: true, name: true },
        });

        const serialEnd = ws.lastSerialNumber;
        const serialStart = serialEnd - input.quantity + 1;

        const created = await tx.labelBatch.create({
          data: {
            workspaceId: wid,
            serialStart,
            serialEnd,
            quantity: input.quantity,
            design: input.design,
            codeType: input.codeType,
            labelType: input.labelType,
            printerType: input.printerType,
            labelSize: input.labelSize,
            createdById: ctx.session?.user?.id ?? null,
          },
        });

        return { ...created, workspaceName: ws.name };
      });

      return batch;
    }),

  /**
   * List past batches for the Label History table.
   */
  listBatches: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      return ctx.prisma.labelBatch.findMany({
        where: { workspaceId: ctx.workspaceId! },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }),

  /**
   * Save printer IP for direct Zebra TCP printing.
   */
  savePrinterIp: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), printerIp: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.workspace.update({
        where: { id: ctx.workspaceId! },
        data: { printerIp: input.printerIp },
      });
      return { success: true };
    }),
});
