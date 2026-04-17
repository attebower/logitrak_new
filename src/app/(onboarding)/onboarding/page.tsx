"use client";

/**
 * Onboarding wizard — 3 steps.
 *
 * Step 1: Your Profile   → trpc.user.updateProfile
 * Step 2: Invite Team    → trpc.team.invite per row (skippable)
 * Step 3: All set!       → go to dashboard
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";

const STEPS = ["Your Profile", "Invite Team", "All Set"] as const;

const DEPARTMENT_OPTIONS = [
  "Lighting",
  "Camera",
  "Grip",
  "Props",
  "Art Direction",
  "Sound",
  "Costume",
  "Make-Up & Hair",
  "Stunts",
  "Visual Effects",
  "Production",
  "Locations",
  "Transport",
  "Catering",
  "Medical",
  "Security",
  "Other",
] as const;

interface InviteRow {
  fullName: string;
  nickname: string;
  email: string;
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={[
                "w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors",
                i < current
                  ? "bg-brand-blue text-white"
                  : i === current
                  ? "bg-brand-blue text-white ring-2 ring-brand-blue ring-offset-2 ring-offset-grey-light"
                  : "bg-white border border-grey-mid text-slate-400",
              ].join(" ")}
            >
              {i < current ? "✓" : i + 1}
            </div>
            <span
              className={[
                "text-[12px] font-semibold hidden sm:block",
                i === current ? "text-surface-dark" : "text-slate-400",
              ].join(" ")}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`flex-1 h-px mx-3 transition-colors ${
                i < current ? "bg-brand-blue" : "bg-grey-mid"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

const inputCls =
  "w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-brand-blue placeholder:text-slate-400";

export default function OnboardingPage() {
  const router = useRouter();

  // ── Step 1 state ──
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [department, setDepartment] = useState("");
  const [subDepartment, setSubDepartment] = useState("");
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // ── Step 2 state ──
  const [rows, setRows] = useState<InviteRow[]>([{ fullName: "", nickname: "", email: "" }]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  // ── Derived first name for personalisation ──
  const firstName = fullName.trim().split(" ")[0] ?? "";

  // ── Mutations ──
  const updateProfile = trpc.user.updateProfile.useMutation();
  const userMe = trpc.user.me.useQuery();
  const teamInvite = trpc.team.invite.useMutation();

  // ── Step handlers ──

  async function handleStep1() {
    setStep1Error(null);
    if (!fullName.trim()) { setStep1Error("Full name is required."); return; }
    if (!department) { setStep1Error("Please select a department."); return; }
    try {
      await updateProfile.mutateAsync({
        fullName: fullName.trim(),
        displayName: nickname.trim() || fullName.trim().split(" ")[0],
        ...(nickname.trim() && { nickname: nickname.trim() }),
        department,
        ...(subDepartment.trim() && { subDepartment: subDepartment.trim() }),
      });
      setStep(1);
    } catch (err: unknown) {
      setStep1Error(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function addRow() {
    setRows((r) => [...r, { fullName: "", nickname: "", email: "" }]);
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, j) => j !== i));
  }

  function updateRow(i: number, field: keyof InviteRow, value: string) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [field]: value } : row)));
  }

  async function handleStep2() {
    setInviteError(null);

    const filled = rows.filter((r) => r.email.trim());
    if (filled.length === 0) { setStep(2); return; }

    for (const row of filled) {
      if (!row.email.includes("@")) {
        setInviteError(`"${row.email}" is not a valid email address.`);
        return;
      }
    }

    const workspaceId = userMe.data?.workspace?.id;
    if (!workspaceId) {
      setInviteError("Could not resolve workspace. Please refresh and try again.");
      return;
    }

    setInviting(true);
    const failed: string[] = [];
    for (const row of filled) {
      try {
        await teamInvite.mutateAsync({
          workspaceId,
          email: row.email.trim(),
          role: "operator",
          ...(row.nickname.trim() && { nickname: row.nickname.trim() }),
        });
      } catch {
        failed.push(row.email.trim());
      }
    }
    setInviting(false);
    if (failed.length) {
      setInviteError(`Failed to invite: ${failed.join(", ")}`);
    }
    setStep(2);
  }

  // ── Render ──

  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 min-h-0">
      <div className="w-full max-w-lg">
        <StepIndicator current={step} />

        {/* Card */}
        <div className="bg-white rounded-panel border border-grey-mid p-8 shadow-sm">

          {/* ── Step 1: Your Profile ── */}
          {step === 0 && (
            <>
              <h1 className="text-[20px] font-bold text-surface-dark mb-1">Let&apos;s get you set up</h1>
              <p className="text-[13px] text-slate-500 mb-6">
                Tell us a bit about yourself so we can personalise LogiTrak for your workflow.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Full Name <span className="text-status-red">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Jamie Wilson"
                    className={inputCls}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Nickname
                    <span className="ml-1.5 text-[10px] font-normal normal-case text-slate-400">What your crew calls you</span>
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. JW, Sparky"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Department <span className="text-status-red">*</span>
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select department…</option>
                    {DEPARTMENT_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Your role within the department
                  </label>
                  <input
                    type="text"
                    value={subDepartment}
                    onChange={(e) => setSubDepartment(e.target.value)}
                    placeholder="e.g. Rigging Gaffer, Focus Puller"
                    className={inputCls}
                  />
                </div>

                {step1Error && (
                  <p className="text-[12px] text-status-red">{step1Error}</p>
                )}
              </div>

              <p className="mt-5 text-[11px] text-slate-400">
                You&apos;ll be set as the workspace admin — this can be changed at any time.
              </p>

              <div className="flex justify-end mt-6">
                <Button
                  variant="primary"
                  disabled={!fullName.trim() || !department || updateProfile.isPending}
                  onClick={handleStep1}
                >
                  {updateProfile.isPending ? "Saving…" : "Continue →"}
                </Button>
              </div>
            </>
          )}

          {/* ── Step 2: Invite Your Team ── */}
          {step === 1 && (
            <>
              <h1 className="text-[20px] font-bold text-surface-dark mb-1">Who&apos;s on your crew?</h1>
              <p className="text-[13px] text-slate-500 mb-6">
                Add team members now or skip and invite them later from the Team page.
              </p>

              <div className="space-y-3">
                {rows.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={row.fullName}
                      onChange={(e) => updateRow(i, "fullName", e.target.value)}
                      placeholder="Full name"
                      className={`flex-1 min-w-0 ${inputCls}`}
                    />
                    <input
                      type="text"
                      value={row.nickname}
                      onChange={(e) => updateRow(i, "nickname", e.target.value)}
                      placeholder="Nickname"
                      className="w-24 border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-brand-blue placeholder:text-slate-400"
                    />
                    <input
                      type="email"
                      value={row.email}
                      onChange={(e) => updateRow(i, "email", e.target.value)}
                      placeholder="Email address"
                      className={`flex-1 min-w-0 ${inputCls}`}
                    />
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-slate-400 hover:text-status-red shrink-0"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addRow}
                className="mt-3 flex items-center gap-1.5 text-[13px] text-brand-blue hover:underline"
              >
                <Plus size={13} />
                Add another person
              </button>

              {inviteError && (
                <p className="mt-3 text-[12px] text-status-red">{inviteError}</p>
              )}

              <p className="mt-4 text-[11px] text-slate-400">
                Team members will receive an email invite to create their account.
              </p>

              <div className="flex justify-between items-center mt-6">
                <button
                  onClick={() => setStep(0)}
                  className="text-[12px] text-slate-400 hover:text-surface-dark"
                >
                  ← Back
                </button>
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setStep(2)}
                    disabled={inviting}
                  >
                    Skip for now
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleStep2}
                    disabled={inviting}
                  >
                    {inviting ? "Sending…" : "Continue →"}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: All set! ── */}
          {step === 2 && (
            <div className="text-center py-4">
              <CheckCircle2
                size={56}
                className="mx-auto mb-5 text-status-green"
                strokeWidth={1.5}
              />
              <h1 className="text-[22px] font-bold text-surface-dark mb-2">You&apos;re ready to go</h1>
              <p className="text-[14px] text-slate-500 mb-8">
                Welcome to LogiTrak{firstName ? `, ${firstName}` : ""}.
              </p>
              <Button variant="primary" onClick={() => router.push("/dashboard")}>
                Go to Dashboard →
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
