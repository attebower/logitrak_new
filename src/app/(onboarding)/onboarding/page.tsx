"use client";

/**
 * Onboarding wizard — all 4 steps.
 * Lives in (onboarding) route group which wraps TRPCProvider.
 *
 * Step 1: Department name + industry → trpc.workspace.create
 * Step 2: Invite team → trpc.team.invite per entry (skippable)
 * Step 3: Add equipment → trpc.equipment.create per entry (skippable)
 *         CSV import stub — waiting for trpc.equipment.importCsv (Sage)
 * Step 4: Review summary → go to dashboard
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import type { IndustryType } from "@prisma/client";

const STEPS = ["Department", "Team", "Equipment", "Review"] as const;

// Only include enum values that exist in the Prisma schema
const INDUSTRY_OPTIONS: { value: IndustryType; label: string }[] = [
  { value: "film_tv", label: "Film & TV Production" },
  { value: "events",  label: "Live Events & Productions" },
];

const ROLE_OPTIONS = [
  { value: "admin",    label: "Admin" },
  { value: "manager",  label: "Manager" },
  { value: "operator", label: "Operator" },
];

interface InviteEntry  { email: string; role: "admin" | "manager" | "operator"; }
interface EquipEntry   { serial: string; name: string; category: string; }

export default function OnboardingPage() {
  const router = useRouter();

  const [step,          setStep]          = useState(0);
  const [deptName,      setDeptName]      = useState("");
  const [industry,      setIndustry]      = useState<IndustryType | "">("");
  const [workspaceId,   setWorkspaceId]   = useState<string | null>(null);
  const [step1Error,    setStep1Error]    = useState<string | null>(null);

  const [inviteEmail,   setInviteEmail]   = useState("");
  const [inviteRole,    setInviteRole]    = useState<InviteEntry["role"]>("operator");
  const [inviteList,    setInviteList]    = useState<InviteEntry[]>([]);
  const [inviteError,   setInviteError]   = useState<string | null>(null);
  const [inviting,      setInviting]      = useState(false);

  const [eqSerial,      setEqSerial]      = useState("");
  const [eqName,        setEqName]        = useState("");
  const [eqCategory,    setEqCategory]    = useState("");
  const [eqList,        setEqList]        = useState<EquipEntry[]>([]);
  const [eqError,       setEqError]       = useState<string | null>(null);
  const [addingEq,      setAddingEq]      = useState(false);

  // ── Mutations ─────────────────────────────────────────────────────────

  const createWorkspace = trpc.workspace.create.useMutation({
    onError: (err) => setStep1Error(err.message),
  });

  const teamInvite = trpc.team.invite.useMutation();
  const createEquipment = trpc.equipment.create.useMutation();

  // ── Step handlers ─────────────────────────────────────────────────────

  async function handleStep1() {
    setStep1Error(null);
    if (!industry) { setStep1Error("Please select an industry type."); return; }
    try {
      const ws = await createWorkspace.mutateAsync({ name: deptName.trim(), industryType: industry });
      setWorkspaceId(ws.id);
      setStep(1);
    } catch { /* handled by onError */ }
  }

  function addInvite() {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      setInviteError("Enter a valid email."); return;
    }
    if (inviteList.find((i) => i.email === inviteEmail.trim())) {
      setInviteError("Already in list."); return;
    }
    setInviteList((l) => [...l, { email: inviteEmail.trim(), role: inviteRole }]);
    setInviteEmail("");
    setInviteError(null);
  }

  async function handleStep2() {
    if (!workspaceId || inviteList.length === 0) { setStep(2); return; }
    setInviting(true);
    const errors: string[] = [];
    for (const invite of inviteList) {
      try {
        await teamInvite.mutateAsync({ workspaceId, email: invite.email, role: invite.role });
      } catch { errors.push(invite.email); }
    }
    setInviting(false);
    if (errors.length) setInviteError(`Failed: ${errors.join(", ")}`);
    setStep(2);
  }

  function addEquipItem() {
    if (!eqSerial.trim() || !eqName.trim()) { setEqError("Serial and name required."); return; }
    if (!/^\d{5}$/.test(eqSerial.trim())) { setEqError("Serial must be 5 digits."); return; }
    if (eqList.find((e) => e.serial === eqSerial.trim())) { setEqError("Serial already added."); return; }
    setEqList((l) => [...l, { serial: eqSerial.trim(), name: eqName.trim(), category: eqCategory.trim() }]);
    setEqSerial(""); setEqName(""); setEqCategory(""); setEqError(null);
  }

  async function handleStep3() {
    if (!workspaceId || eqList.length === 0) { setStep(3); return; }
    setAddingEq(true);
    const errors: string[] = [];
    for (const item of eqList) {
      try {
        await createEquipment.mutateAsync({ workspaceId, serial: item.serial, name: item.name });
      } catch { errors.push(item.serial); }
    }
    setAddingEq(false);
    if (errors.length) setEqError(`Failed: ${errors.join(", ")}`);
    setStep(3);
  }

  // ── Render ────────────────────────────────────────────────────────────

  const input = "w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-brand-blue";

  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 min-h-0">
      <div className="w-full max-w-lg">

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-1.5">
                <div className={[
                  "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold",
                  i < step ? "bg-brand-blue text-white" :
                  i === step ? "bg-brand-blue text-white ring-2 ring-brand-blue ring-offset-2 ring-offset-surface-dark" :
                               "bg-surface-dark2 text-slate-muted border border-white/10",
                ].join(" ")}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={`text-[11px] font-semibold hidden sm:block ${i === step ? "text-white" : "text-slate-muted"}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-1 ${i < step ? "bg-brand-blue" : "bg-white/10"}`} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-surface-dark2 rounded-panel border border-white/[0.06] p-6 shadow-device">

          {step === 0 && (
            <>
              <h1 className="text-[18px] font-bold text-white mb-1">Set up your department</h1>
              <p className="text-[13px] text-slate-muted mb-5">Tell us about your team so we can configure LogiTrak for your workflow.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-muted uppercase tracking-wider mb-1.5">Department Name *</label>
                  <input type="text" value={deptName} onChange={(e) => setDeptName(e.target.value)}
                    placeholder="e.g. Lighting Department" className={input.replace("bg-white", "bg-surface-dark")} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-muted uppercase tracking-wider mb-1.5">Industry Type *</label>
                  <select value={industry} onChange={(e) => setIndustry(e.target.value as IndustryType)}
                    className={input.replace("bg-white", "bg-surface-dark") + " text-white"}>
                    <option value="">Select industry…</option>
                    {INDUSTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {step1Error && <p className="text-[12px] text-status-red">{step1Error}</p>}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-[18px] font-bold text-white mb-1">Invite your team</h1>
              <p className="text-[13px] text-slate-muted mb-4">Add crew members now or skip — invite anytime from the Team page.</p>
              <div className="flex gap-2 mb-3">
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addInvite()}
                  placeholder="crew@production.com"
                  className={`flex-1 ${input.replace("bg-white", "bg-surface-dark")} text-white placeholder:text-slate-600`} />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as InviteEntry["role"])}
                  className={`${input.replace("bg-white", "bg-surface-dark")} text-white w-28`}>
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <Button variant="secondary" size="sm" type="button" onClick={addInvite}>Add</Button>
              </div>
              {inviteError && <p className="text-[12px] text-status-red mb-2">{inviteError}</p>}
              {inviteList.length > 0 ? (
                <div className="border border-white/[0.08] rounded-card overflow-hidden mb-2">
                  {inviteList.map((inv, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.06] last:border-b-0">
                      <span className="flex-1 text-[13px] text-white">{inv.email}</span>
                      <span className="text-[11px] text-slate-muted capitalize">{inv.role}</span>
                      <button type="button" onClick={() => setInviteList((l) => l.filter((_, j) => j !== i))}
                        className="text-status-red text-[14px] leading-none">×</button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-[12px] text-slate-muted mb-2">No invites yet — you can skip this step.</p>}
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-[18px] font-bold text-white mb-1">Add your equipment</h1>
              <p className="text-[13px] text-slate-muted mb-4">Add items now or skip — bulk import via CSV from the Equipment page later.</p>
              <div className="border-2 border-dashed border-white/10 rounded-card p-4 text-center mb-4">
                <p className="text-[12px] text-slate-muted">📄 CSV import — available on the Equipment page once you reach the dashboard.</p>
              </div>
              <p className="text-[10px] font-bold text-slate-muted uppercase tracking-widest mb-2">Or add manually</p>
              <div className="flex gap-2 mb-2 flex-wrap">
                <input type="text" value={eqSerial} onChange={(e) => setEqSerial(e.target.value)}
                  placeholder="00001" maxLength={5}
                  className={`w-20 ${input.replace("bg-white", "bg-surface-dark")} text-white font-mono`} />
                <input type="text" value={eqName} onChange={(e) => setEqName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addEquipItem()}
                  placeholder="Equipment name"
                  className={`flex-1 ${input.replace("bg-white", "bg-surface-dark")} text-white placeholder:text-slate-600`} />
                <input type="text" value={eqCategory} onChange={(e) => setEqCategory(e.target.value)}
                  placeholder="Category"
                  className={`w-28 ${input.replace("bg-white", "bg-surface-dark")} text-white placeholder:text-slate-600`} />
                <Button variant="secondary" size="sm" type="button" onClick={addEquipItem}>Add</Button>
              </div>
              {eqError && <p className="text-[12px] text-status-red mb-2">{eqError}</p>}
              {eqList.length > 0 && (
                <div className="border border-white/[0.08] rounded-card overflow-hidden">
                  {eqList.map((eq, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.06] last:border-b-0">
                      <span className="text-serial text-white">{eq.serial}</span>
                      <span className="flex-1 text-[13px] text-white">{eq.name}</span>
                      {eq.category && <span className="text-[11px] text-slate-muted">{eq.category}</span>}
                      <button type="button" onClick={() => setEqList((l) => l.filter((_, j) => j !== i))}
                        className="text-status-red text-[14px] leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-[18px] font-bold text-white mb-1">You&apos;re all set!</h1>
              <p className="text-[13px] text-slate-muted mb-5">
                LogiTrak is configured for <strong className="text-white">{deptName}</strong>. Here&apos;s what was set up:
              </p>
              <div className="space-y-0 divide-y divide-white/[0.06]">
                {[
                  { icon: "🏢", label: "Department", value: deptName },
                  { icon: "🎬", label: "Industry", value: INDUSTRY_OPTIONS.find((o) => o.value === industry)?.label ?? industry },
                  { icon: "👥", label: "Team invites", value: inviteList.length > 0 ? `${inviteList.length} sent` : "Skipped", muted: inviteList.length === 0 },
                  { icon: "📦", label: "Equipment", value: eqList.length > 0 ? `${eqList.length} items added` : "Skipped", muted: eqList.length === 0 },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3 py-3">
                    <span className="text-xl">{row.icon}</span>
                    <span className="text-[12px] text-slate-muted w-28 flex-shrink-0">{row.label}</span>
                    <span className={`text-[13px] font-medium ${row.muted ? "text-slate-muted" : "text-white"}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-6">
            {step > 0 ? (
              <button onClick={() => setStep((s) => s - 1)} className="text-[12px] text-slate-muted hover:text-white">← Back</button>
            ) : <div />}

            <div className="flex items-center gap-3">
              {(step === 1 || step === 2) && (
                <button onClick={() => setStep((s) => s + 1)} className="text-[12px] text-slate-muted hover:text-white">Skip →</button>
              )}
              {step === 0 && (
                <Button variant="primary" disabled={!deptName.trim() || !industry || createWorkspace.isPending} onClick={handleStep1}>
                  {createWorkspace.isPending ? "Creating…" : "Continue →"}
                </Button>
              )}
              {step === 1 && (
                <Button variant="primary" disabled={inviting} onClick={handleStep2}>
                  {inviting ? "Sending…" : "Continue →"}
                </Button>
              )}
              {step === 2 && (
                <Button variant="primary" disabled={addingEq} onClick={handleStep3}>
                  {addingEq ? "Adding…" : "Continue →"}
                </Button>
              )}
              {step === 3 && (
                <Button variant="primary" onClick={() => router.push("/dashboard")}>Go to Dashboard →</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
