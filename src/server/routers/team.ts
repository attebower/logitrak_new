import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, workspaceProcedure } from "../trpc";
import { WorkspaceRole } from "@prisma/client";

const ADMIN_ROLES: WorkspaceRole[] = ["owner", "admin"];

function requireRole(userRole: WorkspaceRole | null, allowed: WorkspaceRole[]) {
  if (!userRole || !allowed.includes(userRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

export const teamRouter = router({
  // Mirror of workspace.listMembers
  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const members = await ctx.prisma.workspaceUser.findMany({
        where: { workspaceId: ctx.workspaceId!, isActive: true },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: {
          user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        },
      });
      return members.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        createdAt: m.createdAt,
        user: m.user,
      }));
    }),

  // Mirror of workspace.inviteMember (with crypto token)
  invite: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        email: z.string().email(),
        role: z.nativeEnum(WorkspaceRole).default("operator"),
        nickname: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.workspaceId! },
        select: { maxUsers: true, _count: { select: { members: { where: { isActive: true } } } } },
      });
      if (!workspace) throw new TRPCError({ code: "NOT_FOUND" });

      if (workspace._count.members >= workspace.maxUsers) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Workspace has reached its member limit (${workspace.maxUsers}). Upgrade your plan to add more.`,
        });
      }

      const existingMembership = await ctx.prisma.workspaceUser.findFirst({
        where: {
          workspaceId: ctx.workspaceId!,
          user: { email: input.email },
          isActive: true,
        },
      });
      if (existingMembership) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${input.email} is already a member of this workspace`,
        });
      }

      const INVITE_EXPIRY_DAYS = parseInt(process.env.INVITE_EXPIRY_DAYS ?? "7", 10);
      const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const existing = await ctx.prisma.workspaceInvitation.findFirst({
        where: { workspaceId: ctx.workspaceId!, email: input.email, acceptedAt: null },
      });

      if (existing) {
        return ctx.prisma.workspaceInvitation.update({
          where: { id: existing.id },
          data: {
            role: input.role,
            expiresAt,
            invitedById: ctx.session!.user.id,
            ...(input.nickname ? { nickname: input.nickname } : {}),
          },
        });
      }

      const { randomBytes } = await import("crypto");
      const token = randomBytes(32).toString("hex");

      return ctx.prisma.workspaceInvitation.create({
        data: {
          workspaceId: ctx.workspaceId!,
          email: input.email,
          role: input.role,
          invitedById: ctx.session!.user.id,
          token,
          expiresAt,
          ...(input.nickname ? { nickname: input.nickname } : {}),
        },
      });
    }),

  // Mirror of workspace.updateMember (role update only)
  updateRole: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        memberId: z.string(),
        role: z.nativeEnum(WorkspaceRole),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const member = await ctx.prisma.workspaceUser.findFirst({
        where: { id: input.memberId, workspaceId: ctx.workspaceId! },
        select: { id: true, role: true, userId: true },
      });

      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      // Owners cannot be demoted by other admins
      if (member.role === "owner" && member.userId !== ctx.session!.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Workspace owner cannot be modified by another member",
        });
      }

      const result = await ctx.prisma.workspaceUser.updateMany({
        where: { id: input.memberId, workspaceId: ctx.workspaceId! },
        data: { role: input.role },
      });

      if (result.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      return ctx.prisma.workspaceUser.findUnique({
        where: { id: input.memberId },
        include: { user: { select: { id: true, displayName: true, email: true } } },
      });
    }),

  // Mirror of workspace.acceptInvite — protectedProcedure (user may not be a member yet)
  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });

      const invite = await ctx.prisma.workspaceInvitation.findUnique({
        where: { token: input.token },
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              maxUsers: true,
              _count: { select: { members: { where: { isActive: true } } } },
            },
          },
        },
      });

      if (!invite || invite.acceptedAt !== null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found or already used" });
      }

      if (invite.expiresAt < new Date()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Invitation has expired" });
      }

      if (invite.email !== ctx.session.user.email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `This invitation was sent to ${invite.email}. Sign in with that email address to accept it.`,
        });
      }

      if (invite.workspace._count.members >= invite.workspace.maxUsers) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Workspace has reached its member limit. Contact the workspace admin.",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        const existing = await tx.workspaceUser.findUnique({
          where: {
            workspaceId_userId: { workspaceId: invite.workspaceId, userId: ctx.session!.user.id },
          },
        });

        if (existing) {
          await tx.workspaceUser.update({
            where: { id: existing.id },
            data: { role: invite.role, isActive: true, joinedAt: new Date() },
          });
        } else {
          await tx.workspaceUser.create({
            data: {
              workspaceId: invite.workspaceId,
              userId: ctx.session!.user.id,
              role: invite.role,
              invitedBy: invite.invitedById,
              joinedAt: new Date(),
              isActive: true,
            },
          });
        }

        await tx.workspaceInvitation.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        });

        return { workspaceId: invite.workspaceId, workspaceName: invite.workspace.name, role: invite.role };
      });
    }),

  deactivateMember: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        memberId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const member = await ctx.prisma.workspaceUser.findFirst({
        where: { id: input.memberId, workspaceId: ctx.workspaceId! },
        select: { id: true, role: true, userId: true },
      });

      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      // Cannot deactivate yourself
      if (member.userId === ctx.session!.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot deactivate your own account" });
      }

      // Cannot deactivate the last owner
      if (member.role === "owner") {
        const ownerCount = await ctx.prisma.workspaceUser.count({
          where: { workspaceId: ctx.workspaceId!, role: "owner", isActive: true },
        });
        if (ownerCount <= 1) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot deactivate the last owner. Transfer ownership first.",
          });
        }
      }

      return ctx.prisma.$transaction(async (tx) => {
        const result = await tx.workspaceUser.updateMany({
          where: { id: input.memberId, workspaceId: ctx.workspaceId! },
          data: { isActive: false },
        });

        if (result.count === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
        }

        await tx.activityEvent.create({
          data: {
            workspaceId: ctx.workspaceId!,
            actorId: ctx.session!.user.id,
            eventType: "member_deactivated",
            description: "Member deactivated",
            entityType: "workspace_user",
            entityId: input.memberId,
          },
        });

        return { deactivated: true, memberId: input.memberId };
      });
    }),

  resendInvite: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        invitationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const invitation = await ctx.prisma.workspaceInvitation.findFirst({
        where: { id: input.invitationId, workspaceId: ctx.workspaceId! },
      });

      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      }

      if (invitation.acceptedAt !== null) {
        throw new TRPCError({ code: "CONFLICT", message: "Invitation has already been accepted" });
      }

      const { randomBytes } = await import("crypto");
      const token = randomBytes(32).toString("hex");
      const INVITE_EXPIRY_DAYS = parseInt(process.env.INVITE_EXPIRY_DAYS ?? "7", 10);
      const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      return ctx.prisma.workspaceInvitation.update({
        where: { id: input.invitationId },
        data: { token, expiresAt },
      });
    }),

  listInvitations: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      return ctx.prisma.workspaceInvitation.findMany({
        where: {
          workspaceId: ctx.workspaceId!,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          invitedBy: { select: { id: true, displayName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),
});
