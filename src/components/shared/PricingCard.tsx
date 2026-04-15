/**
 * LogiTrak PricingCard Component
 * For the billing settings page — NOT the marketing landing page.
 * (Landing page pricing cards are separate, built inline there.)
 *
 * Three variants:
 *   current    — active plan, usage bars, Manage billing button
 *   upgrade    — available plan, feature list, Upgrade CTA
 *   past_due   — current plan but payment failed, red banner + Update payment method
 *
 * Usage:
 *   // Current plan
 *   <PricingCard
 *     variant="current"
 *     plan={{ name: "Professional", price: 89, currency: "£", period: "mo" }}
 *     usage={{ assets: { used: 847, limit: 10000 }, users: { used: 6, limit: 20 } }}
 *     onManageBilling={() => redirectToStripePortal()}
 *   />
 *
 *   // Upgrade option
 *   <PricingCard
 *     variant="upgrade"
 *     plan={{ name: "Enterprise", price: 249, currency: "£", period: "mo" }}
 *     features={["Unlimited assets", "Unlimited users", "Audit log", "Priority support"]}
 *     onUpgrade={() => startUpgradeFlow()}
 *   />
 *
 *   // Past due
 *   <PricingCard
 *     variant="past_due"
 *     plan={{ name: "Professional", price: 89, currency: "£", period: "mo" }}
 *     usage={{ assets: { used: 847, limit: 10000 }, users: { used: 6, limit: 20 } }}
 *     onUpdatePayment={() => redirectToStripePortal()}
 *   />
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Data shapes ───────────────────────────────────────────────────────────

export interface PlanInfo {
  name:     string;
  price:    number;
  currency: string;
  period:   "mo" | "yr";
}

export interface UsageMetric {
  used:  number;
  limit: number | "unlimited";
}

export interface PlanUsage {
  assets: UsageMetric;
  users:  UsageMetric;
}

// ── Variants ──────────────────────────────────────────────────────────────

interface CurrentPricingCardProps {
  variant:          "current";
  plan:             PlanInfo;
  usage:            PlanUsage;
  onManageBilling?: () => void;
}

interface UpgradePricingCardProps {
  variant:    "upgrade";
  plan:       PlanInfo;
  features:   string[];
  onUpgrade?: () => void;
}

interface PastDuePricingCardProps {
  variant:          "past_due";
  plan:             PlanInfo;
  usage:            PlanUsage;
  onUpdatePayment?: () => void;
}

export type PricingCardProps =
  | CurrentPricingCardProps
  | UpgradePricingCardProps
  | PastDuePricingCardProps;

// ── Component ─────────────────────────────────────────────────────────────

export function PricingCard(props: PricingCardProps) {
  return (
    <div className={cn(
      "bg-white rounded-panel border overflow-hidden",
      props.variant === "past_due"
        ? "border-status-red"
        : "border-grey-mid"
    )}>
      {/* Past due banner */}
      {props.variant === "past_due" && (
        <div className="bg-status-red-light border-b border-status-red px-5 py-2.5 flex items-center gap-2">
          <span className="text-status-red text-[13px] font-semibold">
            ⚠ Payment failed — your account is past due
          </span>
        </div>
      )}

      <div className="p-6">
        {/* Plan header */}
        <PlanHeader plan={props.plan} />

        {/* Variant-specific content */}
        {(props.variant === "current" || props.variant === "past_due") && (
          <>
            <UsageBars usage={props.usage} />
            <div className="mt-5 flex flex-col gap-2">
              {props.variant === "past_due" && props.onUpdatePayment && (
                <Button
                  variant="destructive"
                  onClick={props.onUpdatePayment}
                  className="w-full"
                >
                  Update payment method
                </Button>
              )}
              {props.variant === "current" && props.onManageBilling && (
                <Button
                  variant="secondary"
                  onClick={props.onManageBilling}
                  className="w-full"
                >
                  Manage billing →
                </Button>
              )}
            </div>
          </>
        )}

        {props.variant === "upgrade" && (
          <>
            <FeatureList features={props.features} />
            <div className="mt-5">
              {props.onUpgrade && (
                <Button
                  variant="primary"
                  onClick={props.onUpgrade}
                  className="w-full"
                >
                  Upgrade to {props.plan.name}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function PlanHeader({ plan }: { plan: PlanInfo }) {
  return (
    <div className="mb-5">
      <p className="text-caption text-grey uppercase mb-1">{plan.name}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-[36px] font-extrabold text-surface-dark tracking-tight">
          {plan.currency}{plan.price}
        </span>
        <span className="text-[14px] text-grey">/ {plan.period}</span>
      </div>
    </div>
  );
}

function UsageBars({ usage }: { usage: PlanUsage }) {
  return (
    <div className="space-y-4">
      <UsageBar
        label="Assets"
        metric={usage.assets}
      />
      <UsageBar
        label="Team members"
        metric={usage.users}
      />
    </div>
  );
}

function UsageBar({ label, metric }: { label: string; metric: UsageMetric }) {
  const isUnlimited = metric.limit === "unlimited";
  const pct = isUnlimited
    ? 0
    : Math.min(100, Math.round((metric.used / (metric.limit as number)) * 100));

  // Colour the bar amber when >80%, red when >95%
  const barColor =
    pct >= 95 ? "bg-status-red"
    : pct >= 80 ? "bg-status-amber"
    : "bg-brand-blue";

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[12px] text-grey">{label}</span>
        <span className="text-[12px] text-surface-dark font-medium">
          {metric.used.toLocaleString()}
          {" / "}
          {isUnlimited ? "Unlimited" : (metric.limit as number).toLocaleString()}
        </span>
      </div>
      {!isUnlimited && (
        <div className="bg-grey-mid rounded-full h-[6px]">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={metric.used}
            aria-valuemin={0}
            aria-valuemax={metric.limit as number}
            aria-label={`${label}: ${metric.used} of ${metric.limit}`}
          />
        </div>
      )}
    </div>
  );
}

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="space-y-2.5">
      {features.map((f) => (
        <li key={f} className="flex items-start gap-2.5 text-[13px] text-surface-dark">
          <span className="text-status-green font-bold mt-px flex-shrink-0">✓</span>
          {f}
        </li>
      ))}
    </ul>
  );
}
