"use client";

/**
 * Settings — Sprint 3
 *
 * SettingsSection/SettingsField/SettingsPage from Echo's design system.
 *
 * trpc.workspace.get         → load current workspace data
 * trpc.workspace.update      → TODO — not yet in Sage's router; stubbed
 * trpc.workspace.delete      → TODO — not yet in Sage's router; stubbed
 *
 * Owner-only: Danger Zone section only visible to role === "owner"
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { SettingsSection, SettingsPage, SettingsField } from "@/components/shared/SettingsSection";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";

const INDUSTRY_OPTIONS = [
  { value: "film_tv",      label: "Film & TV Production" },
  { value: "live_events",  label: "Live Events & Concerts" },
  { value: "theatre",      label: "Theatre & Performing Arts" },
  { value: "corporate_av", label: "Corporate A/V" },
  { value: "photography",  label: "Photography" },
  { value: "broadcasting", label: "News & Broadcasting" },
  { value: "other",        label: "Other" },
];

export default function SettingsPageComponent() {
  const { workspaceId, userRole } = useWorkspace();
  const isOwner = userRole === "owner";

  const [workspaceName,  setWorkspaceName]  = useState("");
  const [industryType,   setIndustryType]   = useState("");
  const [saveStatus,     setSaveStatus]     = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [deleteConfirm,  setDeleteConfirm]  = useState("");
  const [toast,          setToast]          = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // ── Load workspace ────────────────────────────────────────────────────

  const { data: workspace } = trpc.workspace.get.useQuery({ workspaceId });

  useEffect(() => {
    if (workspace) {
      setWorkspaceName(workspace.name);
      setIndustryType(workspace.industryType ?? "");
    }
  }, [workspace]);

  // ── Handlers ─────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus("saving");
    // TODO: trpc.workspace.update.mutate({ workspaceId, name: workspaceName, industryType })
    // Sage's workspace.update procedure is not yet in the router.
    await new Promise((r) => setTimeout(r, 500));
    setSaveStatus("saved");
    showToast("Workspace settings saved (stubbed — Sage's update procedure coming soon)");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }

  function handleDeleteWorkspace() {
    if (deleteConfirm !== workspace?.name) {
      showToast("Workspace name doesn't match. Type it exactly to confirm.");
      return;
    }
    // TODO: trpc.workspace.delete.mutate({ workspaceId })
    // Sage's workspace.delete procedure is not yet in the router.
    showToast("Delete workspace — coming in a future sprint (Sage)");
    setDeleteConfirm("");
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar title="Settings" />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface-dark text-white text-[12px] font-semibold px-4 py-2.5 rounded-card shadow-device">
          {toast}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <SettingsPage title="General Settings">

          {/* Workspace details */}
          <SettingsSection
            title="Workspace"
            description="Your workspace name and industry type are shown to all team members."
            action={
              <Button
                variant="primary" size="sm"
                form="workspace-form"
                type="submit"
                disabled={saveStatus === "saving"}
              >
                {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save Changes"}
              </Button>
            }
          >
            <form id="workspace-form" onSubmit={handleSave} className="space-y-4">
              <SettingsField
                label="Workspace Name"
                hint="Used as your team's identifier in LogiTrak."
              >
                <input
                  type="text"
                  required
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
                />
              </SettingsField>

              <SettingsField
                label="Industry Type"
                hint="Helps us tailor LogiTrak to your workflow."
              >
                <select
                  value={industryType}
                  onChange={(e) => setIndustryType(e.target.value)}
                  className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
                >
                  <option value="">Select industry…</option>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </SettingsField>
            </form>
          </SettingsSection>

          {/* Billing */}
          <SettingsSection
            title="Billing"
            description="Your current plan, usage, and payment details."
            action={
              <Link href="/settings/billing">
                <span className="text-[12px] text-brand-blue hover:underline font-semibold">Manage billing →</span>
              </Link>
            }
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-grey-mid">
                <span className="text-[13px] text-grey">Plan</span>
                <span className="text-[13px] font-semibold text-surface-dark capitalize">
                  {workspace?.subscriptionTier ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-grey-mid">
                <span className="text-[13px] text-grey">Team members</span>
                <span className="text-[13px] font-semibold text-surface-dark">
                  {workspace?.memberCount ?? "—"} / {workspace?.maxUsers ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[13px] text-grey">Equipment slots</span>
                <span className="text-[13px] font-semibold text-surface-dark">
                  {workspace?.equipmentCount ?? "—"} / {workspace?.maxAssets ?? "—"}
                </span>
              </div>
              <Link href="/settings/billing">
                <Button variant="secondary" size="sm" className="mt-2">
                  View Billing →
                </Button>
              </Link>
            </div>
          </SettingsSection>

          {/* Danger zone — Owner only */}
          {isOwner && (
            <SettingsSection
              title="Delete Workspace"
              description="Permanently delete this workspace and all its data. This cannot be undone."
              variant="danger"
            >
              <div className="space-y-3">
                <p className="text-[12px] text-status-red">
                  Type <strong>{workspace?.name}</strong> to confirm deletion.
                </p>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="Workspace name"
                  className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-status-red"
                />
                <Button
                  variant="destructive" size="sm"
                  disabled={deleteConfirm !== workspace?.name}
                  onClick={handleDeleteWorkspace}
                >
                  Delete Workspace
                </Button>
              </div>
            </SettingsSection>
          )}
        </SettingsPage>
      </div>
    </>
  );
}
