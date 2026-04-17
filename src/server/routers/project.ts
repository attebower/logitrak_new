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
