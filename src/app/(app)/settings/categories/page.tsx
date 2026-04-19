"use client";

/**
 * Settings → Equipment → Categories
 *
 * Manage workspace equipment categories:
 *  - List existing (grouped)
 *  - Install department defaults
 *  - Add a new category
 *  - (future) Rename / delete
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SettingsPageShell, SettingsSection, SettingsField } from "@/components/shared/SettingsLayout";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";

export default function SettingsCategoriesPage() {
  const { workspaceId } = useWorkspace();

  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const { data: workspace }  = trpc.workspace.get.useQuery({ workspaceId });
  const { data: categories, refetch } = trpc.category.list.useQuery({ workspaceId });

  const [newName, setNewName]       = useState("");
  const [newGroup, setNewGroup]     = useState("");

  const createCategory = trpc.category.create.useMutation({
    onSuccess: () => {
      showToast("Category added.");
      setNewName("");
      setNewGroup("");
      void refetch();
    },
    onError: (e) => showToast(e.message),
  });

  const installDefaults = trpc.category.installDefaults.useMutation({
    onSuccess: (data) => {
      if (data.installed > 0) showToast(`Installed ${data.installed} default categor${data.installed !== 1 ? "ies" : "y"}.`);
      else if (data.skipped > 0) showToast(`All defaults already installed.`);
      else showToast(data.message ?? "No defaults available.");
      void refetch();
    },
    onError: (e) => showToast(e.message),
  });

  // Group categories by groupName
  const grouped = (categories ?? []).reduce<Record<string, Array<{ id: string; name: string; groupName: string }>>>((acc, c) => {
    (acc[c.groupName] ??= []).push(c);
    return acc;
  }, {});

  const deptLabel = workspace?.department ?? null;

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface-dark text-white text-[12px] font-semibold px-4 py-2.5 rounded-card shadow-device">
          {toast}
        </div>
      )}

      <SettingsPageShell
        title="Equipment Categories"
        description="Organise your equipment into categories. Categories are shared across your whole account."
      >
        <SettingsSection
          title="Install department defaults"
          description={
            deptLabel
              ? `Pre-populate with the default category set for your department (${deptLabel}). Safe to re-run — existing categories are kept.`
              : "Set a department under General → Department first, then come back to install defaults."
          }
          action={
            <Button
              variant="primary" size="sm"
              disabled={!deptLabel || installDefaults.isPending}
              onClick={() => installDefaults.mutate({ workspaceId })}
            >
              {installDefaults.isPending ? "Installing…" : "Install defaults"}
            </Button>
          }
        >
          <p className="text-[12px] text-grey">
            This adds the recommended category list for your department. It&rsquo;s optional &mdash; you can also add categories manually below.
          </p>
        </SettingsSection>

        <SettingsSection
          title="Add a category"
          description="Create a custom category for equipment in this account."
        >
          <div className="grid grid-cols-2 gap-3">
            <SettingsField label="Name">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Gels & Diffusion"
                className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
              />
            </SettingsField>
            <SettingsField label="Group">
              <input
                type="text"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                placeholder="e.g. Consumables"
                className="w-full bg-grey-light border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue"
              />
            </SettingsField>
          </div>
          <div className="mt-2 flex justify-end">
            <Button
              variant="primary" size="sm"
              disabled={!newName.trim() || !newGroup.trim() || createCategory.isPending}
              onClick={() => createCategory.mutate({
                workspaceId,
                name: newName.trim(),
                groupName: newGroup.trim(),
              })}
            >
              {createCategory.isPending ? "Adding…" : "Add category"}
            </Button>
          </div>
        </SettingsSection>

        <SettingsSection
          title={`Current categories (${categories?.length ?? 0})`}
          description="All categories in this account, grouped."
        >
          {(!categories || categories.length === 0) ? (
            <p className="text-[13px] text-grey py-6 text-center">No categories yet. Install defaults above or add one manually.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([group, items]) => (
                <div key={group}>
                  <div className="text-[11px] font-semibold text-grey uppercase tracking-wide mb-2">{group}</div>
                  <div className="flex flex-wrap gap-2">
                    {items.sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-grey-light border border-grey-mid text-[12px] text-surface-dark"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>
      </SettingsPageShell>
    </>
  );
}
