import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.prisma.userProfile.findUnique({
      where: { id: ctx.session!.user.id },
      include: {
        workspaceMemberships: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            workspaceId: true,
            role: true,
            workspace: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!profile) return null;

    const membership = profile.workspaceMemberships[0] ?? null;

    return {
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      fullName: profile.fullName,
      nickname: profile.nickname,
      department: profile.department,
      subDepartment: profile.subDepartment,
      avatarUrl: profile.avatarUrl,
      workspace: membership
        ? {
            id: membership.workspace.id,
            name: membership.workspace.name,
            slug: membership.workspace.slug,
            role: membership.role,
          }
        : null,
    };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(100).optional(),
        fullName: z.string().min(1).max(100).optional(),
        nickname: z.string().max(50).optional(),
        department: z.string().max(100).optional(),
        subDepartment: z.string().max(100).optional(),
        avatarUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.prisma.userProfile.update({
        where: { id: ctx.session!.user.id },
        data: {
          ...(input.displayName !== undefined && { displayName: input.displayName }),
          ...(input.fullName !== undefined && { fullName: input.fullName }),
          ...(input.nickname !== undefined && { nickname: input.nickname }),
          ...(input.department !== undefined && { department: input.department }),
          ...(input.subDepartment !== undefined && { subDepartment: input.subDepartment }),
          ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        },
      });

      return {
        id: updated.id,
        displayName: updated.displayName,
        fullName: updated.fullName,
        nickname: updated.nickname,
        department: updated.department,
        subDepartment: updated.subDepartment,
      };
    }),
});
