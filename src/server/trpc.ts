import { initTRPC, TRPCError } from "@trpc/server";
import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { type WorkspaceRole } from "@prisma/client";

export type Context = {
  supabase: ReturnType<typeof createClient>;
  prisma: typeof prisma;
  session: { user: { id: string; email?: string } } | null;
  workspaceId: string | null;
  userRole: WorkspaceRole | null;
};

export async function createTRPCContext(
  _opts: FetchCreateContextFnOptions // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<Context> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    prisma,
    session: user
      ? { user: { id: user.id, email: user.email } }
      : null,
    workspaceId: null,
    userRole: null,
  };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceAuth);

const enforceWorkspaceMember = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const parsed = z.object({ workspaceId: z.string() }).safeParse((opts as { input: unknown }).input);
  if (!parsed.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "workspaceId is required" });
  }

  const { workspaceId } = parsed.data;

  const membership = await prisma.workspaceUser.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: ctx.session.user.id,
      },
    },
    select: { role: true, isActive: true },
  });

  if (!membership || !membership.isActive) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this workspace" });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      workspaceId,
      userRole: membership.role,
    },
  });
});

export const workspaceProcedure = t.procedure.use(enforceAuth).use(enforceWorkspaceMember);
