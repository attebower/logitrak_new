import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "../trpc";
import { stripe, STRIPE_PLANS } from "@/lib/stripe";
import { WorkspaceRole } from "@prisma/client";

function requireOwner(userRole: WorkspaceRole | null) {
  if (userRole !== "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only workspace owners can manage billing" });
  }
}

export const billingRouter = router({
  getSubscription: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.workspaceId! },
        select: {
          subscriptionTier: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          maxUsers: true,
          maxAssets: true,
          stripeSubscriptionId: true,
        },
      });

      if (!workspace) throw new TRPCError({ code: "NOT_FOUND" });

      let liveStatus = workspace.subscriptionStatus;
      if (workspace.stripeSubscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(workspace.stripeSubscriptionId);
          liveStatus =
            sub.status === "active" ? "active"
            : sub.status === "trialing" ? "trialing"
            : sub.status === "past_due" ? "past_due"
            : "canceled";
        } catch {
          // Stripe unavailable — fall back to stored status
        }
      }

      return {
        tier: workspace.subscriptionTier,
        status: liveStatus,
        trialEndsAt: workspace.trialEndsAt,
        maxUsers: workspace.maxUsers,
        maxAssets: workspace.maxAssets,
      };
    }),

  createCheckoutSession: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        plan: z.enum(["starter", "professional", "enterprise"]),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireOwner(ctx.userRole);

      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.workspaceId! },
        select: { id: true, name: true, stripeCustomerId: true },
      });

      if (!workspace) throw new TRPCError({ code: "NOT_FOUND" });

      const planConfig = STRIPE_PLANS[input.plan];
      if (!planConfig.priceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Price ID for plan "${input.plan}" is not configured`,
        });
      }

      // Create or retrieve Stripe customer
      let customerId = workspace.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          name: workspace.name,
          metadata: { workspaceId: workspace.id },
        });
        customerId = customer.id;
        await ctx.prisma.workspace.update({
          where: { id: workspace.id },
          data: { stripeCustomerId: customerId },
        });
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: planConfig.priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { workspaceId: workspace.id },
      });

      if (!session.url) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create checkout session" });
      }

      return { url: session.url };
    }),

  createPortalSession: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        returnUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireOwner(ctx.userRole);

      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: ctx.workspaceId! },
        select: { stripeCustomerId: true },
      });

      if (!workspace) throw new TRPCError({ code: "NOT_FOUND" });

      if (!workspace.stripeCustomerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No billing account found. Set up a subscription first.",
        });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: workspace.stripeCustomerId,
        return_url: input.returnUrl,
      });

      return { url: session.url };
    }),
});
