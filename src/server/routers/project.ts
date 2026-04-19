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

  sets: router({
    list: workspaceProcedure
      .input(z.object({ workspaceId: z.string(), projectId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.prisma.projectSet.findMany({
          where: { projectId: input.projectId, workspaceId: ctx.workspaceId! },
          orderBy: { createdAt: "asc" },
          include: {
            set:   { select: { id: true, name: true, description: true } },
            stage: { select: { id: true, name: true, studio: { select: { id: true, name: true } } } },
          },
        });
      }),

    add: workspaceProcedure
      .input(z.object({
        workspaceId: z.string(),
        projectId:   z.string(),
        stageId:     z.string(),
        setName:     z.string().min(1).max(100),
        notes:       z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!MANAGER_ROLES.includes(ctx.userRole!)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Manager or above required" });
        }

        // Verify stage belongs to this workspace
        const stage = await ctx.prisma.stage.findFirst({
          where: { id: input.stageId, studio: { workspaceId: ctx.workspaceId! } },
        });
        if (!stage) throw new TRPCError({ code: "NOT_FOUND", message: "Stage not found" });

        // Create the set if it doesn't already exist on this stage
        let set = await ctx.prisma.set.findUnique({
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

        // Check not already added to this project
        const existing = await ctx.prisma.projectSet.findUnique({
          where: { projectId_setId: { projectId: input.projectId, setId: set.id } },
        });
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: `"${input.setName}" is already on this project` });
        }

        return ctx.prisma.projectSet.create({
          data: {
            workspaceId: ctx.workspaceId!,
            projectId:   input.projectId,
            setId:       set.id,
            stageId:     input.stageId,
            notes:       input.notes,
          },
          include: {
            set:   { select: { id: true, name: true, description: true } },
            stage: { select: { id: true, name: true, studio: { select: { id: true, name: true } } } },
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
