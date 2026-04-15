"use client";

/**
 * Onboarding layout — standalone group with TRPCProvider.
 * Separate from (auth) layout (which is too narrow and has no tRPC context).
 * Separate from (app) layout (which requires an existing workspace membership).
 */

import { TRPCProvider } from "@/lib/trpc/provider";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      <div className="min-h-screen bg-surface-dark flex flex-col">
        {/* Logo */}
        <div className="text-center pt-8 pb-2">
          <div className="text-[24px] font-extrabold tracking-tight">
            <span className="text-brand-blue">Logi</span>
            <span className="text-white">Trak</span>
          </div>
          <div className="text-[12px] text-slate-muted mt-0.5">Equipment tracking for production</div>
        </div>
        {children}
      </div>
    </TRPCProvider>
  );
}
