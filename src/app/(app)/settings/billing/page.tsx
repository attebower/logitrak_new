"use client";

/**
 * Billing settings page — Sprint 4
 *
 * trpc.billing.getSubscription      → current plan + status + usage
 * trpc.billing.createCheckoutSession → redirect to Stripe checkout (upgrade)
 * trpc.billing.createPortalSession   → redirect to Stripe portal (manage)
 *
 * Stripe keys required in .env: STRIPE_SECRET_KEY, STRIPE_PRICE_*
 * Until keys are configured, checkout/portal calls return an error which
 * is surfaced inline — the UI renders correctly regardless.
 *
 * Owner-only: non-owners see a read-only view without action buttons.
 */

import { PricingCard } from "@/components/shared/PricingCard";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";

// Plan display config
const PLAN_CONFIG = {
  starter: {
    name:  "Starter",
    price: 29,
    features: ["Up to 5 team members", "500 assets", "Check in/out + damage tracking", "Email support"],
  },
  professional: {
    name:  "Professional",
    price: 89,
    features: ["Up to 20 team members", "10,000 assets", "Full activity log", "Set Snapshots", "Priority support"],
  },
  enterprise: {
    name:  "Enterprise",
    price: 249,
    features: ["Unlimited team members", "Unlimited assets", "Full audit log", "CSV export", "Dedicated support"],
  },
} as const;

type PlanTier = keyof typeof PLAN_CONFIG;

const UPGRADE_ORDER: PlanTier[] = ["starter", "professional", "enterprise"];

export default function BillingPage() {
  const { workspaceId, userRole } = useWorkspace();
  const isOwner = userRole === "owner";

  const { data: sub, isLoading, error: subError } = trpc.billing.getSubscription.useQuery(
    { workspaceId },
    { refetchInterval: 60_000 }
  );

  const { data: workspace } = trpc.workspace.get.useQuery({ workspaceId });

  const checkout = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: ({ url }) => { window.location.href = url; },
  });

  const portal = trpc.billing.createPortalSession.useMutation({
    onSuccess: ({ url }) => { window.location.href = url; },
  });

  // Determine which upgrade options to show
  const currentTierIndex = sub ? UPGRADE_ORDER.indexOf(sub.tier as PlanTier) : -1;
  const upgradePlans = UPGRADE_ORDER.filter((_, i) => i > currentTierIndex);

  // ── Loading / error ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[13px] text-grey">Loading subscription…</div>
        </div>
      </>
    );
  }

  if (subError || !sub) {
    return (
      <>
        
        <div className="flex-1 p-6">
          <div className="bg-status-red-light border border-status-red/20 rounded-card px-5 py-4 text-[13px] text-status-red">
            Unable to load subscription information. {subError?.message}
          </div>
        </div>
      </>
    );
  }

  const currentPlanConfig = PLAN_CONFIG[sub.tier as PlanTier] ?? {
    name: sub.tier,
    price: 0,
    features: [],
  };

  const mutationError = checkout.error?.message ?? portal.error?.message;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">

          {/* Mutation error */}
          {mutationError && (
            <div className="bg-status-red-light border border-status-red/20 rounded-card px-5 py-3 text-[12px] text-status-red">
              {mutationError}
            </div>
          )}

          {/* Stripe keys not configured notice */}
          {(!process.env.NEXT_PUBLIC_STRIPE_CONFIGURED) && (
            <div className="bg-status-amber-light border border-status-amber/20 rounded-card px-5 py-3 text-[12px] text-status-amber">
              ⚠ Stripe keys not yet configured — billing actions will fail until{" "}
              <code className="font-mono">STRIPE_SECRET_KEY</code> and price IDs are set in <code className="font-mono">.env.local</code>.
            </div>
          )}

          {/* Current plan */}
          <div>
            <h2 className="text-caption text-grey uppercase mb-3">Current Plan</h2>
            <PricingCard
              variant={sub.status === "past_due" ? "past_due" : "current"}
              plan={{
                name:     currentPlanConfig.name,
                price:    currentPlanConfig.price,
                currency: "£",
                period:   "mo",
              }}
              usage={{
                assets: {
                  used:  workspace?.equipmentCount ?? 0,
                  limit: sub.maxAssets > 500000 ? "unlimited" : sub.maxAssets,
                },
                users: {
                  used:  workspace?.memberCount ?? 1,
                  limit: sub.maxUsers > 500000 ? "unlimited" : sub.maxUsers,
                },
              }}
              {...(sub.status === "past_due"
                ? {
                    onUpdatePayment: isOwner ? () => {
                      portal.mutate({
                        workspaceId,
                        returnUrl: `${window.location.origin}/settings/billing`,
                      });
                    } : undefined,
                  }
                : {
                    onManageBilling: isOwner ? () => {
                      portal.mutate({
                        workspaceId,
                        returnUrl: `${window.location.origin}/settings/billing`,
                      });
                    } : undefined,
                  }
              )}
            />

            {sub.trialEndsAt && sub.status === "trialing" && (
              <p className="text-[12px] text-grey mt-2">
                Trial ends {new Date(sub.trialEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
              </p>
            )}

            {!isOwner && (
              <p className="text-[11px] text-grey mt-2">
                Only the workspace owner can manage billing.
              </p>
            )}
          </div>

          {/* Upgrade options */}
          {isOwner && upgradePlans.length > 0 && (
            <div>
              <h2 className="text-caption text-grey uppercase mb-3">Upgrade</h2>
              <div className={`grid gap-4 ${upgradePlans.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                {upgradePlans.map((plan) => (
                  <PricingCard
                    key={plan}
                    variant="upgrade"
                    plan={{
                      name:     PLAN_CONFIG[plan].name,
                      price:    PLAN_CONFIG[plan].price,
                      currency: "£",
                      period:   "mo",
                    }}
                    features={[...PLAN_CONFIG[plan].features]}
                    onUpgrade={() => {
                      checkout.mutate({
                        workspaceId,
                        plan,
                        successUrl: `${window.location.origin}/settings/billing?success=1`,
                        cancelUrl:  `${window.location.origin}/settings/billing`,
                      });
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
