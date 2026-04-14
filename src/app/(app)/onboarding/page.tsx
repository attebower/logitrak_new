"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const STEPS = ["Department", "Team", "Equipment", "Review"] as const;

const INDUSTRY_OPTIONS = [
  "Film & TV Production",
  "Live Events & Concerts",
  "Theatre & Performing Arts",
  "Corporate A/V",
  "Photography",
  "News & Broadcasting",
  "Other",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [deptName, setDeptName] = useState("");
  const [industry, setIndustry] = useState("");

  const canContinueStep0 = deptName.trim().length > 0 && industry.length > 0;
  const isLastStep = step === STEPS.length - 1;

  function handleContinue() {
    if (isLastStep) {
      router.push("/dashboard");
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                    i < step
                      ? "bg-brand-blue text-white"
                      : i === step
                      ? "bg-brand-blue text-white ring-2 ring-brand-blue ring-offset-2"
                      : "bg-grey-mid text-grey"
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </div>
                <span
                  className={`text-[11px] font-semibold hidden sm:block ${
                    i === step ? "text-surface-dark" : "text-grey"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${i < step ? "bg-brand-blue" : "bg-grey-mid"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-panel border border-grey-mid shadow-card p-6">
          {step === 0 && (
            <>
              <h1 className="text-heading text-surface-dark mb-1">Set up your department</h1>
              <p className="text-[13px] text-grey mb-6">Tell us about your department so we can configure LogiTrak for your workflow.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-surface-dark mb-1">
                    Department Name <span className="text-status-red">*</span>
                  </label>
                  <input
                    type="text"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="e.g. Lighting Department"
                    className="w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:ring-1 focus:ring-brand-blue"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-surface-dark mb-1">
                    Industry Type <span className="text-status-red">*</span>
                  </label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-brand-blue"
                  >
                    <option value="">Select industry…</option>
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-heading text-surface-dark mb-1">Invite your team</h1>
              <p className="text-[13px] text-grey mb-6">Add crew members who will check equipment in and out. You can skip this and invite later.</p>
              <div className="flex items-center justify-center h-24 border-2 border-dashed border-grey-mid rounded-card text-grey text-[13px]">
                Team invite — coming in Sprint 2
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-heading text-surface-dark mb-1">Add your equipment</h1>
              <p className="text-[13px] text-grey mb-6">Import your asset list via CSV or add items manually. You can do this anytime from the Equipment page.</p>
              <div className="flex items-center justify-center h-24 border-2 border-dashed border-grey-mid rounded-card text-grey text-[13px]">
                Equipment import — coming in Sprint 2
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-heading text-surface-dark mb-1">You&apos;re all set!</h1>
              <p className="text-[13px] text-grey mb-6">LogiTrak is ready to track equipment for <strong>{deptName || "your department"}</strong>. Head to your dashboard to get started.</p>
              <div className="bg-status-green-light rounded-card p-4 text-[13px] text-status-green font-medium">
                ✓ Department configured — {deptName || "—"}<br />
                ✓ Industry — {industry || "—"}
              </div>
            </>
          )}

          <div className="flex justify-between items-center mt-6">
            {step > 0 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="text-[12px] text-grey hover:text-surface-dark"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}
            <Button
              variant="primary"
              disabled={step === 0 && !canContinueStep0}
              onClick={handleContinue}
            >
              {isLastStep ? "Go to Dashboard" : "Continue →"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
