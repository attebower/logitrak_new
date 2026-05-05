"use client";

/**
 * Settings → General (Account)
 *
 * Account-level settings: name (formerly "workspace"), industry, department.
 * Save button sits at the bottom of the form.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SettingsPageShell, SettingsSection, SettingsField } from "@/components/shared/SettingsLayout";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import type { IndustryType } from "@prisma/client";

const INDUSTRY_OPTIONS: { value: IndustryType; label: string }[] = [
  { value: "film_tv", label: "Film & TV Production" },
  { value: "events",  label: "Live Events & Productions" },
];

const DEPARTMENT_OPTIONS = [
  { value: "lighting",   label: "Lighting" },
  { value: "camera",     label: "Camera" },
  { value: "sound",      label: "Sound" },
  { value: "grip",       label: "Grip" },
  { value: "art",        label: "Art" },
  { value: "costume",    label: "Costume" },
  { value: "props",      label: "Props" },
  { value: "sfx",        label: "Special Effects" },
  { value: "locations",  label: "Locations" },
  { value: "production", label: "Production" },
  { value: "other",      label: "Other" },
];

export default function SettingsGeneralPage() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();

  const [accountName,  setAccountName]  = useState("");
  const [industryType, setIndustryType] = useState<IndustryType | "">("");
  const [department,   setDepartment]   = useState<string>("");
  const [saveStatus,   setSaveStatus]   = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [toast,        setToast]        = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const { data: workspace, refetch: refetchWorkspace } = trpc.workspace.get.useQuery({ workspaceId });

  const updateWorkspace = trpc.workspace.update.useMutation({
    onSuccess: () => {
      void refetchWorkspace();
      router.refresh();
      setSaveStatus("saved");
      showToast("Account settings saved.");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: (err) => {
      setSaveStatus("error");
      showToast(err.message);
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
  });

  useEffect(() => {
    if (workspace) {
      setAccountName(workspace.name);
      setIndustryType((workspace.industryType ?? "") as IndustryType | "");
      setDepartment((workspace.department ?? "") as string);
    }
  }, [workspace]);

  const hasChanges =
    !!workspace && (
      accountName.trim() !== workspace.name ||
      (industryType || "") !== (workspace.industryType || "") ||
      (department   || "") !== (workspace.department   || "")
    );

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!hasChanges) return;
    setSaveStatus("saving");
    updateWorkspace.mutate({
      workspaceId,
      name:         accountName.trim() || undefined,
      industryType: (industryType as IndustryType) || undefined,
      department:   department || null,
    });
  }

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface-dark text-white text-[12px] font-semibold px-4 py-2.5 rounded-card shadow-device">
          {toast}
        </div>
      )}

      <SettingsPageShell title="General" description="Basic details for your account.">
        <form onSubmit={handleSave}>
          <SettingsSection
            title="Account"
            description="Your account name is shown to all team members and on reports."
          >
            <SettingsField
              label="Account Name"
              hint="Visible to all team members."
            >
              <input
                type="text"
                required
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
              />
            </SettingsField>

            <SettingsField
              label="Industry Type"
              hint="Helps us tailor LogiTrak to your workflow."
            >
              <select
                value={industryType}
                onChange={(e) => setIndustryType(e.target.value as IndustryType | "")}
                className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
              >
                <option value="">Select industry…</option>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </SettingsField>

            <SettingsField
              label="Department"
              hint="Determines which default equipment categories are suggested."
            >
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
              >
                <option value="">Select department…</option>
                {DEPARTMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </SettingsField>
          </SettingsSection>

          {/* Save bar at the bottom */}
          <div className="sticky bottom-0 bg-white border-t border-grey-mid mt-6 py-4 flex items-center justify-end gap-3">
            <span className="text-[12px] text-grey">
              {hasChanges ? "Unsaved changes" : "All changes saved"}
            </span>
            <Button
              variant="primary" size="sm"
              type="submit"
              disabled={!hasChanges || saveStatus === "saving"}
            >
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save Changes"}
            </Button>
          </div>
        </form>
      </SettingsPageShell>
    </>
  );
}
