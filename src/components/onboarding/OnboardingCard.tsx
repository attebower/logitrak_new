"use client";

/**
 * OnboardingCard — centred white card wrapper for each onboarding stage.
 * Dark navy background, LogiTrak wordmark, stepper, and card content.
 */

import { Stepper } from "./Stepper";

interface OnboardingCardProps {
  /** Zero-indexed current stage */
  currentStage: number;
  children: React.ReactNode;
}

export function OnboardingCard({ currentStage, children }: OnboardingCardProps) {
  return (
    <div className="min-h-screen bg-[#0F2757] flex flex-col items-center px-4 py-8 sm:py-12">
      {/* Wordmark */}
      <div className="text-center mb-6">
        <div className="text-[28px] font-extrabold tracking-tight">
          <span className="text-brand-blue">Logi</span>
          <span className="text-white">Trak</span>
        </div>
        <p className="text-[13px] text-slate-400 mt-1">Equipment tracking for production</p>
      </div>

      {/* Stepper */}
      <Stepper totalSteps={3} currentStep={currentStage} />

      {/* Card */}
      <div className="w-full max-w-[560px] bg-white rounded-[12px] shadow-lg p-6 sm:p-12">
        {children}
      </div>
    </div>
  );
}
