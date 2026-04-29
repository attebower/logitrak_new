"use client";

/**
 * Onboarding wizard — 5 steps.
 *
 * Step 1: Your Profile     → trpc.user.updateProfile (name + department only)
 * Step 2: Your Business    → trpc.workspace.create with full business profile
 * Step 3: Choose Plan      → trpc.workspace.update (subscriptionTier)
 * Step 4: Invite Team      → trpc.team.invite per row, with Admin/User scope
 * Step 5: All set!         → go to dashboard
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, X, Check, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const STEPS = ["Profile", "Business", "Plan", "Invite", "Done"] as const;

type Tier = "starter" | "professional" | "enterprise";

const PLANS: Array<{
  id:         Tier;
  name:       string;
  price:      number;
  tagline:    string;
  features:   string[];
  highlight?: boolean;
}> = [
  {
    id:       "starter",
    name:     "Starter",
    price:    29,
    tagline:  "For single departments on smaller productions",
    features: ["5 team members", "500 assets", "QR check in/out", "Damage tracking", "Standard reports"],
  },
  {
    id:        "professional",
    name:      "Professional",
    price:     89,
    tagline:   "For HODs running multiple stages and larger kits",
    highlight: true,
    features: ["20 team members", "10,000 assets", "Everything in Starter", "CSV/PDF export", "QR label printing", "Advanced analytics"],
  },
  {
    id:       "enterprise",
    name:     "Enterprise",
    price:    249,
    tagline:  "For large studios and touring productions",
    features: ["Unlimited users & assets", "Everything in Pro", "Full audit log", "REST API", "Priority support"],
  },
];

const DEPARTMENT_OPTIONS = [
  "Lighting", "Camera", "Grip", "Props", "Art Direction",
  "Sound", "Costume", "Make-Up & Hair", "Stunts", "Visual Effects",
  "Production", "Locations", "Transport", "Catering", "Medical", "Security", "Other",
] as const;

const LOGO_BUCKET = "workspace-logos";

interface InviteRow {
  fullName: string;
  email:    string;
  scope:    "admin" | "user";
}

const inputCls = "w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark bg-white focus:outline-none focus:ring-1 focus:ring-brand-blue placeholder:text-slate-400";

// ── Step indicator ────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-6 mb-8 flex-wrap">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors",
            i < current
              ? "bg-brand-blue text-white"
              : i === current
              ? "bg-brand-blue text-white ring-2 ring-brand-blue ring-offset-2 ring-offset-grey-light"
              : "bg-white border border-grey-mid text-slate-400"
          )}>
            {i < current ? <Check size={13} /> : i + 1}
          </div>
          <span className={cn(
            "text-[12px] font-semibold whitespace-nowrap hidden sm:block",
            i === current ? "text-surface-dark" : "text-slate-400"
          )}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(0);

  // Step 1 — Profile
  const [fullName,   setFullName]   = useState("");
  const [department, setDepartment] = useState("");
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2 — Business
  const [businessName,  setBusinessName]  = useState("");
  const [addressLine1,  setAddressLine1]  = useState("");
  const [addressLine2,  setAddressLine2]  = useState("");
  const [city,          setCity]          = useState("");
  const [county,        setCounty]        = useState("");
  const [postcode,      setPostcode]      = useState("");
  const [country,       setCountry]       = useState("United Kingdom");
  const [vatNumber,     setVatNumber]     = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [bankDetails,   setBankDetails]   = useState("");
  const [logoUrl,       setLogoUrl]       = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError,     setLogoError]     = useState<string | null>(null);
  const [step2Error,    setStep2Error]    = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 3 — Plan
  const [selectedTier, setSelectedTier] = useState<Tier>("professional");
  const [planError,    setPlanError]    = useState<string | null>(null);

  // Step 4 — Invite
  const [rows, setRows] = useState<InviteRow[]>([{ fullName: "", email: "", scope: "admin" }]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting,    setInviting]    = useState(false);

  const firstName = fullName.trim().split(" ")[0] ?? "";

  // Mutations
  const updateProfile   = trpc.user.updateProfile.useMutation();
  const createWorkspace = trpc.workspace.create.useMutation();
  const updateWorkspace = trpc.workspace.update.useMutation();
  const updateBusiness  = trpc.workspace.updateBusinessProfile.useMutation();
  const userMe          = trpc.user.me.useQuery();
  const teamInvite      = trpc.team.invite.useMutation();

  // ── Step handlers ──────────────────────────────────────────────────────

  async function handleStep1() {
    setStep1Error(null);
    if (!fullName.trim()) { setStep1Error("Full name is required."); return; }
    if (!department)      { setStep1Error("Please select a department."); return; }

    try {
      await updateProfile.mutateAsync({
        fullName:    fullName.trim(),
        displayName: fullName.trim().split(" ")[0],
        department,
      });
      // Pre-fill businessName guess from the user's full name if empty.
      // (They'll overwrite it with the legal name on the next step.)
      setStep(1);
    } catch (err: unknown) {
      setStep1Error(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setLogoError("Please pick an image file."); return; }
    if (file.size > 2 * 1024 * 1024)     { setLogoError("Image too large — keep it under 2 MB."); return; }
    setLogoError(null);
    setLogoUploading(true);
    try {
      const supabase = createClient();
      const ext  = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `onboarding/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      setLogoUrl(pub.publicUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setLogoError(msg.includes("Bucket not found")
        ? `Supabase bucket "${LOGO_BUCKET}" not configured yet. You can skip this and add a logo later in Settings.`
        : msg);
    } finally {
      setLogoUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleStep2() {
    setStep2Error(null);
    if (!businessName.trim()) { setStep2Error("Legal / trading name is required."); return; }

    const payload = {
      businessName:  businessName.trim() || null,
      addressLine1:  addressLine1.trim() || null,
      addressLine2:  addressLine2.trim() || null,
      city:          city.trim()         || null,
      county:        county.trim()       || null,
      postcode:      postcode.trim()     || null,
      country:       country.trim()      || null,
      vatNumber:     vatNumber.trim()    || null,
      businessEmail: businessEmail.trim()|| null,
      businessPhone: businessPhone.trim()|| null,
      bankDetails:   bankDetails.trim()  || null,
      logoUrl:       logoUrl             || null,
    };

    try {
      const existingWorkspaceId = userMe.data?.workspace?.id;
      if (existingWorkspaceId) {
        // Workspace already exists (re-running onboarding). Update name + business fields.
        await updateWorkspace.mutateAsync({
          workspaceId: existingWorkspaceId,
          name:        businessName.trim(),
          department,
        });
        await updateBusiness.mutateAsync({
          workspaceId: existingWorkspaceId,
          ...payload,
        });
      } else {
        await createWorkspace.mutateAsync({
          name:             businessName.trim(),
          industryType:     "film_tv",
          department,
          subscriptionTier: "starter",
          ...payload,
        });
      }
      await userMe.refetch();
      setStep(2);
    } catch (err: unknown) {
      setStep2Error(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handlePlanStep() {
    setPlanError(null);
    const workspaceId = userMe.data?.workspace?.id;
    if (!workspaceId) { setPlanError("Could not resolve workspace. Please refresh."); return; }
    try {
      await updateWorkspace.mutateAsync({ workspaceId, subscriptionTier: selectedTier });
      setStep(3);
    } catch (err: unknown) {
      setPlanError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function addRow() { setRows((r) => [...r, { fullName: "", email: "", scope: "admin" }]); }
  function removeRow(i: number) { setRows((r) => r.filter((_, j) => j !== i)); }
  function updateRow<K extends keyof InviteRow>(i: number, field: K, value: InviteRow[K]) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [field]: value } : row)));
  }

  async function handleInviteStep() {
    setInviteError(null);
    const workspaceId = userMe.data?.workspace?.id;
    if (!workspaceId) { setInviteError("Could not resolve workspace. Please refresh."); return; }

    const filled = rows.filter((r) => r.email.trim());
    if (filled.length === 0) { setStep(4); return; }

    for (const row of filled) {
      if (!row.email.includes("@")) {
        setInviteError(`"${row.email}" doesn't look like a valid email.`);
        return;
      }
    }

    setInviting(true);
    try {
      for (const row of filled) {
        await teamInvite.mutateAsync({
          workspaceId,
          email:      row.email.trim().toLowerCase(),
          role:       row.scope === "admin" ? "admin" : "operator",
          projectIds: [], // No projects exist yet at onboarding
          ...(row.fullName.trim() && { nickname: row.fullName.trim() }),
        });
      }
      setStep(4);
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Failed to send some invites.");
    } finally {
      setInviting(false);
    }
  }

  // Cleanup the local file input
  useEffect(() => () => { if (fileRef.current) fileRef.current.value = ""; }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  const cardWidthCls = step === 2 ? "max-w-5xl" : "max-w-lg";

  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 min-h-0">
      <div className={cn("w-full", cardWidthCls)}>
        <StepIndicator current={step} />

        <div className="bg-white rounded-panel border border-grey-mid p-8 shadow-sm">

          {/* ── Step 1 — Profile ── */}
          {step === 0 && (
            <>
              <h1 className="text-[20px] font-bold text-surface-dark mb-1">Let&apos;s get you set up</h1>
              <p className="text-[13px] text-slate-500 mb-6">A bit about you so we can personalise LogiTrak.</p>

              <div className="space-y-4">
                <Field label="Full name" required>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Jamie Wilson"
                    className={inputCls}
                    autoFocus
                  />
                </Field>

                <Field label="Department" required>
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
                </Field>

                {step1Error && <p className="text-[12px] text-status-red">{step1Error}</p>}
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  size="lg"
                  onClick={handleStep1}
                  disabled={updateProfile.isPending}
                >
                  {updateProfile.isPending ? "Saving…" : "Continue"}
                </Button>
              </div>
            </>
          )}

          {/* ── Step 2 — Business ── */}
          {step === 1 && (
            <>
              <h1 className="text-[20px] font-bold text-surface-dark mb-1">About your business</h1>
              <p className="text-[13px] text-slate-500 mb-6">
                These details appear on your cross-hire invoices and equipment list PDFs.
                Only the legal/trading name is required — fill in the rest now or later from Settings.
              </p>

              <div className="space-y-5">
                {/* Logo */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Logo <span className="font-normal normal-case text-slate-400">(optional)</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-card border border-grey-mid bg-grey-light/40 overflow-hidden flex items-center justify-center shrink-0">
                      {logoUrl ? (
                        <Image src={logoUrl} alt="Logo" width={64} height={64} className="object-contain h-full w-full" unoptimized />
                      ) : (
                        <ImagePlus className="h-5 w-5 text-grey" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" disabled={logoUploading} onClick={() => fileRef.current?.click()}>
                          {logoUploading ? "Uploading…" : logoUrl ? "Replace" : "Upload"}
                        </Button>
                        {logoUrl && (
                          <Button size="sm" variant="ghost" onClick={() => setLogoUrl("")}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" />Remove
                          </Button>
                        )}
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                      </div>
                      {logoError && <p className="text-[11px] text-status-red">{logoError}</p>}
                      <p className="text-[11px] text-slate-400">PNG/JPG/SVG, under 2 MB.</p>
                    </div>
                  </div>
                </div>

                <Field label="Legal / trading name" required>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Northbound Film Services Ltd"
                    className={inputCls}
                    autoFocus
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="VAT number">
                    <input type="text" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="GB123456789" className={inputCls} />
                  </Field>
                  <Field label="Business email">
                    <input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} placeholder="hello@yourcompany.com" className={inputCls} />
                  </Field>
                  <Field label="Business phone">
                    <input type="tel" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} className={inputCls} />
                  </Field>
                </div>

                <div className="border-t border-grey-mid pt-4">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Address (optional)</p>
                  <div className="space-y-3">
                    <input
                      type="text" placeholder="Address line 1"
                      value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)}
                      className={inputCls}
                    />
                    <input
                      type="text" placeholder="Address line 2"
                      value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)}
                      className={inputCls}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
                      <input type="text" placeholder="County" value={county} onChange={(e) => setCounty(e.target.value)} className={inputCls} />
                      <input type="text" placeholder="Postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} className={inputCls} />
                      <input type="text" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </div>

                <Field label="Bank details for invoices" optional>
                  <textarea
                    rows={3}
                    value={bankDetails}
                    onChange={(e) => setBankDetails(e.target.value)}
                    placeholder={"Bank: Barclays\nAccount: 12345678\nSort code: 12-34-56"}
                    className={cn(inputCls, "resize-none")}
                  />
                </Field>

                {step2Error && <p className="text-[12px] text-status-red">{step2Error}</p>}
              </div>

              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setStep(0)}
                  className="text-[12px] text-slate-400 hover:text-surface-dark"
                >
                  Back
                </button>
                <Button
                  size="lg"
                  onClick={handleStep2}
                  disabled={createWorkspace.isPending || updateWorkspace.isPending || updateBusiness.isPending}
                >
                  {(createWorkspace.isPending || updateWorkspace.isPending || updateBusiness.isPending) ? "Saving…" : "Continue"}
                </Button>
              </div>
            </>
          )}

          {/* ── Step 3 — Plan ── */}
          {step === 2 && (
            <>
              <h1 className="text-[22px] font-bold text-surface-dark mb-1">Choose your plan</h1>
              <p className="text-[13px] text-slate-500 mb-6">7-day trial — no card needed up front.</p>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {PLANS.map((plan) => {
                  const isSelected = selectedTier === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedTier(plan.id)}
                      className={cn(
                        "text-left rounded-panel border-2 p-5 transition-all relative",
                        isSelected ? "border-brand-blue bg-brand-blue/5" : "border-grey-mid bg-white hover:border-grey",
                        plan.highlight && !isSelected && "border-brand-blue/50"
                      )}
                    >
                      {plan.highlight && (
                        <span className="absolute -top-2 right-4 px-2 py-0.5 rounded-full bg-brand-blue text-white text-[10px] font-bold uppercase tracking-wider">
                          Most popular
                        </span>
                      )}
                      <div className="flex items-baseline justify-between mb-1.5">
                        <h3 className="text-[16px] font-bold text-surface-dark">{plan.name}</h3>
                        {isSelected && <Check className="h-4 w-4 text-brand-blue" />}
                      </div>
                      <p className="text-[12px] text-slate-500 mb-3">{plan.tagline}</p>
                      <p className="text-[24px] font-bold text-surface-dark mb-3">
                        £{plan.price}<span className="text-[12px] text-slate-400 font-normal">/mo</span>
                      </p>
                      <ul className="space-y-1.5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-1.5 text-[12px] text-slate-600">
                            <Check className="h-3.5 w-3.5 text-brand-blue shrink-0 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              {planError && <p className="text-[12px] text-status-red mt-4">{planError}</p>}
              <p className="text-[11px] text-slate-400 mt-4">
                You can switch plans any time from Settings → Billing.
              </p>

              <div className="flex items-center justify-between mt-6">
                <button onClick={() => setStep(1)} className="text-[12px] text-slate-400 hover:text-surface-dark">
                  Back
                </button>
                <Button size="lg" onClick={handlePlanStep} disabled={updateWorkspace.isPending}>
                  {updateWorkspace.isPending ? "Saving…" : "Start 7-day trial"}
                </Button>
              </div>
            </>
          )}

          {/* ── Step 4 — Invite ── */}
          {step === 3 && (
            <>
              <h1 className="text-[20px] font-bold text-surface-dark mb-1">Who&apos;s on your crew?</h1>
              <p className="text-[13px] text-slate-500 mb-6">
                Invite a few people now or skip and do it later from <span className="font-medium text-surface-dark">Team</span>.
                Pick <span className="font-medium text-surface-dark">Admin</span> for full workspace access, or <span className="font-medium text-surface-dark">User</span> for someone you&apos;ll add to specific projects later.
              </p>

              <div className="space-y-3">
                {rows.map((row, i) => (
                  <div key={i} className="border border-grey-mid rounded-card p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={row.fullName}
                        onChange={(e) => updateRow(i, "fullName", e.target.value)}
                        placeholder="Full name (optional)"
                        className={inputCls}
                      />
                      <input
                        type="email"
                        value={row.email}
                        onChange={(e) => updateRow(i, "email", e.target.value)}
                        placeholder="Email address"
                        className={inputCls}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {(["admin", "user"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => updateRow(i, "scope", s)}
                            className={cn(
                              "px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors",
                              row.scope === s
                                ? "bg-brand-blue text-white"
                                : "bg-grey-light text-surface-dark hover:bg-grey-mid"
                            )}
                          >
                            {s === "admin" ? "Admin" : "User"}
                          </button>
                        ))}
                        <span className="text-[11px] text-slate-400 ml-1.5">
                          {row.scope === "admin" ? "Full workspace access" : "Add to projects later"}
                        </span>
                      </div>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="text-slate-400 hover:text-status-red shrink-0 p-1"
                          aria-label="Remove invite"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
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

              {inviteError && <p className="mt-3 text-[12px] text-status-red">{inviteError}</p>}

              <p className="mt-4 text-[11px] text-slate-400">
                Team members will receive an email invite to create their account.
              </p>

              <div className="flex justify-between items-center mt-6">
                <button onClick={() => setStep(2)} className="text-[12px] text-slate-400 hover:text-surface-dark">
                  Back
                </button>
                <div className="flex items-center gap-3">
                  <Button variant="secondary" onClick={() => setStep(4)} disabled={inviting}>
                    Skip for now
                  </Button>
                  <Button onClick={handleInviteStep} disabled={inviting}>
                    {inviting ? "Sending…" : "Continue"}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* ── Step 5 — Done ── */}
          {step === 4 && (
            <div className="text-center py-4">
              <CheckCircle2 size={56} className="mx-auto mb-5 text-status-green" strokeWidth={1.5} />
              <h1 className="text-[22px] font-bold text-surface-dark mb-2">You&apos;re ready to go</h1>
              <p className="text-[14px] text-slate-500 mb-2">
                Welcome to LogiTrak{firstName ? `, ${firstName}` : ""}.
              </p>
              <p className="text-[13px] text-slate-500 mb-8">
                Next: head to <span className="font-medium text-surface-dark">Equipment</span> to add your first asset, or <span className="font-medium text-surface-dark">Projects</span> to set up a production.
              </p>
              <Button size="lg" onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function Field({ label, required, optional, children }: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-status-red ml-1">*</span>}
        {optional && <span className="ml-1.5 text-[10px] font-normal normal-case text-slate-400">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
