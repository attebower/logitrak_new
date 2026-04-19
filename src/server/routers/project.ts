import { z } from "zod";
import { router, workspaceProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { WorkspaceRole } from "@prisma/client";

const MANAGER_ROLES: WorkspaceRole[] = ["owner", "admin", "manager"];

export const projectRouter = router({
  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      return ctx.prisma.project.findMany({
        where: { workspaceId: ctx.workspaceId! },
        orderBy: { createdAt: "desc" },
        include: { studio: { select: { id: true, name: true } } },
      });
    }),

  create: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      name: z.string().min(1).max(120),
      industryType: z.enum(["film_tv", "events"]).default("film_tv"),
      startDate: z.string().optional(),
      description: z.string().max(500).optional(),
      studioId: z.string().optional(),       // existing studio
      newStudioName: z.string().optional(),  // "Other" — create and link
      eventLocation: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!MANAGER_ROLES.includes(ctx.userRole!)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Manager or above required" });
      }

      let studioId = input.studioId;

      // Create a new studio if the user typed a custom name
      if (!studioId && input.newStudioName?.trim()) {
        const existing = await ctx.prisma.studio.findFirst({
          where: { workspaceId: ctx.workspaceId!, name: input.newStudioName.trim() },
        });
        if (existing) {
          studioId = existing.id;
        } else {
          const created = await ctx.prisma.studio.create({
            data: { workspaceId: ctx.workspaceId!, name: input.newStudioName.trim() },
          });
          studioId = created.id;
        }
      }

      return ctx.prisma.project.create({
        data: {
          workspaceId: ctx.workspaceId!,
          name: input.name,
          industryType: input.industryType,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          description: input.description,
          studioId: input.industryType === "film_tv" ? (studioId ?? undefined) : undefined,
          eventLocation: input.industryType === "events" ? (input.eventLocation ?? undefined) : undefined,
        },
        include: { studio: { select: { id: true, name: true } } },
      });
    }),

  // ── Project Sets ────────────────────────────────────────────────────────

  // ── On-location venues (project-scoped) ─────────────────────────────

  onLocations: router({
    list: workspaceProcedure
      .input(z.object({ workspaceId: z.string(), projectId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.prisma.onLocation.findMany({
          where: { projectId: input.projectId, workspaceId: ctx.workspaceId! },
          orderBy: { name: "asc" },
        });
      }),

    create: workspaceProcedure
      .input(z.object({
        workspaceId: z.string(),
        projectId:   z.string(),
        name:        z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        address:     z.string().max(200).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!MANAGER_ROLES.includes(ctx.userRole!)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Manager or above required" });
        }

        // Verify project belongs to this workspace
        const project = await ctx.prisma.project.findFirst({
          where: { id: input.projectId, workspaceId: ctx.workspaceId! },
          select: { id: true },
        });
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

        const name = input.name.trim();
        const existing = await ctx.prisma.onLocation.findUnique({
          where: { projectId_name: { projectId: input.projectId, name } },
        });
        if (existing) {
          // Reuse rather than error — keeps 'create or reuse' simple for the UI
          return existing;
        }
        return ctx.prisma.onLocation.create({
          data: {
            workspaceId: ctx.workspaceId!,
            projectId:   input.projectId,
            name,
            description: input.description?.trim() || undefined,
            address:     input.address?.trim()     || undefined,
          },
        });
      }),
  }),

  sets: router({
    list: workspaceProcedure
      .input(z.object({ workspaceId: z.string(), projectId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.prisma.projectSet.findMany({
          where: { projectId: input.projectId, workspaceId: ctx.workspaceId! },
          orderBy: { createdAt: "asc" },
          include: {
            set:        { select: { id: true, name: true, description: true } },
            stage:      { select: { id: true, name: true, studio: { select: { id: true, name: true } } } },
            onLocation: { select: { id: true, name: true, description: true, address: true } },
          },
        });
      }),

    add: workspaceProcedure
      .input(z.object({
        workspaceId:  z.string(),
        projectId:    z.string(),
        stageId:      z.string().optional(),
        onLocationId: z.string().optional(),
        setName:      z.string().min(1).max(100),
        notes:        z.string().optional(),
      }).refine(
        (v) => !!v.stageId !== !!v.onLocationId,
        { message: "Must provide exactly one of stageId or onLocationId." },
      ))
      .mutation(async ({ ctx, input }) => {
        if (!MANAGER_ROLES.includes(ctx.userRole!)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Manager or above required" });
        }

        let set;
        if (input.stageId) {
          // Stage-based path (unchanged semantics)
          const stage = await ctx.prisma.stage.findFirst({
            where: { id: input.stageId, studio: { workspaceId: ctx.workspaceId! } },
          });
          if (!stage) throw new TRPCError({ code: "NOT_FOUND", message: "Stage not found" });

          set = await ctx.prisma.set.findUnique({
            where: { stageId_name: { stageId: input.stageId, name: input.setName.trim() } },
          });
          if (!set) {
            set = await ctx.prisma.set.create({
              data: {
                workspaceId: ctx.workspaceId!,
                stageId:     input.stageId,
                name:        input.setName.trim(),
              },
            });
          }
        } else if (input.onLocationId) {
          // On-location path
          const loc = await ctx.prisma.onLocation.findFirst({
            where: {
              id:          input.onLocationId,
              workspaceId: ctx.workspaceId!,
              projectId:   input.projectId,
            },
          });
          if (!loc) throw new TRPCError({ code: "NOT_FOUND", message: "On-location venue not found" });

          set = await ctx.prisma.set.findUnique({
            where: { onLocationId_name: { onLocationId: input.onLocationId, name: input.setName.trim() } },
          });
          if (!set) {
            set = await ctx.prisma.set.create({
              data: {
                workspaceId:  ctx.workspaceId!,
                onLocationId: input.onLocationId,
                name:         input.setName.trim(),
              },
            });
          }
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Missing stage or location." });
        }

        // Check not already added to this project
        const existing = await ctx.prisma.projectSet.findUnique({
          where: { projectId_setId: { projectId: input.projectId, setId: set.id } },
        });
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: `"${input.setName}" is already on this project` });
        }

        return ctx.prisma.projectSet.create({
          data: {
            workspaceId:  ctx.workspaceId!,
            projectId:    input.projectId,
            setId:        set.id,
            stageId:      input.stageId      ?? null,
            onLocationId: input.onLocationId ?? null,
            notes:        input.notes,
          },
          include: {
            set:        { select: { id: true, name: true, description: true } },
            stage:      { select: { id: true, name: true, studio: { select: { id: true, name: true } } } },
            onLocation: { select: { id: true, name: true, description: true, address: true } },
          },
        });
      }),

    remove: workspaceProcedure
      .input(z.object({ workspaceId: z.string(), projectSetId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!MANAGER_ROLES.includes(ctx.userRole!)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Manager or above required" });
        }
        return ctx.prisma.projectSet.delete({
          where: { id: input.projectSetId, workspaceId: ctx.workspaceId! },
        });
      }),

    // Update set info in the context of this ProjectSet.
    // Matt's semantics: editing "this set" on this project should feel like
    // it edits this project's view. So:
    //   - notes: updated on ProjectSet (always project-scoped)
    //   - stageId + setName: resolved to a Set on that stage (created if
    //     new) and the ProjectSet is re-pointed. The original Set stays
    //     intact so other projects using it are unaffected.
    update: workspaceProcedure
      .input(z.object({
        workspaceId:  z.string(),
        projectSetId: z.string(),
        setName:      z.string().min(1).max(100),
        stageId:      z.string().optional(),
        onLocationId: z.string().optional(),
        notes:        z.string().optional(),
      }).refine(
        (v) => !!v.stageId !== !!v.onLocationId,
        { message: "Must provide exactly one of stageId or onLocationId." },
      ))
      .mutation(async ({ ctx, input }) => {
        if (!MANAGER_ROLES.includes(ctx.userRole!)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Manager or above required" });
        }

        const ps = await ctx.prisma.projectSet.findFirst({
          where: { id: input.projectSetId, workspaceId: ctx.workspaceId! },
          include: { set: true },
        });
        if (!ps) throw new TRPCError({ code: "NOT_FOUND", message: "Project set not found" });

        // Resolve target Set under the chosen venue
        let targetSet;
        if (input.stageId) {
          const stage = await ctx.prisma.stage.findFirst({
            where: { id: input.stageId, studio: { workspaceId: ctx.workspaceId! } },
          });
          if (!stage) throw new TRPCError({ code: "NOT_FOUND", message: "Stage not found" });

          targetSet = await ctx.prisma.set.findUnique({
            where: { stageId_name: { stageId: input.stageId, name: input.setName.trim() } },
          });
          if (!targetSet) {
            targetSet = await ctx.prisma.set.create({
              data: {
                workspaceId: ctx.workspaceId!,
                stageId:     input.stageId,
                name:        input.setName.trim(),
              },
            });
          }
        } else if (input.onLocationId) {
          const loc = await ctx.prisma.onLocation.findFirst({
            where: {
              id:          input.onLocationId,
              workspaceId: ctx.workspaceId!,
              projectId:   ps.projectId,
            },
          });
          if (!loc) throw new TRPCError({ code: "NOT_FOUND", message: "On-location venue not found" });

          targetSet = await ctx.prisma.set.findUnique({
            where: { onLocationId_name: { onLocationId: input.onLocationId, name: input.setName.trim() } },
          });
          if (!targetSet) {
            targetSet = await ctx.prisma.set.create({
              data: {
                workspaceId:  ctx.workspaceId!,
                onLocationId: input.onLocationId,
                name:         input.setName.trim(),
              },
            });
          }
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Missing stage or location." });
        }

        // Prevent collision with another ProjectSet in the same project
        if (targetSet.id !== ps.setId) {
          const collision = await ctx.prisma.projectSet.findFirst({
            where: {
              projectId: ps.projectId,
              setId:     targetSet.id,
              id:        { not: ps.id },
            },
          });
          if (collision) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `"${input.setName}" is already on this project.`,
            });
          }
        }

        return ctx.prisma.projectSet.update({
          where: { id: ps.id },
          data: {
            setId:        targetSet.id,
            stageId:      input.stageId      ?? null,
            onLocationId: input.onLocationId ?? null,
            notes:        input.notes?.trim() ? input.notes.trim() : null,
          },
          include: {
            set:        { select: { id: true, name: true, description: true } },
            stage:      { select: { id: true, name: true, studio: { select: { id: true, name: true } } } },
            onLocation: { select: { id: true, name: true, description: true, address: true } },
          },
        });
      }),

    // Equipment currently on a set within this project — latest check event per item
    equipment: workspaceProcedure
      .input(z.object({ workspaceId: z.string(), projectId: z.string(), setId: z.string() }))
      .query(async ({ ctx, input }) => {
        // Find all equipment whose most recent check event placed them on this set
        // for this project (matched by productionName) and hasn't been checked back in
        const project = await ctx.prisma.project.findFirst({
          where: { id: input.projectId, workspaceId: ctx.workspaceId! },
          select: { name: true },
        });
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

        return ctx.prisma.equipment.findMany({
          where: {
            workspaceId: ctx.workspaceId!,
            status: "checked_out",
            checkEvents: {
              some: {
                setId:          input.setId,
                productionName: project.name,
                eventType:      "check_out",
              },
            },
          },
          include: {
            category: { select: { name: true, groupName: true } },
            checkEvents: {
              where: { setId: input.setId, eventType: "check_out" },
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                user:  { select: { displayName: true, email: true } },
                stage: { select: { name: true } },
                set:   { select: { name: true } },
              },
            },
          },
          orderBy: { name: "asc" },
        });
      }),
  }),

  // ── Set attachments (photos + lighting layouts) ────────────────────────────

  setAttachments: router({
    // List photos for a ProjectSet
    listPhotos: workspaceProcedure
      .input(z.object({ workspaceId: z.string(), projectSetId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.prisma.setPhoto.findMany({
          where: { projectSetId: input.projectSetId, workspaceId: ctx.workspaceId! },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: {
            uploadedBy: { select: { displayName: true, email: true } },
          },
        });
      }),

    // List lighting layouts for a ProjectSet
    listLayouts: workspaceProcedure
      .input(z.object({ workspaceId: z.string(), projectSetId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.prisma.setLightingLayout.findMany({
          where: { projectSetId: input.projectSetId, workspaceId: ctx.workspaceId! },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: {
            uploadedBy: { select: { displayName: true, email: true } },
          },
        });
      }),

    // After upload, the client calls this to register the file
    registerPhoto: workspaceProcedure
      .input(z.object({
        workspaceId:  z.string(),
        projectSetId: z.string(),
        storagePath:  z.string(),
        filename:     z.string(),
        mimeType:     z.string(),
        sizeBytes:    z.number().int().positive(),
        caption:      z.string().max(200).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify the ProjectSet belongs to this workspace
        const ps = await ctx.prisma.projectSet.findFirst({
          where: { id: input.projectSetId, workspaceId: ctx.workspaceId! },
          select: { id: true },
        });
        if (!ps) throw new TRPCError({ code: "NOT_FOUND", message: "Project set not found" });

        return ctx.prisma.setPhoto.create({
          data: {
            workspaceId:  ctx.workspaceId!,
            projectSetId: input.projectSetId,
            uploadedById: ctx.session!.user.id,
            storagePath:  input.storagePath,
            filename:     input.filename,
            mimeType:     input.mimeType,
            sizeBytes:    input.sizeBytes,
            caption:      input.caption,
          },
        });
      }),

    registerLayout: workspaceProcedure
      .input(z.object({
        workspaceId:  z.string(),
        projectSetId: z.string(),
        storagePath:  z.string(),
        filename:     z.string(),
        mimeType:     z.string(),
        sizeBytes:    z.number().int().positive(),
        title:        z.string().max(100).optional(),
        description:  z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const ps = await ctx.prisma.projectSet.findFirst({
          where: { id: input.projectSetId, workspaceId: ctx.workspaceId! },
          select: { id: true },
        });
        if (!ps) throw new TRPCError({ code: "NOT_FOUND", message: "Project set not found" });

        return ctx.prisma.setLightingLayout.create({
          data: {
            workspaceId:  ctx.workspaceId!,
            projectSetId: input.projectSetId,
            uploadedById: ctx.session!.user.id,
            storagePath:  input.storagePath,
            filename:     input.filename,
            mimeType:     input.mimeType,
            sizeBytes:    input.sizeBytes,
            title:        input.title,
            description:  input.description,
          },
        });
      }),

    deletePhoto: workspaceProcedure
      .input(z.object({ workspaceId: z.string(), photoId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!MANAGER_ROLES.includes(ctx.userRole!)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Manager or above required" });
        }
        // We return the storagePath so the API route can clean up the file too
        return ctx.prisma.setPhoto.delete({
          where: { id: input.photoId, workspaceId: ctx.workspaceId! },
          select: { id: true, storagePath: true },
        });
      }),

    deleteLayout: workspaceProcedure
      .input(z.object({ workspaceId: z.string(), layoutId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!MANAGER_ROLES.includes(ctx.userRole!)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Manager or above required" });
        }
        return ctx.prisma.setLightingLayout.delete({
          where: { id: input.layoutId, workspaceId: ctx.workspaceId! },
          select: { id: true, storagePath: true },
        });
      }),

    // Generate short-lived signed URLs for client rendering.
    // Takes many storagePaths at once so the drawer only does one roundtrip per tab.
    signUrls: workspaceProcedure
      .input(z.object({
        workspaceId: z.string(),
        bucket:      z.enum(["set-photos", "set-layouts"]),
        paths:       z.array(z.string()).max(100),
      }))
      .query(async ({ ctx, input }) => {
        if (input.paths.length === 0) return {};
        // Signed URL generation needs the service-role client.
        const { createClient } = await import("@supabase/supabase-js");
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } },
        );

        // Verify every path is under this workspace (prefix match)
        const wsPrefix = `${ctx.workspaceId}/`;
        const safePaths = input.paths.filter((p) => p.startsWith(wsPrefix));
        if (safePaths.length === 0) return {};

        const { data, error } = await admin.storage
          .from(input.bucket)
          .createSignedUrls(safePaths, 60 * 15); // 15 min
        if (error) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        }
        const out: Record<string, string> = {};
        for (const row of data ?? []) {
          if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
        }
        return out;
      }),

    // Damage reports on equipment that has touched this set (for PDF + UI)
    damageOnSet: workspaceProcedure
      .input(z.object({ workspaceId: z.string(), projectId: z.string(), projectSetId: z.string() }))
      .query(async ({ ctx, input }) => {
        // First resolve the underlying setId from the ProjectSet
        const ps = await ctx.prisma.projectSet.findFirst({
          where: { id: input.projectSetId, workspaceId: ctx.workspaceId! },
          select: { setId: true },
        });
        if (!ps) return [];

        const project = await ctx.prisma.project.findFirst({
          where: { id: input.projectId, workspaceId: ctx.workspaceId! },
          select: { name: true },
        });
        if (!project) return [];

        // Any damage report whose equipment has a check event on this set in this project
        return ctx.prisma.damageReport.findMany({
          where: {
            workspaceId: ctx.workspaceId!,
            equipment: {
              checkEvents: {
                some: {
                  setId: ps.setId,
                  productionName: project.name,
                },
              },
            },
          },
          orderBy: { reportedAt: "desc" },
          include: {
            equipment: { select: { serial: true, name: true, category: { select: { name: true } } } },
            reporter:  { select: { displayName: true, email: true } },
            repairLogs: {
              orderBy: { repairedAt: "desc" },
              take: 1,
              select: { description: true, repairedByName: true, repairedAt: true },
            },
          },
        });
      }),
  }),

  updateStatus: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      projectId: z.string(),
      status: z.enum(["active", "wrapped", "archived"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!MANAGER_ROLES.includes(ctx.userRole!)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Manager or above required" });
      }
      return ctx.prisma.project.update({
        where: { id: input.projectId, workspaceId: ctx.workspaceId! },
        data: { status: input.status },
      });
    }),
});
