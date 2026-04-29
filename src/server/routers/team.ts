import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure, workspaceProcedure } from "../trpc";
import { WorkspaceRole } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { sendEmail } from "@/lib/email/client";
import { InviteEmail } from "@/lib/email/templates/InviteEmail";

const ADMIN_ROLES: WorkspaceRole[] = ["owner", "admin"];

function requireRole(userRole: WorkspaceRole | null, allowed: WorkspaceRole[]) {
  if (!userRole || !allowed.includes(userRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

/**
 * Send the invitation email and bookkeep on the row. Best-effort: if the
 * provider rejects (or RESEND_API_KEY is unset), we log and bump the count
 * but never roll back the DB invite — the user can resend from the UI.
 */
async function sendInviteEmail(
  prisma: PrismaClient,
  invitation: {
    id: string;
    email: string;
    token: string;
    role: WorkspaceRole;
    expiresAt: Date;
  },
  workspace: { name: string; logoUrl: string | null },
  inviter: { displayName: string | null; email: string },
): Promise<void> {
  const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const acceptUrl = `${baseUrl.replace(/\/$/, "")}/accept-invite/${invitation.token}`;
  const inviterName = inviter.displayName?.trim() || inviter.email;

  try {
    await sendEmail({
      to:      invitation.email,
      subject: `You're invited to ${workspace.name} on LogiTrak`,
      react:   InviteEmail({
        workspaceName:    workspace.name,
        workspaceLogoUrl: workspace.logoUrl,
        inviterName,
        inviteeRole:      invitation.role,
        acceptUrl,
        expiresAt:        invitation.expiresAt,
      }),
    });
    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data:  { emailSentAt: new Date(), emailSendCount: { increment: 1 } },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[invite] failed to send email for invitation ${invitation.id}:`, err);
    // Bump count so retries are visible in the UI.
    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data:  { emailSendCount: { increment: 1 } },
    });
    throw new TRPCError({
      code:    "INTERNAL_SERVER_ERROR",
      message: `Invitation saved but the email failed to send. You can retry from the team page.`,
    });
  }
}

export const teamRouter = router({
  // Mirror of workspace.listMembers — now includes per-project memberships
  // so the team UI can show "what projects is this user on".
  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const members = await ctx.prisma.workspaceUser.findMany({
        where: { workspaceId: ctx.workspaceId!, isActive: true },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: {
          user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
          projectMemberships: {
            include: { project: { select: { id: true, name: true, status: true } } },
          },
        },
      });
      return members.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        createdAt: m.createdAt,
        user: m.user,
        projects: m.projectMemberships.map((pm) => pm.project),
      }));
    }),

  // Mirror of workspace.inviteMember (with crypto token).
  // `projectIds` (optional) scopes the invitee to those projects on accept.
  // Admins/owners ignore projectIds since they have workspace-wide access.
  invite: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        email: z.string().email(),
        role: z.nativeEnum(WorkspaceRole).default("operator"),
        nickname: z.string().max(50).optional(),
        projectIds: z.array(z.string()).optional().default([]),
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

      // If projectIds were passed, verify they all belong to this workspace.
      const isAdminInvite = ADMIN_ROLES.includes(input.role);
      const projectIds = isAdminInvite ? [] : input.projectIds;
      if (projectIds.length > 0) {
        const found = await ctx.prisma.project.findMany({
          where: { id: { in: projectIds }, workspaceId: ctx.workspaceId! },
          select: { id: true },
        });
        if (found.length !== projectIds.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "One or more projects don't belong to this workspace" });
        }
      }

      const INVITE_EXPIRY_DAYS = parseInt(process.env.INVITE_EXPIRY_DAYS ?? "7", 10);
      const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const existing = await ctx.prisma.workspaceInvitation.findFirst({
        where: { workspaceId: ctx.workspaceId!, email: input.email, acceptedAt: null },
      });

      let invitation;
      if (existing) {
        invitation = await ctx.prisma.workspaceInvitation.update({
          where: { id: existing.id },
          data: {
            role: input.role,
            expiresAt,
            invitedById: ctx.session!.user.id,
            projectIds,
            ...(input.nickname ? { nickname: input.nickname } : {}),
          },
        });
      } else {
        const { randomBytes } = await import("crypto");
        const token = randomBytes(32).toString("hex");
        invitation = await ctx.prisma.workspaceInvitation.create({
          data: {
            workspaceId: ctx.workspaceId!,
            email: input.email,
            role: input.role,
            invitedById: ctx.session!.user.id,
            token,
            expiresAt,
            projectIds,
            ...(input.nickname ? { nickname: input.nickname } : {}),
          },
        });
      }

      // Send the email — best effort. The DB row is committed already.
      const [ws, inviter] = await Promise.all([
        ctx.prisma.workspace.findUnique({
          where:  { id: ctx.workspaceId! },
          select: { name: true, logoUrl: true },
        }),
        ctx.prisma.userProfile.findUnique({
          where:  { id: ctx.session!.user.id },
          select: { displayName: true, email: true },
        }),
      ]);
      if (ws && inviter) {
        await sendInviteEmail(ctx.prisma as unknown as PrismaClient, invitation, ws, inviter);
      }
      return invitation;
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

        let membership;
        if (existing) {
          membership = await tx.workspaceUser.update({
            where: { id: existing.id },
            data: { role: invite.role, isActive: true, joinedAt: new Date() },
          });
        } else {
          membership = await tx.workspaceUser.create({
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

        // If the invite carried project scoping, create the membership rows.
        // Skip this for admin-level invites (workspace-wide already).
        const isAdminInvite = ADMIN_ROLES.includes(invite.role);
        if (!isAdminInvite && invite.projectIds.length > 0) {
          // Filter to projects still in this workspace, in case any were deleted.
          const projects = await tx.project.findMany({
            where: { id: { in: invite.projectIds }, workspaceId: invite.workspaceId },
            select: { id: true },
          });
          for (const p of projects) {
            await tx.projectMembership.upsert({
              where: { workspaceUserId_projectId: { workspaceUserId: membership.id, projectId: p.id } },
              create: { workspaceUserId: membership.id, projectId: p.id },
              update: {},
            });
          }
        }

        await tx.workspaceInvitation.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        });

        return { workspaceId: invite.workspaceId, workspaceName: invite.workspace.name, role: invite.role };
      });
    }),

  // ── Project membership management ──────────────────────────────────────

  /** Replace the full set of projects a member is on (admin/owner only). */
  setMemberProjects: workspaceProcedure
    .input(z.object({
      workspaceId:    z.string(),
      memberId:       z.string(),     // WorkspaceUser id
      projectIds:     z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);
      const wid = ctx.workspaceId!;

      const member = await ctx.prisma.workspaceUser.findFirst({
        where: { id: input.memberId, workspaceId: wid },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify projects belong to this workspace
      if (input.projectIds.length > 0) {
        const found = await ctx.prisma.project.findMany({
          where: { id: { in: input.projectIds }, workspaceId: wid },
          select: { id: true },
        });
        if (found.length !== input.projectIds.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "One or more projects don't belong to this workspace" });
        }
      }

      await ctx.prisma.$transaction([
        ctx.prisma.projectMembership.deleteMany({ where: { workspaceUserId: member.id } }),
        ...(input.projectIds.length > 0
          ? [ctx.prisma.projectMembership.createMany({
              data: input.projectIds.map((projectId) => ({ workspaceUserId: member.id, projectId })),
              skipDuplicates: true,
            })]
          : []),
      ]);

      return { success: true };
    }),

  /** Add an existing workspace user to a project (admin/owner only). */
  addMemberToProject: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      memberId:    z.string(),
      projectId:   z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);
      const wid = ctx.workspaceId!;
      const [member, project] = await Promise.all([
        ctx.prisma.workspaceUser.findFirst({ where: { id: input.memberId, workspaceId: wid } }),
        ctx.prisma.project.findFirst({ where: { id: input.projectId, workspaceId: wid } }),
      ]);
      if (!member)  throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

      await ctx.prisma.projectMembership.upsert({
        where:  { workspaceUserId_projectId: { workspaceUserId: member.id, projectId: project.id } },
        create: { workspaceUserId: member.id, projectId: project.id },
        update: {},
      });
      return { success: true };
    }),

  /** Remove a member from a project (admin/owner only). */
  removeMemberFromProject: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      memberId:    z.string(),
      projectId:   z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);
      const wid = ctx.workspaceId!;
      const member = await ctx.prisma.workspaceUser.findFirst({
        where: { id: input.memberId, workspaceId: wid },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.projectMembership.deleteMany({
        where: { workspaceUserId: member.id, projectId: input.projectId },
      });
      return { success: true };
    }),

  /** List members on a specific project — owner/admin always included. */
  listProjectMembers: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const wid = ctx.workspaceId!;
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, workspaceId: wid },
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      const memberships = await ctx.prisma.projectMembership.findMany({
        where: { projectId: input.projectId },
        include: {
          workspaceUser: {
            include: {
              user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
            },
          },
        },
      });
      return memberships.map((m) => ({
        memberId:   m.workspaceUserId,
        role:       m.workspaceUser.role,
        addedAt:    m.createdAt,
        user:       m.workspaceUser.user,
      }));
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

  /** Cancel (delete) a pending invitation. */
  cancelInvite: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.userRole, ADMIN_ROLES);

      const invitation = await ctx.prisma.workspaceInvitation.findFirst({
        where: { id: input.invitationId, workspaceId: ctx.workspaceId! },
        select: { id: true, acceptedAt: true },
      });
      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      }
      if (invitation.acceptedAt !== null) {
        throw new TRPCError({ code: "CONFLICT", message: "Cannot cancel an invitation that's already accepted" });
      }

      await ctx.prisma.workspaceInvitation.delete({ where: { id: input.invitationId } });
      return { cancelled: true, invitationId: input.invitationId };
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

      const refreshed = await ctx.prisma.workspaceInvitation.update({
        where: { id: input.invitationId },
        data: { token, expiresAt },
      });

      const [ws, inviter] = await Promise.all([
        ctx.prisma.workspace.findUnique({
          where:  { id: ctx.workspaceId! },
          select: { name: true, logoUrl: true },
        }),
        ctx.prisma.userProfile.findUnique({
          where:  { id: ctx.session!.user.id },
          select: { displayName: true, email: true },
        }),
      ]);
      if (ws && inviter) {
        await sendInviteEmail(ctx.prisma as unknown as PrismaClient, refreshed, ws, inviter);
      }
      return refreshed;
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

  /**
   * Public lookup: read invite metadata by token. Used by the
   * /accept-invite/[token] page so it can render context without forcing the
   * recipient to sign in first. Never returns the token itself.
   */
  getInviteByToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const invite = await ctx.prisma.workspaceInvitation.findUnique({
        where:   { token: input.token },
        include: {
          workspace: { select: { name: true, logoUrl: true } },
          invitedBy: { select: { displayName: true, email: true } },
        },
      });
      if (!invite) {
        return { found: false as const };
      }
      const inviterName = invite.invitedBy?.displayName?.trim() || invite.invitedBy?.email || "A workspace admin";
      return {
        found:           true as const,
        email:           invite.email,
        role:            invite.role,
        workspaceName:   invite.workspace.name,
        workspaceLogoUrl: invite.workspace.logoUrl,
        inviterName,
        expiresAt:       invite.expiresAt,
        expired:         invite.expiresAt < new Date(),
        alreadyAccepted: invite.acceptedAt !== null,
      };
    }),
});
