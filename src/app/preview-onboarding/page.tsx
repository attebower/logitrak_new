"use client";

/**
 * Preview route — view onboarding without auth or workspace checks.
 * LOCAL DEV ONLY — remove before production launch.
 */

import { TRPCProvider } from "@/lib/trpc/provider";
import OnboardingPage from "@/app/(onboarding)/onboarding/page";

export default function PreviewOnboarding() {
  return (
    <TRPCProvider>
      <div className="min-h-screen bg-grey-light flex flex-col">
        <div className="text-center pt-8 pb-2">
          <div className="text-[24px] font-extrabold tracking-tight">
            <span className="text-brand-blue">Logi</span>
            <span className="text-surface-dark">Trak</span>
          </div>
        </div>
        <OnboardingPage />
      </div>
    </TRPCProvider>
  );
}
