"use client";

/**
 * Stepper — horizontal progress indicator for onboarding.
 * Numbers only (no labels) to stay compact on mobile.
 * States: complete (green tick), active (filled blue), upcoming (outline grey).
 */

import { Check } from "lucide-react";

interface StepperProps {
  totalSteps: number;
  /** Zero-indexed */
  currentStep: number;
}

export function Stepper({ totalSteps, currentStep }: StepperProps) {
  return (
    <div className="flex items-center gap-0 mb-8 w-full max-w-[320px]">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          {/* Dot */}
          <div
            className={[
              "w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 transition-all",
              i < currentStep
                ? "bg-[#059669] text-white"
                : i === currentStep
                ? "bg-brand-blue text-white ring-2 ring-brand-blue/30 ring-offset-2 ring-offset-[#0F2757]"
                : "bg-transparent border-2 border-slate-500 text-slate-500",
            ].join(" ")}
          >
            {i < currentStep ? <Check size={16} strokeWidth={3} /> : i + 1}
          </div>

          {/* Connector line */}
          {i < totalSteps - 1 && (
            <div
              className={[
                "flex-1 h-[2px] mx-2 transition-colors",
                i < currentStep ? "bg-[#059669]" : "bg-slate-600",
              ].join(" ")}
            />
          )}
        </div>
      ))}
    </div>
  );
}
