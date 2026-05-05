import Stripe from "stripe";

/**
 * Stripe client — lazy-initialized to avoid build-time errors when
 * STRIPE_SECRET_KEY is not yet configured.
 *
 * All billing procedures should call getStripe() rather than importing
 * `stripe` directly, so errors are surfaced at runtime not at build time.
 */

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured. Add it to .env.local to enable billing.");
    }
    _stripe = new Stripe(key, {
      apiVersion: "2026-03-25.dahlia" as const,
      typescript: true,
    });
  }
  return _stripe;
}

// Alias for backwards compat with billing.ts that imports `stripe` directly
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop: string | symbol) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe has no index signature
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const STRIPE_PLANS = {
  starter: {
    priceId:   process.env.STRIPE_PRICE_STARTER ?? "",
    maxUsers:  5,
    maxAssets: 500,
  },
  professional: {
    priceId:   process.env.STRIPE_PRICE_PROFESSIONAL ?? "",
    maxUsers:  20,
    maxAssets: 10000,
  },
  enterprise: {
    priceId:   process.env.STRIPE_PRICE_ENTERPRISE ?? "",
    maxUsers:  999999,
    maxAssets: 999999,
  },
} as const;
