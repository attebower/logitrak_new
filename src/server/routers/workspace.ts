import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, workspaceProcedure } from "../trpc";
import { Decimal } from "@prisma/client/runtime/library";
import { IndustryType, SubscriptionTier, WorkspaceRole, InvoiceTemplate, DocumentTemplate } from "@prisma/client";

// Plan → limits (mirrors STRIPE_PLANS in lib/stripe.ts)
const TIER_LIMITS: Record<SubscriptionTier, { maxUsers: number; maxAssets: number }> = {
  starter:      { maxUsers: 5,       maxAssets: 500 },
  professional: { maxUsers: 20,      maxAssets: 10_000 },
  enterprise:   { maxUsers: 999_999, maxAssets: 999_999 },
};

const TRIAL_DAYS = 7;

// UK Studios reference — seeded into every new workspace
const UK_STUDIOS_SEED = [
  { name: "Pinewood Studios", stages: ["007 Stage (Albert R. Broccoli Stage)", "The Roger Moore Stage", "The Richard Attenborough Stage", "Q Stage", "V Stage", "S Stage", "R Stage", "U Stage", "N Stage", "M Stage", "F Stage", "L Stage", "A Stage", "B Stage", "C Stage", "D Stage", "E Stage", "W Stage", "X Stage", "Z Stage", "Underwater Stage", "East Stage 1", "East Stage 2", "East Stage 3", "East Stage 4", "East Stage 5", "East Stage 6", "East Stage 7", "East Stage 8", "East Stage 9", "The Sean Connery Stage"] },
  { name: "Shepperton Studios", stages: ["A Stage", "B Stage", "C Stage", "D Stage", "E Stage", "F Stage", "G Stage", "H Stage", "I Stage", "J Stage", "K Stage", "L Stage", "M Stage", "N Stage", "South Stage 1", "South Stage 2", "South Stage 3", "South Stage 4", "South Stage 5", "South Stage 6", "South Stage 7", "South Stage 8", "South Stage 9", "South Stage 10", "South Stage 11", "South Stage 12", "South Stage 13", "South Stage 14", "NW Stage 15", "NW Stage 16", "NW Stage 17"] },
  { name: "Warner Bros. Studios Leavesden", stages: ["Stage A", "Stage B", "Stage C", "Stage D", "Stage E", "Stage F", "Stage G", "Stage H", "Stage L", "Stage T", "Stage U", "Stage V"] },
  { name: "Elstree Studios", stages: ["George Lucas Stage 1", "George Lucas Stage 2", "Platinum Stage 3", "Platinum Stage 4", "Stage 5", "Stage 6", "Stage 7", "Stage 8", "Stage 9", "Exterior Lot"] },
  { name: "Sky Studios Elstree", stages: ["Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5", "Stage 6", "Stage 7", "Stage 8", "Stage 9", "Stage 10", "Stage 11", "Stage 12", "Backlot"] },
  { name: "Longcross Studios", stages: ["Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5", "Stage 6", "Tank", "Test Track / Backlot"] },
  { name: "Longcross South Studios", stages: ["Stage A", "Stage B", "Stage C", "Stage D", "Stage E", "Space 1", "Space 2", "Space 3", "Space 4"] },
  { name: "Shinfield Studios (Shadowbox Studios)", stages: ["Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5", "Stage 6", "Stage 7", "Stage 8", "Stage 9", "Stage 10", "Stage 11", "Stage 12", "Stage 13", "Stage 14", "Stage 15", "Stage 16", "Stage 17", "Stage 18", "Backlot"] },
  { name: "3 Mills Studios", stages: ["Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5", "Stage 6", "Stage 7", "Stage 8", "Stage 9", "Clock Mill", "Floating Stage"] },
  { name: "Ealing Studios", stages: ["Stage 1 (Main Stage)", "Stage 2", "Stage 3", "New Stage", "Ealing Green (Backlot)"] },
  { name: "Twickenham Film Studios", stages: ["Stage 1", "Stage 2", "Stage 3", "Post Production Theatre 1", "Post Production Theatre 2", "Post Production Theatre 3"] },
  { name: "Black Island Studios", stages: ["Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5"] },
  { name: "Garden Studios", stages: ["Orchid Stage 1", "Orchid Stage 2", "Orchid Stage 3", "Iris Stage 1", "Iris Stage 2", "Iris Stage 3", "Lily Stage 3", "Rose Stage"] },
  { name: "Troubadour Meridian Water Studios", stages: ["Stage 1", "Stage 2", "Stage 3"] },
  { name: "The Bottle Yard Studios", stages: ["Tank House 1", "Tank House 2", "Tank House 3", "Tank House 4", "Export Warehouse 5", "Studio 6", "Studio 7", "Studio 8 (Green Screen)", "Studio 9", "Studio 10", "Studio 11"] },
  { name: "Titanic Studios", stages: ["Paint Hall Stage 1", "Paint Hall Stage 2", "Paint Hall Stage 3", "Paint Hall Stage 4", "William MacQuitty Stage", "Brian Hurst Stage"] },
  { name: "Belfast Harbour Studios", stages: ["Stage 1", "Stage 2", "Studio Ulster"] },
];

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
        department: workspace.department ?? null,
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
        name:             z.string().min(2),
        industryType:     z.nativeEnum(IndustryType),
        department:       z.string().optional(),
        subscriptionTier: z.nativeEnum(SubscriptionTier).default("starter"),
        // Optional business profile fields — onboarding's Business step
        // populates these. Anything missing stays null.
        businessName:     z.string().nullable().optional(),
        addressLine1:     z.string().nullable().optional(),
        addressLine2:     z.string().nullable().optional(),
        city:             z.string().nullable().optional(),
        county:           z.string().nullable().optional(),
        postcode:         z.string().nullable().optional(),
        country:          z.string().nullable().optional(),
        vatNumber:        z.string().nullable().optional(),
        businessEmail:    z.string().email().nullable().optional().or(z.literal("")),
        businessPhone:    z.string().nullable().optional(),
        bankDetails:      z.string().nullable().optional(),
        logoUrl:          z.string().url().nullable().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const limits = TIER_LIMITS[input.subscriptionTier];
      const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

      // BUG-015: wrap in try/catch and handle P2002 (unique constraint violation)
      // atomically — avoids the findUnique + create race condition
      try {
        const workspace = await ctx.prisma.workspace.create({
          data: {
            name: input.name,
            slug,
            industryType: input.industryType,
            department:   input.department?.toLowerCase(),
            subscriptionTier:   input.subscriptionTier,
            subscriptionStatus: "trialing",
            trialEndsAt,
            maxUsers:  limits.maxUsers,
            maxAssets: limits.maxAssets,
            // Business profile pass-throughs (empty strings → null)
            businessName:  input.businessName  || null,
            addressLine1:  input.addressLine1  || null,
            addressLine2:  input.addressLine2  || null,
            city:          input.city          || null,
            county:        input.county        || null,
            postcode:      input.postcode      || null,
            country:       input.country       || null,
            vatNumber:     input.vatNumber     || null,
            businessEmail: input.businessEmail || null,
            businessPhone: input.businessPhone || null,
            bankDetails:   input.bankDetails   || null,
            logoUrl:       input.logoUrl       || null,
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

        // Seed department default categories if we know the department
        if (input.department) {
          const { getDepartmentCategories } = await import("@/lib/department-catalog");
          const defaults = getDepartmentCategories(input.department);
          if (defaults.length > 0) {
            await ctx.prisma.equipmentCategory.createMany({
              data: defaults.map((d) => ({
                workspaceId: workspace.id,
                name:        d.name,
                groupName:   d.groupName,
              })),
            });
          }
        }

        // Seed UK studios reference data into the new workspace
        for (const studio of UK_STUDIOS_SEED) {
          const created = await ctx.prisma.studio.create({
            data: {
              workspaceId: workspace.id,
              name: studio.name,
              displayId: studio.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            },
          });
          for (const stageName of studio.stages) {
            await ctx.prisma.stage.create({
              data: { workspaceId: workspace.id, studioId: created.id, name: stageName },
            });
          }
        }

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
        workspaceId:      z.string(),
        name:             z.string().min(2).optional(),
        industryType:     z.nativeEnum(IndustryType).optional(),
        department:       z.string().nullable().optional(),
        subscriptionTier: z.nativeEnum(SubscriptionTier).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      // Load current workspace first so we can skip no-op updates
      const current = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.workspaceId! },
        select: { name: true, slug: true, industryType: true, department: true, subscriptionTier: true },
      });
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });

      const data: {
        name?: string; slug?: string;
        industryType?: IndustryType; department?: string | null;
        subscriptionTier?: SubscriptionTier;
        maxUsers?: number; maxAssets?: number;
      } = {};
      if (input.name !== undefined && input.name !== current.name) {
        data.name = input.name;
        const newSlug = input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        if (newSlug !== current.slug) data.slug = newSlug;
      }
      if (input.industryType !== undefined) {
        data.industryType = input.industryType;
      }
      if (input.department !== undefined) {
        data.department = input.department ? input.department.toLowerCase() : null;
      }
      if (input.subscriptionTier !== undefined && input.subscriptionTier !== current.subscriptionTier) {
        data.subscriptionTier = input.subscriptionTier;
        const limits = TIER_LIMITS[input.subscriptionTier];
        data.maxUsers  = limits.maxUsers;
        data.maxAssets = limits.maxAssets;
      }

      if (Object.keys(data).length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No fields to update" });
      }

      try {
        return await ctx.prisma.workspace.update({
          where: { id: ctx.workspaceId! },
          data,
          select: { id: true, name: true, slug: true, industryType: true, department: true, subscriptionTier: true },
        });
      } catch (err: unknown) {
        if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "Workspace name already taken" });
        }
        throw err;
      }
    }),

  // ── Business profile (used for invoice From block, equipment list header) ──
  getBusinessProfile: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const ws = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.workspaceId! },
        select: {
          id:            true,
          name:          true,
          businessName:  true,
          addressLine1:  true,
          addressLine2:  true,
          city:          true,
          county:        true,
          postcode:      true,
          country:       true,
          vatNumber:     true,
          businessEmail: true,
          businessPhone: true,
          bankDetails:   true,
          logoUrl:       true,
        },
      });
      if (!ws) throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
      return ws;
    }),

  updateBusinessProfile: workspaceProcedure
    .input(z.object({
      workspaceId:   z.string(),
      businessName:  z.string().nullable().optional(),
      addressLine1:  z.string().nullable().optional(),
      addressLine2:  z.string().nullable().optional(),
      city:          z.string().nullable().optional(),
      county:        z.string().nullable().optional(),
      postcode:      z.string().nullable().optional(),
      country:       z.string().nullable().optional(),
      vatNumber:     z.string().nullable().optional(),
      businessEmail: z.string().email().nullable().optional().or(z.literal("")),
      businessPhone: z.string().nullable().optional(),
      bankDetails:   z.string().nullable().optional(),
      logoUrl:       z.string().url().nullable().optional().or(z.literal("")),
    }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const data: Record<string, string | null> = {};
      const fields = ["businessName","addressLine1","addressLine2","city","county","postcode","country","vatNumber","businessEmail","businessPhone","bankDetails","logoUrl"] as const;
      for (const f of fields) {
        const v = input[f];
        if (v !== undefined) data[f] = v === "" ? null : (v as string | null);
      }
      if (Object.keys(data).length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No fields to update" });
      }
      return await ctx.prisma.workspace.update({
        where:  { id: ctx.workspaceId! },
        data,
        select: { id: true },
      });
    }),

  // ── Invoicing settings ──
  getInvoiceSettings: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const ws = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.workspaceId! },
        select: {
          invoicePrefix:      true,
          invoiceTemplate:    true,
          vatRate:            true,
          paymentTermsDays:   true,
          paymentTermsText:   true,
          invoiceFooter:      true,
          lastInvoiceSeqYear: true,
          lastInvoiceSeq:     true,
        },
      });
      if (!ws) throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });

      // Derive next-number preview
      const year      = new Date().getFullYear();
      const nextSeq   = (ws.lastInvoiceSeqYear === year ? ws.lastInvoiceSeq : 0) + 1;
      const preview   = `${ws.invoicePrefix}-${year}-${String(nextSeq).padStart(4, "0")}`;

      return {
        invoicePrefix:    ws.invoicePrefix,
        invoiceTemplate:  ws.invoiceTemplate,
        vatRate:          ws.vatRate.toString(),
        paymentTermsDays: ws.paymentTermsDays,
        paymentTermsText: ws.paymentTermsText,
        invoiceFooter:    ws.invoiceFooter,
        invoicePreview:   preview,
      };
    }),

  updateInvoiceSettings: workspaceProcedure
    .input(z.object({
      workspaceId:      z.string(),
      invoicePrefix:    z.string().min(1).max(16).regex(/^[A-Z0-9_-]+$/i, "Use letters, numbers, dash or underscore only").optional(),
      invoiceTemplate:  z.nativeEnum(InvoiceTemplate).optional(),
      vatRate:          z.number().min(0).max(1).optional(),
      paymentTermsDays: z.number().int().min(0).max(365).optional(),
      paymentTermsText: z.string().nullable().optional(),
      invoiceFooter:    z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const data: Record<string, unknown> = {};
      if (input.invoicePrefix    !== undefined) data.invoicePrefix    = input.invoicePrefix.toUpperCase();
      if (input.invoiceTemplate  !== undefined) data.invoiceTemplate  = input.invoiceTemplate;
      if (input.vatRate          !== undefined) data.vatRate          = new Decimal(input.vatRate);
      if (input.paymentTermsDays !== undefined) data.paymentTermsDays = input.paymentTermsDays;
      if (input.paymentTermsText !== undefined) data.paymentTermsText = input.paymentTermsText === "" ? null : input.paymentTermsText;
      if (input.invoiceFooter    !== undefined) data.invoiceFooter    = input.invoiceFooter    === "" ? null : input.invoiceFooter;

      if (Object.keys(data).length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No fields to update" });
      }
      return await ctx.prisma.workspace.update({
        where:  { id: ctx.workspaceId! },
        data,
        select: { id: true },
      });
    }),

  // ── Document template (drives Equipment List / Reports / Set Snapshot PDFs) ──
  getDocumentTemplate: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const ws = await ctx.prisma.workspace.findUnique({
        where:  { id: ctx.workspaceId! },
        select: { documentTemplate: true },
      });
      if (!ws) throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
      return { documentTemplate: ws.documentTemplate };
    }),

  updateDocumentTemplate: workspaceProcedure
    .input(z.object({
      workspaceId:      z.string(),
      documentTemplate: z.nativeEnum(DocumentTemplate),
    }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);
      return await ctx.prisma.workspace.update({
        where:  { id: ctx.workspaceId! },
        data:   { documentTemplate: input.documentTemplate },
        select: { id: true },
      });
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
